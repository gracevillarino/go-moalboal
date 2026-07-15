import { liveReviewResponse } from '../../lib/live-reviews.mjs';

export function onRequestGet({ request, env }) {
  return liveReviewResponse(request, {
    googleApiKey: env.GOOGLE_MAPS_API_KEY,
    tripadvisorApiKey: env.TRIPADVISOR_API_KEY,
  });
}
