import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const TRIPADVISOR_API_KEY = process.env.TRIPADVISOR_API_KEY;
const BUSINESSES_DIR = path.resolve('src/content/businesses');
const CONCURRENCY = 5;
const MAX_TERMS = 5;
const TRIPADVISOR_BASE_URL = 'https://terra.tripadvisor.com/api';
const TRIPADVISOR_REQUEST_INTERVAL_MS = 1_100;
let tripadvisorRequestQueue = Promise.resolve();
let lastTripadvisorRequestAt = 0;

if (!GOOGLE_API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY in .env.');
  process.exit(1);
}

const STOPWORDS = new Set(`a able about absolutely after again all also always am amazing an and any are area as at away back be because been before being best better bit both but by came can come could day definitely did do does doing down during each even ever every everything excellent experience few first for from further get getting go good got great had has have having he her here hers herself highly him himself his how i if in into is it its itself just kind like little loved lovely made make many may me more most much my myself near nice no nor not now of off on once one only or order ordered other our ours ourselves out over own people perfect place really recommend recommended right said same see she should so some stay stayed still such super sure than thank that the their theirs them themselves then there these they thing this those through time to too tried under until up very visit was way we well were what when where which while who why will with wonderful would you your yours yourself yourselves`.split(/\s+/));

const TERM_ALIASES = new Map([
  ['staff', 'staff and service'], ['service', 'staff and service'], ['friendly', 'staff and service'], ['helpful', 'staff and service'], ['accommodating', 'staff and service'], ['attentive', 'staff and service'],
  ['food', 'food'], ['meal', 'food'], ['restaurant', 'food'], ['delicious', 'food'],
  ['room', 'rooms'], ['rooms', 'rooms'], ['bed', 'rooms'], ['beds', 'rooms'], ['hostel', 'rooms'], ['hotel', 'rooms'],
  ['location', 'location'], ['located', 'location'], ['central', 'location'],
  ['beach', 'beach'], ['ocean', 'sea'], ['sea', 'sea'], ['view', 'views'], ['views', 'views'],
  ['pool', 'pool'], ['breakfast', 'breakfast'], ['coffee', 'coffee'], ['bar', 'bar'],
  ['quiet', 'quiet setting'], ['peaceful', 'quiet setting'],
  ['value', 'value'], ['price', 'value'], ['prices', 'value'], ['affordable', 'value'],
  ['atmosphere', 'atmosphere'], ['vibe', 'atmosphere'], ['ambience', 'atmosphere'], ['ambiance', 'atmosphere'],
  ['dive', 'diving'], ['diving', 'diving'], ['diver', 'diving'],
  ['clean', 'cleanliness'], ['cleanliness', 'cleanliness'], ['spotless', 'cleanliness'],
  ['comfortable', 'comfort'], ['comfy', 'comfort'], ['pad', 'pad Thai'],
  ['spacious', 'space'], ['garden', 'garden'], ['family', 'family stays'],
]);

function normalizeToken(token) {
  return token.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
}

