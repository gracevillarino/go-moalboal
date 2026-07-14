import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve('dist');
const client = path.join(dist, 'client');
const server = path.join(dist, 'server');

await rm(client, { recursive: true, force: true });
await rm(server, { recursive: true, force: true });
await mkdir(client, { recursive: true });

for (const entry of await readdir(dist)) {
  if (entry === 'client' || entry === 'server' || entry === '.openai') continue;
  await rename(path.join(dist, entry), path.join(client, entry));
}

await mkdir(server, { recursive: true });
await writeFile(path.join(server, 'index.js'), `
const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const hasExtension = /\\.[^/]+$/.test(url.pathname);
    const candidates = hasExtension
      ? [url.pathname]
      : [url.pathname, url.pathname.endsWith('/') ? \`\${url.pathname}index.html\` : \`\${url.pathname}/index.html\`];

    for (const pathname of candidates) {
      const assetUrl = new URL(pathname, url);
      const response = await env.ASSETS.fetch(new Request(assetUrl, request));
      if (response.status !== 404) return response;
    }

    return new Response('Not found', {
      status: 404,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  },
};

export default worker;
`.trimStart());

console.log('Prepared Astro static output for Sites hosting.');
