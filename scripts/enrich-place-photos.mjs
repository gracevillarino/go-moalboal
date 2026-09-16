import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DIRECTORY = path.resolve('src/content/businesses');
const PHOTOS_DIR = path.resolve('public/photos');
const CONCURRENCY = 4;
const MAX_PHOTOS = 5;
const MAX_WIDTH_PX = 1200;

if (!API_KEY) {
  console.error('Missing GOOGLE_MAPS_API_KEY. Copy .env.example to .env and add a restricted API key.');
  process.exit(1);
}

async function fetchPhotoRefs(placeId) {
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'photos',
    },
  });
  if (!response.ok) throw new Error(`Place Details returned ${response.status} for ${placeId}`);
  const payload = await response.json();
  return (payload.photos ?? []).slice(0, MAX_PHOTOS);
}

async function fetchPhotoMedia(photoName) {
  const response = await fetch(
    `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${MAX_WIDTH_PX}&key=${API_KEY}`,
  );
  if (!response.ok) throw new Error(`Photo media returned ${response.status} for ${photoName}`);
  return Buffer.from(await response.arrayBuffer());
}

async function enrich(file) {
  const filePath = path.join(DIRECTORY, file);
  const business = JSON.parse(await readFile(filePath, 'utf8'));
  if (business.photos?.length || !business.googlePlaceId) return false;
  try {
    const photoRefs = await fetchPhotoRefs(business.googlePlaceId);
    if (!photoRefs.length) return false;

    const outputDir = path.join(PHOTOS_DIR, business.slug);
    await mkdir(outputDir, { recursive: true });

    const photos = [];
    for (const [index, photoRef] of photoRefs.entries()) {
      const bytes = await fetchPhotoMedia(photoRef.name);
      const fileName = `${index + 1}.jpg`;
      await writeFile(path.join(outputDir, fileName), bytes);
      const author = photoRef.authorAttributions?.[0];
      photos.push({
        path: `/photos/${business.slug}/${fileName}`,
        width: photoRef.widthPx,
        height: photoRef.heightPx,
        attribution: { displayName: author?.displayName ?? 'Google Maps', uri: author?.uri ?? '' },
      });
    }
    if (!photos.length) return false;

    business.photos = photos;
    await writeFile(filePath, `${JSON.stringify(business, null, 2)}\n`);
    return true;
  } catch {
    return false;
  }
}

const files = (await readdir(DIRECTORY)).filter((file) => file.endsWith('.json'));
let cursor = 0;
let updated = 0;
async function worker() {
  while (cursor < files.length) {
    const file = files[cursor++];
    if (await enrich(file)) updated += 1;
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`Downloaded photos for ${updated} Place listings.`);
