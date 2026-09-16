import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const INPUT = path.resolve('data/imports/google-places.json');
const CONTACT_OVERRIDES_INPUT = path.resolve('data/imports/place-contact-overrides.json');
const OUTPUT_DIR = path.resolve('src/content/businesses');
const CATEGORY_LABELS = {
  eat: 'Food and drink', stay: 'Accommodation', dive: 'Diving and ocean activities',
  shop: 'Shopping', transport: 'Transport', health: 'Health', services: 'Local service',
};

function areaFromAddress(address) {
  const areas = [
    ['Panagsama', 'Panagsama'], ['Basdiot', 'Basdiot'], ['Tongo', 'Tongo'],
    ['Saavedra', 'Saavedra'], ['White Beach', 'Saavedra'], ['Tuble', 'Tuble'],
    ['Poblacion East', 'Poblacion East'], ['Poblacion West', 'Poblacion West'],
    ['Poblacion', 'Poblacion'], ['Balabagon', 'Balabagon'], ['Bugho', 'Bugho'],
    ['Tomonoy', 'Tomonoy'], ['Lanao', 'Lanao'], ['Bala', 'Bala'],
    ['Badian', 'Badian border'],
  ];
  return areas.find(([needle]) => address.toLowerCase().includes(needle.toLowerCase()))?.[1] ?? 'Moalboal';
}

function uniqueSlug(base, placeId, used) {
  let slug = base || `place-${placeId.slice(-6).toLowerCase()}`;
  if (used.has(slug)) slug = `${slug}-${placeId.slice(-5).toLowerCase()}`;
  used.add(slug);
  return slug;
}

function valueWithOverride(existingValue, overrides, field) {
  return Object.hasOwn(overrides, field) ? overrides[field] : existingValue;
}

function toBusiness(record, used, existing = {}, overrides = {}) {
  const categories = record.categories?.length ? record.categories : [record.suggestedCategory];
  const slug = uniqueSlug(record.suggestedSlug, record.googlePlaceId, used);
  const area = areaFromAddress(record.address);
  const label = categories.map((category) => CATEGORY_LABELS[category]).join(' and ');
  const summary = `${label} in ${area}. Rated ${record.rating.toFixed(1)} from ${record.reviewCount.toLocaleString('en-US')} Google reviews.`;
  const fallbackDescription = `${record.name} is listed at ${record.address}. This community-reviewed entry meets Go Moalboal’s publication threshold of at least 20 Google reviews and a 4.0 average rating. Follow the Google Maps link for current directions and place details.`;
  const tags = [...new Set([
    ...categories,
    ...(record.googleTypes ?? []).filter((type) => !['point_of_interest', 'establishment'].includes(type)).slice(0, 4),
  ])].map((tag) => tag.replaceAll('_', '-'));

  return {
    name: record.name,
    slug,
    summary,
    description: existing.description ?? fallbackDescription,
    category: categories[0],
    categories,
    barangay: area,
    address: record.address,
    coordinates: record.coordinates,
    phone: valueWithOverride(existing.phone ?? '', overrides, 'phone'),
    email: valueWithOverride(existing.email ?? '', overrides, 'email'),
    website: valueWithOverride(existing.website ?? '', overrides, 'website'),
    facebook: valueWithOverride(existing.facebook ?? '', overrides, 'facebook'),
    contactCheckedAt: existing.contactCheckedAt,
    contactSources: existing.contactSources ?? [],
    aboutGeneratedAt: existing.aboutGeneratedAt,
    sources: existing.sources ?? [],
    reviewInsights: existing.reviewInsights,
    googleMapsUri: record.googleMapsUri,
    googlePlaceId: record.googlePlaceId,
    photos: existing.photos ?? [],
    rating: record.rating,
    ratingCount: record.reviewCount,
    tags,
    featured: record.rating >= 4.7 && record.reviewCount >= 500,
    verified: false,
    status: 'published',
    sample: false,
  };
}

const payload = JSON.parse(await readFile(INPUT, 'utf8'));
let contactOverrides = {};
try {
  contactOverrides = JSON.parse(await readFile(CONTACT_OVERRIDES_INPUT, 'utf8'));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const approved = payload.records.filter((record) =>
  record.reviewStatus === 'approved' && record.rating >= 4 && record.reviewCount >= 20);
if (!approved.length) throw new Error('No approved Places records found.');

await mkdir(OUTPUT_DIR, { recursive: true });
const existingByPlaceId = new Map();
for (const file of await readdir(OUTPUT_DIR)) {
  if (file.endsWith('.json')) {
    const existing = JSON.parse(await readFile(path.join(OUTPUT_DIR, file), 'utf8'));
    if (existing.googlePlaceId) existingByPlaceId.set(existing.googlePlaceId, existing);
  }
}
for (const file of await readdir(OUTPUT_DIR)) {
  if (file.endsWith('.json')) await rm(path.join(OUTPUT_DIR, file));
}

const used = new Set();
const businesses = approved.map((record) =>
  toBusiness(
    record,
    used,
    existingByPlaceId.get(record.googlePlaceId),
    contactOverrides[record.googlePlaceId] ?? {},
  ));
await Promise.all(businesses.map((business) =>
  writeFile(path.join(OUTPUT_DIR, `${business.slug}.json`), `${JSON.stringify(business, null, 2)}\n`)));

console.log(`Published ${businesses.length} approved Places entries to ${OUTPUT_DIR}.`);
