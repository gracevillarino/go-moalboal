import { liveInstagramResponse } from '../../lib/live-instagram.mjs';

export function onRequestGet({ request, env }) {
  return liveInstagramResponse(request, {
    accountId: env.INSTAGRAM_BUSINESS_ACCOUNT_ID,
    accessToken: env.INSTAGRAM_ACCESS_TOKEN,
  });
}