function topTerms(texts, businessName) {
  const nameWords = new Set(businessName.split(/\s+/).map(normalizeToken).filter((word) => word.length > 2));
  const counts = new Map();
  const reviewCoverage = new Map();
  texts.forEach((text) => {
    const seen = new Set();
    for (const raw of text.match(/[\p{L}']+/gu) ?? []) {
      const token = normalizeToken(raw);
      if (token.length < 3 || STOPWORDS.has(token) || nameWords.has(token) || token === 'moalboal') continue;
      const label = TERM_ALIASES.get(token) ?? token;
      counts.set(label, (counts.get(label) ?? 0) + 1);
      seen.add(label);
    }
    for (const label of seen) reviewCoverage.set(label, (reviewCoverage.get(label) ?? 0) + 1);
  });
  return [...counts]
    .filter(([label]) => (reviewCoverage.get(label) ?? 0) >= 2)
    .sort((a, b) => (reviewCoverage.get(b[0]) ?? 0) - (reviewCoverage.get(a[0]) ?? 0) || b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TERMS)
    .map(([term, mentions]) => ({ term, mentions, reviews: reviewCoverage.get(term) ?? 0 }));
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  return response.json();
}

async function googleReviews(placeId) {
  const data = await fetchJson(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en&regionCode=PH`, {
    headers: {
      'X-Goog-Api-Key': GOOGLE_API_KEY,
      'X-Goog-FieldMask': 'reviews',
    },
  });
  return (data.reviews ?? []).map((review) => review.text?.text).filter(Boolean);
}

function normalizedWords(value) {
  return new Set(value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((word) => word.length > 2 && !STOPWORDS.has(word)));
}

function matchScore(name, candidate) {
  const expected = normalizedWords(name);
  const actual = normalizedWords(candidate ?? '');
  const intersection = [...expected].filter((word) => actual.has(word)).length;
  return intersection / Math.max(expected.size, actual.size, 1);
}

function translationValue(translations = []) {
  return translations.find((translation) => translation.primary)?.value
    ?? translations.find((translation) => translation.language === 'en')?.value
    ?? translations[0]?.value
    ?? '';
}

function distanceKm(origin, destination) {
  if (!origin || !destination || !Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude)) return null;
  const radians = (degrees) => degrees * Math.PI / 180;
  const deltaLat = radians(destination.latitude - origin.lat);
  const deltaLng = radians(destination.longitude - origin.lng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(radians(origin.lat)) * Math.cos(radians(destination.latitude)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function tripadvisorSearchQueries(name) {
  const simplified = name
    .replace(/\bmoalboal\b/gi, '')
    .replace(/\bcebu\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return [...new Set([name, simplified].filter(Boolean))];
}

async function tripadvisorFetch(url) {
  const request = tripadvisorRequestQueue.then(async () => {
    const waitMs = Math.max(0, TRIPADVISOR_REQUEST_INTERVAL_MS - (Date.now() - lastTripadvisorRequestAt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastTripadvisorRequestAt = Date.now();
    return fetchJson(url, { headers: { 'X-API-KEY': TRIPADVISOR_API_KEY } });
  });
  tripadvisorRequestQueue = request.catch(() => {});
  return request;
}

async function tripadvisorReviews(business) {
  if (!TRIPADVISOR_API_KEY) return null;
  const candidatesById = new Map();
  for (const query of tripadvisorSearchQueries(business.name)) {
    const search = new URL(`${TRIPADVISOR_BASE_URL}/catalog/locations/search`);
    search.searchParams.set('query', query);
    search.searchParams.set('country_code', 'PH');
    search.searchParams.set('locale', 'en-PH');
    search.searchParams.set('size', '10');
    if (business.categories.includes('stay') && !business.categories.includes('eat')) search.searchParams.set('category', 'HOTEL');
    if (business.categories.includes('eat') && !business.categories.includes('stay')) search.searchParams.set('category', 'RESTAURANT');
    const searchData = await tripadvisorFetch(search);
    for (const result of searchData.data ?? []) {
      const location = result.location ?? result;
      if (location?.id) candidatesById.set(location.id, location);
    }
    if (candidatesById.size) break;
  }

  const candidates = [...candidatesById.values()]
    .map((location) => ({
      location,
      name: translationValue(location.names),
      score: matchScore(business.name, translationValue(location.names)),
      distance: distanceKm(business.coordinates, location.coordinates),
    }))
    .filter((candidate) => candidate.distance === null || candidate.distance <= 50)
    .sort((a, b) => b.score - a.score || (a.distance ?? Infinity) - (b.distance ?? Infinity));
  if (!candidates.length || candidates[0].score < 0.8) return null;

  const match = candidates[0].location;
  const locationId = match.id;
  const reviewUrl = new URL(`${TRIPADVISOR_BASE_URL}/locations/${locationId}/reviews`);
  reviewUrl.searchParams.set('language', 'en');
  reviewUrl.searchParams.set('page', '1');
  reviewUrl.searchParams.set('size', '5');
  const reviewData = await tripadvisorFetch(reviewUrl);
  const reviewText = (review) => [translationValue(review.title), translationValue(review.text)].filter(Boolean).join(' ');
  return {
    locationId: String(locationId),
    url: match.urls?.tripadvisor?.main ?? reviewData.data?.[0]?.url ?? '',
    texts: (reviewData.data ?? []).map(reviewText).filter(Boolean),
  };
}

function addTripadvisorSource(sources, business, url) {
  if (!url || sources.some((source) => source.url === url)) return sources;
  return [...sources.slice(0, 5), { title: `${business.name} on Tripadvisor`, publisher: 'Tripadvisor', url }];
}

async function enrichBusiness(file) {
  const filePath = path.join(BUSINESSES_DIR, file);
  const business = JSON.parse(await readFile(filePath, 'utf8'));
  if (!business.categories.some((category) => ['eat', 'stay'].includes(category))) return { outcome: 'skipped' };

  const googleTexts = await googleReviews(business.googlePlaceId);
  let tripadvisor = business.reviewInsights?.tripadvisor ?? null;
  let tripadvisorError = '';
  if (!tripadvisor) {
    try {
      const tripadvisorData = await tripadvisorReviews(business);
      tripadvisor = tripadvisorData ? {
        locationId: tripadvisorData.locationId,
        url: tripadvisorData.url,
        reviewCount: tripadvisorData.texts.length,
        topTerms: topTerms(tripadvisorData.texts, business.name),
      } : null;
    } catch (error) {
      tripadvisorError = error.message;
    }
  }

  const google = { reviewCount: googleTexts.length, topTerms: topTerms(googleTexts, business.name) };
  const baseParagraphs = business.description.split(/\n\n+/).slice(0, 2);
  business.description = baseParagraphs.join('\n\n');
  business.reviewInsights = {
    generatedAt: new Date().toISOString(),
    google,
    tripadvisor,
    notice: 'Google sample: up to five reviews ordered by relevance. Tripadvisor sample: up to five most recent reviews. Themes do not represent every review.',
  };
  if (tripadvisor?.url) business.sources = addTripadvisorSource(business.sources ?? [], business, tripadvisor.url);
  await writeFile(filePath, `${JSON.stringify(business, null, 2)}\n`);
  return { outcome: 'updated', googleReviews: google.reviewCount, googleTerms: google.topTerms.length, tripadvisor: Boolean(tripadvisor), tripadvisorError };
}

async function runPool(items, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runWorker() {
    while (next < items.length) {
      const index = next;
      next += 1;
      try { results[index] = await worker(items[index]); }
      catch (error) { results[index] = { outcome: 'failed', file: items[index], error: error.message }; }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, runWorker));
  return results;
}

const files = (await readdir(BUSINESSES_DIR)).filter((file) => file.endsWith('.json')).sort();
const results = await runPool(files, enrichBusiness);
const updated = results.filter((result) => result.outcome === 'updated');
const failed = results.filter((result) => result.outcome === 'failed');
const tripadvisorErrors = updated.filter((result) => result.tripadvisorError);
console.log(`Updated review themes for ${updated.length} Stay/Eat listings.`);
console.log(`Google review samples returned: ${updated.reduce((sum, result) => sum + result.googleReviews, 0)}; listings with recurring terms: ${updated.filter((result) => result.googleTerms).length}.`);
console.log(`Tripadvisor matches: ${updated.filter((result) => result.tripadvisor).length}${TRIPADVISOR_API_KEY ? '' : ' (skipped: TRIPADVISOR_API_KEY is not set)'}.`);
console.log(`Tripadvisor API errors: ${tripadvisorErrors.length}.`);
for (const error of [...new Set(tripadvisorErrors.map((result) => result.tripadvisorError))].slice(0, 5)) console.error(`Tripadvisor: ${error}`);
console.log(`Failed listings: ${failed.length}.`);
for (const failure of failed) console.error(`${failure.file}: ${failure.error}`);
if (failed.length || (TRIPADVISOR_API_KEY && tripadvisorErrors.length === updated.length)) process.exitCode = 1;
