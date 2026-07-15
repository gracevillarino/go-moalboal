import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const OUTPUT_DIR = path.resolve('data/imports');
const JSON_OUTPUT = path.join(OUTPUT_DIR, 'google-places.json');
const CSV_OUTPUT = path.join(OUTPUT_DIR, 'google-places-review.csv');
const MANUAL_PLACES_FILE = path.join(OUTPUT_DIR, 'manual-places.json');
const TARGET_MIN = 150;
const TARGET_MAX = 200;
const MIN_RATING = 4.0;
const MIN_REVIEW_COUNT = 20;

// A conservative rectangle around Moalboal. Address components are checked again
// after each response so nearby Badian, Alcantara and Ronda results are rejected.
const MOALBOAL_BOUNDS = {
  low: { latitude: 9.82, longitude: 123.32 },
  high: { latitude: 10.02, longitude: 123.53 },
};

const CATEGORY_LIMITS = {
  eat: 45,
  stay: 40,
  dive: 25,
  shop: 30,
  transport: 20,
  health: 20,
  services: 20,
};

const SEARCHES = [
  { query: 'restaurant', category: 'eat' },
  { query: 'cafe', category: 'eat' },
  { query: 'bar', category: 'eat' },
  { query: 'bakery', category: 'eat' },
  { query: 'fast food restaurant', category: 'eat' },
  { query: 'local food', category: 'eat' },
  { query: 'hotel', category: 'stay' },
  { query: 'resort', category: 'stay' },
  { query: 'hostel', category: 'stay' },
  { query: 'guest house', category: 'stay' },
  { query: 'homestay', category: 'stay' },
  { query: 'dive shop', category: 'dive' },
  { query: 'scuba diving', category: 'dive' },
  { query: 'snorkeling tour', category: 'dive' },
  { query: 'tour operator', category: 'dive' },
  { query: 'grocery store', category: 'shop' },
  { query: 'supermarket', category: 'shop' },
  { query: 'convenience store', category: 'shop' },
  { query: 'public market', category: 'shop' },
  { query: 'hardware store', category: 'shop' },
  { query: 'shopping', category: 'shop' },
  { query: 'motorcycle rental', category: 'transport' },
  { query: 'car rental', category: 'transport' },
  { query: 'transport service', category: 'transport' },
  { query: 'gas station', category: 'transport' },
  { query: 'travel agency', category: 'transport' },
  { query: 'pharmacy', category: 'health' },
  { query: 'medical clinic', category: 'health' },
  { query: 'dentist', category: 'health' },
  { query: 'hospital', category: 'health' },
  { query: 'laundry', category: 'services' },
  { query: 'barber shop', category: 'services' },
  { query: 'beauty salon', category: 'services' },
  { query: 'spa', category: 'services' },
  { query: 'gym', category: 'services' },
  { query: 'bank', category: 'services' },
  { query: 'ATM', category: 'services' },
  { query: 'repair service', category: 'services' },
  { query: 'contractor', category: 'services' },
];

if (!API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY. Copy .env.example to .env and add a restricted API key.');
  process.exit(1);
}

// Ratings are included so the staging export can enforce the directory's
// minimum quality threshold. Contact and opening-hours fields remain deferred.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.addressComponents',
  'places.location',
  'places.businessStatus',
  'places.googleMapsUri',
  'places.rating',
  'places.userRatingCount',
  'places.primaryType',
  'places.types',
  'nextPageToken',
].join(',');

let requestCount = 0;

