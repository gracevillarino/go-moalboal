import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BUSINESSES_DIR = path.resolve('src/content/businesses');
const CONCURRENCY = 6;
const MAX_SOURCES = 6;

const CATEGORY_COPY = {
  eat: { label: 'place to eat and drink', opening: (name, area) => `When you are deciding where to eat around ${area}, ${name} is a local option to keep on your shortlist.`, action: 'Check the latest opening details before making the trip.' },
  stay: { label: 'place to stay', opening: (name, area) => `If you want to base yourself around ${area}, ${name} is one of the local stays you can compare.`, action: 'Check current room details and booking terms directly before you travel.' },
  dive: { label: 'diving and ocean activity provider', opening: (name, area) => `For time in the water around ${area}, ${name} is a local operator worth including in your research.`, action: 'Contact the operator directly to confirm conditions, schedules and experience requirements.' },
  shop: { label: 'local shop', opening: (name, area) => `When you need to pick something up around ${area}, ${name} is one of the nearby places to know about.`, action: 'Check current stock and opening times before heading over.' },
  transport: { label: 'transport provider', opening: (name, area) => `Getting around is easier when you know the local options, and ${name} serves the ${area} area.`, action: 'Confirm availability, prices and identification requirements directly.' },
  health: { label: 'health service', opening: (name, area) => `If you need practical health support around ${area}, ${name} is a local service to have on hand.`, action: 'Call ahead to confirm hours, services and whether an appointment is needed.' },
  services: { label: 'local service', opening: (name, area) => `For an everyday task around ${area}, ${name} is one of the local services you can contact.`, action: 'Confirm current hours, availability and pricing directly.' },
};

const FEATURE_PATTERNS = [
  ['breakfast', /\bbreakfast\b/i],
  ['coffee', /\bcoffee|espresso|café|cafe\b/i],
  ['vegetarian options', /\bvegetarian|vegan|plant[ -]based\b/i],
  ['seafood', /\bseafood|fresh fish\b/i],
  ['a swimming pool', /\bswimming pool|outdoor pool\b/i],
  ['beach access', /\bbeachfront|beach access|private beach\b/i],
  ['Wi-Fi', /\bwi-?fi|wireless internet\b/i],
  ['air-conditioned rooms', /\bair[- ]condition/i],
  ['dive courses', /\bdive courses?|scuba courses?|padi|ssi\b/i],
  ['guided dives', /\bguided dives?|fun dives?|dive trips?\b/i],
  ['equipment rental', /\bequipment rental|gear rental|rental equipment\b/i],
  ['freediving', /\bfreediv/i],
  ['airport transfers', /\bairport transfer|airport shuttle\b/i],
  ['motorbike rental', /\bmotorbike|motorcycle|scooter rental\b/i],
  ['massage treatments', /\bmassage|body treatment\b/i],
  ['laundry services', /\blaundry|wash and fold\b/i],
  ['online booking', /\bbook online|online booking|reserve online\b/i],
];

const LINKED_SOURCE_HOSTS = new Map([
  ['facebook.com', 'Facebook'], ['instagram.com', 'Instagram'],
  ['tripadvisor.com', 'Tripadvisor'], ['booking.com', 'Booking.com'],
  ['agoda.com', 'Agoda'], ['youtube.com', 'YouTube'],
]);

function decodeHtml(value = '') {
  return value.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'").replaceAll('&nbsp;', ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/\s+/g, ' ').trim();
}

function textFromHtml(html) {
  return decodeHtml(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["']`, 'i'),
  ];
  return decodeHtml(patterns.map((pattern) => html.match(pattern)?.[1]).find(Boolean) ?? '');
}

function pageTitle(html) {
  return metaContent(html, 'og:title') || decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
}

function linksFromHtml(html, baseUrl) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      const url = new URL(decodeHtml(match[1]), baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      url.hash = '';
      links.push({ url: url.toString(), text: textFromHtml(match[2]) });
    } catch { /* Ignore malformed third-party markup. */ }
  }
  return links;
}

async function fetchPage(url) {
  try {
    const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'GoMoalboal source-backed directory editor/1.0' } });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
    const html = (await response.text()).slice(0, 1_000_000);
    return { url: response.url, title: pageTitle(html), description: metaContent(html, 'description') || metaContent(html, 'og:description'), text: textFromHtml(html).slice(0, 80_000), links: linksFromHtml(html, response.url) };
  } catch { return null; }
}

