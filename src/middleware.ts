import { defineMiddleware } from 'astro:middleware';
import { liveInstagramResponse } from '../lib/live-instagram.mjs';
import { liveReviewResponse } from '../lib/live-reviews.mjs';

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  if (url.pathname === '/api/instagram') return liveInstagramResponse(request, {
    accountId: import.meta.env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    accessToken: import.meta.env.INSTAGRAM_ACCESS_TOKEN,
  });
  if (url.pathname !== '/api/reviews') return next();
  return liveReviewResponse(request, {
    googleApiKey: import.meta.env.GOOGLE_MAPS_API_KEY,
    tripadvisorApiKey: import.meta.env.TRIPADVISOR_API_KEY,
  });
});