async function searchPlaces(search, pageToken) {
  const body = {
    textQuery: `${search.query} in Moalboal, Cebu, Philippines`,
    pageSize: 20,
    languageCode: 'en',
    regionCode: 'PH',
    locationRestriction: { rectangle: MOALBOAL_BOUNDS },
  };
  if (pageToken) body.pageToken = pageToken;

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  requestCount += 1;

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Places API returned ${response.status} for “${search.query}”: ${detail}`);
  }

  return response.json();
}

async function getPlace(placeId) {
  const fieldMask = FIELD_MASK
    .split(',')
    .filter((field) => field !== 'nextPageToken')
    .map((field) => field.replace(/^places\./, ''))
    .join(',');
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=en&regionCode=PH`,
    {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
    },
  );
  requestCount += 1;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Places API returned ${response.status} for manual place ${placeId}: ${detail}`);
  }
  return response.json();
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function isInMoalboal(place) {
  const locality = (place.addressComponents ?? []).some((component) =>
    component.longText?.toLowerCase() === 'moalboal'
    || component.shortText?.toLowerCase() === 'moalboal');
  const address = place.formattedAddress?.toLowerCase() ?? '';
  return locality || address.includes('moalboal');
}

function toStagingRecord(place, search) {
  const name = place.displayName?.text ?? 'Unnamed place';
  return {
    reviewStatus: 'pending',
    googlePlaceId: place.id,
    name,
    suggestedSlug: slugify(name),
    suggestedCategory: search.category,
    googlePrimaryType: place.primaryType ?? '',
    googleTypes: place.types ?? [],
    businessStatus: place.businessStatus ?? '',
    address: place.formattedAddress ?? '',
    coordinates: place.location
      ? { lat: place.location.latitude, lng: place.location.longitude }
      : null,
    googleMapsUri: place.googleMapsUri ?? '',
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? 0,
    matchedQueries: [search.query],
    categories: [search.category],
    notes: '',
  };
}

function addPlaces(records, places, search, rejected) {
  for (const place of places ?? []) {
    if (!place.id || !isInMoalboal(place)) {
      rejected.count += 1;
      continue;
    }

    const existing = records.get(place.id);
    if (existing) {
      if (!existing.matchedQueries.includes(search.query)) existing.matchedQueries.push(search.query);
      if (existing.suggestedCategory !== search.category) {
        existing.alternateCategories ??= [];
        if (!existing.alternateCategories.includes(search.category)) {
          existing.alternateCategories.push(search.category);
        }
        if (!existing.categories.includes(search.category)) existing.categories.push(search.category);
      }
    } else {
      records.set(place.id, toStagingRecord(place, search));
    }
  }
}

function selectBalanced(records) {
  const selected = [];
  const overflow = [];
  const counts = Object.fromEntries(Object.keys(CATEGORY_LIMITS).map((category) => [category, 0]));

  for (const record of records) {
    const category = record.suggestedCategory;
    if (counts[category] < CATEGORY_LIMITS[category]) {
      selected.push(record);
      counts[category] += 1;
    } else {
      overflow.push(record);
    }
  }

  for (const record of overflow) {
    if (selected.length >= TARGET_MAX) break;
    selected.push(record);
    counts[record.suggestedCategory] += 1;
  }

  return {
    records: selected.slice(0, TARGET_MAX).sort((a, b) =>
      a.suggestedCategory.localeCompare(b.suggestedCategory) || a.name.localeCompare(b.name)),
    categoryCounts: counts,
  };
}

function meetsQualityThreshold(record) {
  return record.rating !== null
    && record.rating >= MIN_RATING
    && record.reviewCount >= MIN_REVIEW_COUNT;
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join(' | ') : String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers = [], ...values] = rows;
  return values.map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

async function loadReviewOverrides() {
  try {
    const rows = parseCsv(await readFile(CSV_OUTPUT, 'utf8'));
    return new Map(rows.map((row) => [row.googlePlaceId, row]));
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
}

async function loadManualPlaces() {
  try {
    return JSON.parse(await readFile(MANUAL_PLACES_FILE, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function toCsv(records) {
  const columns = [
    'reviewStatus', 'suggestedCategory', 'categories', 'name', 'rating', 'reviewCount',
    'address', 'googlePrimaryType',
    'businessStatus', 'googleMapsUri', 'googlePlaceId', 'matchedQueries', 'notes',
  ];
  const rows = records.map((record) => columns.map((column) => csvCell(record[column])).join(','));
  return `${columns.join(',')}\n${rows.join('\n')}\n`;
}

async function run() {
  const reviewOverrides = await loadReviewOverrides();
  const records = new Map();
  const rejected = { count: 0 };
  const pageTokens = [];

  // First page for every query ensures all directory categories get coverage.
  for (const search of SEARCHES) {
    console.log(`Searching: ${search.query}`);
    const data = await searchPlaces(search);
    addPlaces(records, data.places, search, rejected);
    if (data.nextPageToken) pageTokens.push({ search, token: data.nextPageToken });
  }

  // Only request second pages when the first pass did not reach the launch target.
  if (records.size < TARGET_MIN) {
    for (const page of pageTokens) {
      console.log(`Searching page 2: ${page.search.query}`);
      const data = await searchPlaces(page.search, page.token);
      addPlaces(records, data.places, page.search, rejected);
      if (records.size >= TARGET_MAX) break;
    }
  }

  const eligibleRecords = [...records.values()].filter(meetsQualityThreshold);
  const balanced = selectBalanced(eligibleRecords);
  const approvedOverrides = new Map(
    [...reviewOverrides].filter(([, review]) => review.reviewStatus === 'approved'),
  );
  const selectedRecords = approvedOverrides.size
    ? balanced.records.filter((record) => approvedOverrides.has(record.googlePlaceId))
    : [...balanced.records];

  // Once a review has been completed, preserve the approved selection rather
  // than allowing a later search-order change to swap in new pending records.
  for (const [placeId, review] of approvedOverrides) {
    if (selectedRecords.some((record) => record.googlePlaceId === placeId)) continue;
    const place = await getPlace(placeId);
    const category = review.suggestedCategory || 'services';
    const record = toStagingRecord(place, { category, query: category });
    if (!meetsQualityThreshold(record)) continue;
    record.reviewStatus = 'approved';
    record.matchedQueries = review.matchedQueries
      ? review.matchedQueries.split(' | ').filter(Boolean)
      : [category];
    record.categories = review.categories
      ? review.categories.split(' | ').filter(Boolean)
      : [category];
    record.alternateCategories = record.categories.filter((item) => item !== category);
    record.notes = review.notes ?? '';
    selectedRecords.push(record);
  }

  for (const manual of await loadManualPlaces()) {
    const place = await getPlace(manual.googlePlaceId);
    const categories = manual.categories?.length ? manual.categories : ['services'];
    const record = toStagingRecord(place, {
      category: categories[0],
      query: manual.matchedQueries?.[0] ?? categories[0],
    });
    record.categories = categories;
    record.alternateCategories = categories.slice(1);
    record.matchedQueries = manual.matchedQueries ?? categories;
    record.reviewStatus = manual.reviewStatus ?? 'approved';
    record.notes = manual.notes ?? 'Manually approved locality override.';
    const existingIndex = selectedRecords.findIndex((item) => item.googlePlaceId === record.googlePlaceId);
    if (existingIndex >= 0) selectedRecords[existingIndex] = record;
    else selectedRecords.push(record);
  }

  for (const record of selectedRecords) {
    const override = reviewOverrides.get(record.googlePlaceId);
    if (!override) continue;
    if (override.reviewStatus) record.reviewStatus = override.reviewStatus;
    if (override.suggestedCategory) record.suggestedCategory = override.suggestedCategory;
    if (override.categories) {
      record.categories = override.categories.split(' | ').filter(Boolean);
      record.alternateCategories = record.categories.filter((item) => item !== record.suggestedCategory);
    }
    if (override.matchedQueries) {
      record.matchedQueries = override.matchedQueries.split(' | ').filter(Boolean);
    }
    if (override.notes) record.notes = override.notes;
  }

  selectedRecords.sort((a, b) =>
    a.suggestedCategory.localeCompare(b.suggestedCategory) || a.name.localeCompare(b.name));
  const categoryCounts = Object.fromEntries(Object.keys(CATEGORY_LIMITS).map((category) => [
    category,
    selectedRecords.filter((record) => record.categories.includes(category)).length,
  ]));
  const importedAt = new Date();
  const expiresAt = new Date(importedAt.getTime() + 30 * 24 * 60 * 60 * 1000);
  const payload = {
    importedAt: importedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    source: 'Google Places API (New) Text Search — ratings-enriched staging data',
    attribution: 'Google Maps',
    note: 'Review-only staging data. Do not publish or combine its coordinates with a non-Google map. Refresh or remove cached Google coordinates by expiresAt; Google Place IDs may be retained.',
    requestCount,
    discoveredCount: records.size,
    qualityThreshold: { minimumRating: MIN_RATING, minimumReviewCount: MIN_REVIEW_COUNT },
    eligibleCount: eligibleRecords.length,
    rejectedBelowQualityThreshold: records.size - eligibleRecords.length,
    rejectedOutsideMoalboal: rejected.count,
    selectedCount: selectedRecords.length,
    categoryCounts,
    records: selectedRecords,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(JSON_OUTPUT, `${JSON.stringify(payload, null, 2)}\n`),
    writeFile(CSV_OUTPUT, toCsv(payload.records)),
  ]);

  console.log(`Saved ${payload.selectedCount} eligible review candidates from ${payload.discoveredCount} unique Moalboal places.`);
  console.log(`Quality filter: rating >= ${MIN_RATING}; reviews >= ${MIN_REVIEW_COUNT}; eligible: ${payload.eligibleCount}`);
  console.log(`Requests: ${requestCount}; rejected outside Moalboal: ${rejected.count}`);
  console.log(`JSON: ${JSON_OUTPUT}`);
  console.log(`CSV:  ${CSV_OUTPUT}`);
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
