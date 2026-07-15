const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places';
const TRIPADVISOR_URL = 'https://terra.tripadvisor.com/api';

function translationValue(translations = []) {
  return translations.find((translation) => translation.primary)?.value
    ?? translations.find((translation) => translation.language === 'en')?.value
    ?? translations[0]?.value
    ?? '';
}

async function fetchJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

async function googleReviews(placeId, apiKey) {
  if (!placeId || !apiKey) return { available: false, reviews: [], attributions: [] };
  if (!/^[A-Za-z0-9_-]+$/.test(placeId)) throw new Error('Invalid Google Place ID.');
  const url = new URL(`${GOOGLE_PLACES_URL}/${encodeURIComponent(placeId)}`);
  url.searchParams.set('languageCode', 'en');
  url.searchParams.set('regionCode', 'PH');
  const data = await fetchJson(url, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'reviews,attributions,currentOpeningHours,regularOpeningHours',
    },
  });
  const reviews = (data.reviews ?? [])
    .filter((review) => review.rating > 4.5 && review.text?.text)
    .sort((a, b) => String(b.publishTime ?? '').localeCompare(String(a.publishTime ?? '')))
    .slice(0, 5)
    .map((review) => ({
      rating: review.rating,
      text: review.text.text,
      originalText: review.originalText?.text ?? '',
      translated: Boolean(review.originalText?.text && review.originalText.text !== review.text.text),
      publishedAt: review.publishTime ?? '',
      relativePublishedAt: review.relativePublishTimeDescription ?? '',
      author: review.authorAttribution?.displayName ?? 'Google Maps contributor',
      authorUrl: review.authorAttribution?.uri ?? '',
      authorAvatar: review.authorAttribution?.photoUri ?? '',
      sourceUrl: review.googleMapsUri ?? '',
      reportUrl: review.flagContentUri ?? '',
    }));
  return {
    available: true,
    reviews,
    attributions: (data.attributions ?? []).map((item) => ({ name: item.provider, url: item.providerUri })),
    openingHours: {
      openNow: data.currentOpeningHours?.openNow,
      weekdayDescriptions: data.currentOpeningHours?.weekdayDescriptions
        ?? data.regularOpeningHours?.weekdayDescriptions
        ?? [],
    },
    notice: 'Filtered to 5-star reviews from the up to five relevance-sorted reviews supplied by Google Maps, then displayed newest first.',
  };
}

async function tripadvisorReviews(locationId, apiKey) {
  if (!locationId || !apiKey) return { available: false, reviews: [] };
  if (!/^\d+$/.test(locationId)) throw new Error('Invalid Tripadvisor location ID.');
  const url = new URL(`${TRIPADVISOR_URL}/locations/${locationId}/reviews`);
  url.searchParams.set('rating_min', '4.5');
  url.searchParams.set('sort_by', 'MOST_RECENT');
  url.searchParams.set('language', 'en');
  url.searchParams.set('page', '1');
  url.searchParams.set('size', '6');
  const data = await fetchJson(url, { headers: { 'X-API-KEY': apiKey } });
  const reviews = (data.data ?? [])
    .filter((review) => review.rating > 4.5 && translationValue(review.text))
    .slice(0, 6)
    .map((review) => ({
      rating: review.rating,
      title: translationValue(review.title),
      text: translationValue(review.text),
      publishedAt: review.publish_ts ?? '',
      author: review.user?.username ?? 'Tripadvisor traveler',
      authorUrl: review.user?.profile_url ?? '',
      authorAvatar: review.user?.avatar_url?.url ?? '',
      sourceUrl: review.url ?? '',
    }));
  return {
    available: true,
    reviews,
    notice: 'The most recent 5-star reviews available in this account’s Tripadvisor review pool, up to six.',
  };
}

export async function liveReviewPayload({ googlePlaceId, tripadvisorLocationId, googleApiKey, tripadvisorApiKey }) {
  const [google, tripadvisor] = await Promise.all([
    googleReviews(googlePlaceId, googleApiKey).catch((error) => ({ available: false, reviews: [], error: error.message })),
    tripadvisorReviews(tripadvisorLocationId, tripadvisorApiKey).catch((error) => ({ available: false, reviews: [], error: error.message })),
  ]);
  return { google, tripadvisor, fetchedAt: new Date().toISOString() };
}

export async function liveReviewResponse(request, keys) {
  const url = new URL(request.url);
  const payload = await liveReviewPayload({
    googlePlaceId: url.searchParams.get('googlePlaceId') ?? '',
    tripadvisorLocationId: url.searchParams.get('tripadvisorLocationId') ?? '',
    googleApiKey: keys.googleApiKey,
    tripadvisorApiKey: keys.tripadvisorApiKey,
  });
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
