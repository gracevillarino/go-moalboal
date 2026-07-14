import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const INPUT = path.resolve('data/imports/google-places.json');
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

function toBusiness(record, used) {
  const categories = record.categories?.length ? record.categories : [record.suggestedCategory];
  const slug = uniqueSlug(record.suggestedSlug, record.googlePlaceId, used);
  const area = areaFromAddress(record.address);
  const label = categories.map((category) => CATEGORY_LABELS[category]).join(' and ');
  const summary = `${label} in ${area}. Rated ${record.rating.toFixed(1)} from ${record.reviewCount.toLocaleString('en-US')} Google reviews.`;
  const description = `${record.name} is listed at ${record.address}. This community-reviewed entry meets Go Moalboal’s publication threshold of at least 20 Google reviews and a 4.0 average rating. Follow the Google Maps link for current directions and place details.`;
  const tags = [...new Set([
    ...categories,
    ...(record.googleTypes ?? []).filter((type) => !['point_of_interest', 'establishment'].includes(type)).slice(0, 4),
  ])].map((tag) => tag.replaceAll('_', '-'));

  return {
    name: record.name,
    slug,
    summary,
    description,
    category: categories[0],
    categories,
    barangay: area,
    address: record.address,
    coordinates: record.coordinates,
    phone: '', email: '', website: '', facebook: '',
    googleMapsUri: record.googleMapsUri,
    googlePlaceId: record.googlePlaceId,
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
const approved = payload.records.filter((record) =>
  record.reviewStatus === 'approved' && record.rating >= 4 && record.reviewCount >= 20);
if (!approved.length) throw new Error('No approved Places records found.');

await mkdir(OUTPUT_DIR, { recursive: true });
for (const file of await readdir(OUTPUT_DIR)) {
  if (file.endsWith('.json')) await rm(path.join(OUTPUT_DIR, file));
}

const used = new Set();
const businesses = approved.map((record) => toBusiness(record, used));
await Promise.all(businesses.map((business) =>
  writeFile(path.join(OUTPUT_DIR, `${business.slug}.json`), `${JSON.stringify(business, null, 2)}\n`)));

console.log(`Published ${businesses.length} approved Places entries to ${OUTPUT_DIR}.`);