function hostname(value) {
  try { return new URL(value).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

function publisherForHost(host) {
  for (const [domain, publisher] of LINKED_SOURCE_HOSTS) if (host === domain || host.endsWith(`.${domain}`)) return publisher;
  return '';
}

function addSource(sources, source) {
  if (!source.url || sources.some((item) => item.url === source.url) || sources.length >= MAX_SOURCES) return;
  sources.push(source);
}

function sourceTitle(page, fallback) {
  const title = page?.title?.replace(/\s*[|–—-]\s*[^|–—-]+$/, '').trim();
  return title || fallback;
}

function naturalList(items) {
  if (items.length < 2) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function featureSentence(features) {
  return features.length ? `Its published information highlights ${naturalList(features.slice(0, 4))}.` : '';
}

async function enrichBusiness(file) {
  const filePath = path.join(BUSINESSES_DIR, file);
  const business = JSON.parse(await readFile(filePath, 'utf8'));
  const copy = CATEGORY_COPY[business.category] ?? CATEGORY_COPY.services;
  const sources = [];
  const pages = [];
  addSource(sources, { title: `${business.name} on Google Maps`, publisher: 'Google Maps', url: business.googleMapsUri });

  let officialPage = null;
  if (business.website) {
    officialPage = await fetchPage(business.website);
    if (officialPage) pages.push(officialPage);
    addSource(sources, { title: sourceTitle(officialPage, `${business.name} website`), publisher: hostname(business.website), url: officialPage?.url ?? business.website });
  }
  if (business.facebook) addSource(sources, { title: `${business.name} Facebook page`, publisher: 'Facebook', url: business.facebook });

  if (officialPage) {
    const officialHost = hostname(officialPage.url);
    const internalCandidates = officialPage.links.filter((link) => hostname(link.url) === officialHost && /\babout|rooms?|dive|menu|services?|facilities|activities\b/i.test(`${link.text} ${link.url}`));
    for (const candidate of internalCandidates.slice(0, 2)) {
      const page = await fetchPage(candidate.url);
      if (!page) continue;
      pages.push(page);
      addSource(sources, { title: sourceTitle(page, `${business.name} information`), publisher: officialHost, url: page.url });
    }
    for (const link of officialPage.links) {
      const publisher = publisherForHost(hostname(link.url));
      if (publisher) addSource(sources, { title: `${business.name} on ${publisher}`, publisher, url: link.url });
    }
  }

  const officialText = pages.map((page) => `${page.description} ${page.text}`).join(' ');
  const features = FEATURE_PATTERNS.filter(([, pattern]) => pattern.test(officialText)).map(([label]) => label).slice(0, 4);
  const firstParagraph = [copy.opening(business.name, business.barangay), featureSentence(features), copy.action].filter(Boolean).join(' ');
  const secondParagraph = `${business.name} is listed as a ${copy.label} in ${business.barangay}, Moalboal, at ${business.address}. Use the contact and source links on this page to verify current services, hours and availability.`;
  business.description = `${firstParagraph}\n\n${secondParagraph}`;
  business.sources = sources.slice(0, MAX_SOURCES);
  business.aboutGeneratedAt = new Date().toISOString();
  await writeFile(filePath, `${JSON.stringify(business, null, 2)}\n`);
  return { sources: business.sources.length, official: pages.length > 0, features: features.length };
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runWorker() { while (next < items.length) { const index = next; next += 1; results[index] = await worker(items[index]); } }
  await Promise.all(Array.from({ length: CONCURRENCY }, runWorker));
  return results;
}

const files = (await readdir(BUSINESSES_DIR)).filter((file) => file.endsWith('.json')).sort();
const results = await runPool(files, enrichBusiness);
const sourceCounts = Object.fromEntries(Array.from({ length: MAX_SOURCES }, (_, index) => index + 1).map((count) => [count, results.filter((result) => result.sources === count).length]));
console.log(`Generated source-backed About content for ${files.length} places.`);
console.log(`Listings with an accessible official page: ${results.filter((result) => result.official).length}`);
console.log(`Listings with official-site features used: ${results.filter((result) => result.features).length}`);
console.log(`Source counts: ${JSON.stringify(sourceCounts)}`);
