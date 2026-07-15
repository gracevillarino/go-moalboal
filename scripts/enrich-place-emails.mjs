import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DIRECTORY = path.resolve('src/content/businesses');
const CONCURRENCY = 4;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BLOCKED = /example\.|sentry|wixpress|cloudflare|createlaunchpad|telegram\.org|domain\.com|email\.com|yourname|noreply|no-reply|^u003e/i;

function decodeHtml(value) {
  return value.replace(/&#64;|&#x40;/gi, '@').replace(/&#46;|&#x2e;/gi, '.').replace(/&amp;/gi, '&');
}

function emailsFromHtml(html) {
  return [...new Set((decodeHtml(html).match(EMAIL_PATTERN) ?? [])
    .map((email) => email.toLowerCase().replace(/[),.;]+$/, ''))
    .filter((email) => !BLOCKED.test(email) && !/\.(png|jpe?g|gif|svg|webp)$/i.test(email)))];
}

async function fetchHtml(url) {
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(12_000),
    headers: { 'User-Agent': 'GoMoalboal contact-data updater (+https://gomoalboal.com)' },
  });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
  return { html: await response.text(), url: response.url };
}

function contactUrl(html, baseUrl) {
  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    if (!/contact|about/i.test(match[1])) continue;
    try {
      const url = new URL(match[1], baseUrl);
      if (url.origin === new URL(baseUrl).origin) return url.href;
    } catch { /* ignore malformed links */ }
  }
  return '';
}

async function enrich(file) {
  const filePath = path.join(DIRECTORY, file);
  const business = JSON.parse(await readFile(filePath, 'utf8'));
  if (business.email || !business.website) return false;
  try {
    const homepage = await fetchHtml(business.website);
    if (!homepage) return false;
    let emails = emailsFromHtml(homepage.html);
    const nextUrl = contactUrl(homepage.html, homepage.url);
    if (!emails.length && nextUrl && nextUrl !== homepage.url) {
      const contact = await fetchHtml(nextUrl);
      if (contact) emails = emailsFromHtml(contact.html);
    }
    if (!emails.length) return false;
    business.email = emails[0];
    business.contactSources = [...new Set([...(business.contactSources ?? []), homepage.url])];
    business.contactCheckedAt = new Date().toISOString();
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
console.log(`Added public email addresses to ${updated} Place listings.`);
