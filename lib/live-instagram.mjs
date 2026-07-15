const GRAPH_URL = 'https://graph.facebook.com/v25.0';

export async function liveInstagramPayload({ username, accountId, accessToken }) {
  if (!username || !accountId || !accessToken) return { available: false, posts: [] };
  if (!/^[A-Za-z0-9._]+$/.test(username) || !/^\d+$/.test(accountId)) throw new Error('Invalid Instagram account details.');
  const fields = `business_discovery.username(${username}){media.limit(6){id,caption,media_type,media_url,permalink,thumbnail_url,timestamp}}`;
  const url = new URL(`${GRAPH_URL}/${accountId}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', accessToken);
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) return { available: false, posts: [], error: `${response.status} ${response.statusText}` };
  const data = await response.json();
  const posts = (data.business_discovery?.media?.data ?? []).slice(0, 6).map((post) => ({
    id: post.id,
    caption: post.caption ?? '',
    mediaType: post.media_type,
    imageUrl: post.thumbnail_url ?? post.media_url ?? '',
    permalink: post.permalink ?? '',
    publishedAt: post.timestamp ?? '',
  })).filter((post) => post.imageUrl && post.permalink);
  return { available: true, posts };
}

export async function liveInstagramResponse(request, keys) {
  const url = new URL(request.url);
  const payload = await liveInstagramPayload({
    username: url.searchParams.get('username') ?? '',
    accountId: keys.accountId,
    accessToken: keys.accessToken,
  }).catch((error) => ({ available: false, posts: [], error: error.message }));
  return new Response(JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
  });
}
