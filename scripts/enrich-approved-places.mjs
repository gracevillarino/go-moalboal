import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const BUSINESSES_DIR = path.resolve('src/content/businesses');
const CONTACT_OVERRIDES_FILE = path.resolve('data/imports/place-contact-overrides.json');
const CONCURRENCY = 5;
const DETAILS_FIELD_MASK = 'id,nationalPhoneNumber,websiteUri';

if (!API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY. Add it to the project .env file.');
  process.exit(1);
}

function cleanUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith('utm_') || ['fbclid', 'gclid'].includes(key)) url.searchParams.delete(key);
    }
    return url.toString();
  } catch {
    return '';
  }
}

function isFacebookUrl(value) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, '').toLowerCase();
    return hostname === 'facebook.com' || hostname.endsWith('.facebook.com') || hostname === 'fb.com';
  } catch {
    return false;
  }
}

function usefulFacebookUrl(value) {
  const cleaned = cleanUrl(value);
  if (!isFacebookUrl(cleaned)) return '';
  const pathname = new URL(cleaned).pathname.toLowerCase();
  if (['/share.php', '/sharer.php', '/dialog/share', '/plugins/'].some((part) => pathname.startsWith(part))) {
    return '';
  }
  return cleaned;
}

async function getPlaceDetails(placeId) {
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en&regionCode=PH`,
    {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': DETAILS_FIELD_MASK,
      },
    },
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Place Details returned ${response.status}: ${detail}`);
  }
  return response.json();
}

async function findFacebookOnWebsite(website) {
  if (!website || isFacebookUrl(website)) return '';
  try {
    const response = await fetch(website, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'GoMoalboal directory contact verifier/1.0' },
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return '';
    const html = await response.text();
    const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
    for (const href of links) {
      try {
        const candidate = usefulFacebookUrl(new URL(href, response.url).toString());
        if (candidate) return candidate;
      } catch {
        // Ignore malformed links from third-party sites.
      }
    }
  } catch {
    // A blocked or unavailable official site should not stop the full enrichment pass.
  }
  return '';
}

function valueWithOverride(enrichedValue, overrides, field) {
  return Object.hasOwn(overrides, field) ? overrides[field] : enrichedValue;
}

async function enrichBusiness(file, checkedAt, overridesByPlaceId) {
  const filePath = path.join(BUSINESSES_DIR, file);
  const business = JSON.parse(await readFile(filePath, 'utf8'));
  if (!business.googlePlaceId) return { outcome: 'skipped' };

  const details = await getPlaceDetails(business.googlePlaceId);
  const listedWebsite = cleanUrl(details.websiteUri);
  const googleFacebook = usefulFacebookUrl(listedWebsite);
  const website = googleFacebook ? '' : listedWebsite;
  const websiteFacebook = googleFacebook || await findFacebookOnWebsite(website);
  const phone = details.nationalPhoneNumber?.trim() ?? '';
  const overrides = overridesByPlaceId[business.googlePlaceId] ?? {};

  business.phone = valueWithOverride(phone, overrides, 'phone');
  business.website = valueWithOverride(website, overrides, 'website');
  business.facebook = valueWithOverride(websiteFacebook, overrides, 'facebook');
  business.contactCheckedAt = checkedAt;
  business.contactSources = [...new Set([
    business.googleMapsUri,
    website,
  ].filter(Boolean))];

  await writeFile(filePath, `${JSON.stringify(business, null, 2)}\n`);
  return {
    outcome: 'updated',
    phone: Boolean(phone),
    website: Boolean(website),
    facebook: Boolean(websiteFacebook),
  };
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runWorker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await worker(items[index]);
      } catch (error) {
        results[index] = { outcome: 'failed', error: error.message, file: items[index] };
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, runWorker));
  return results;
}

const files = (await readdir(BUSINESSES_DIR)).filter((file) => file.endsWith('.json')).sort();
let contactOverrides = {};
try {
  contactOverrides = JSON.parse(await readFile(CONTACT_OVERRIDES_FILE, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const checkedAt = new Date().toISOString();
const results = await runPool(files, (file) => enrichBusiness(file, checkedAt, contactOverrides));
const updated = results.filter((result) => result.outcome === 'updated');
const failed = results.filter((result) => result.outcome === 'failed');

console.log(`Processed ${files.length} published places.`);
console.log(`Phone numbers: ${updated.filter((result) => result.phone).length}`);
console.log(`Websites: ${updated.filter((result) => result.website).length}`);
console.log(`Facebook pages confirmed from listed/official websites: ${updated.filter((result) => result.facebook).length}`);
console.log(`Failed requests: ${failed.length}`);
for (const failure of failed) console.error(`${failure.file}: ${failure.error}`);
if (failed.length) process.exitCode = 1;
