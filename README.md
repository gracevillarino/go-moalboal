# Go Moalboal

Phase 1 of a community-made digital town square for Moalboal, built with Astro.

## Local development

This project requires Node.js 22.12 or newer.

```sh
pnpm install
pnpm dev
```

## Content

Six content collections live under `src/content`: businesses, guides, living, organizations, volunteer opportunities and stories. All included business records are fictional samples and must be replaced before launch.

## Google Places staging importer

1. Enable Places API (New) and create a restricted key.
2. Copy `.env.example` to `.env` and set `GOOGLE_MAPS_API_KEY`.
3. Run `pnpm import:places`.

The discovery importer writes review-only data to:

- `data/imports/google-places.json`
- `data/imports/google-places-review.csv`

It searches all seven directory categories, deduplicates by Google Place ID, rejects
nearby results whose address is not in Moalboal, and includes only places with at least
20 Google reviews and an average rating of 4.0 or higher. It then selects up to 200
candidates with balanced category coverage. It never publishes records into the Astro
content collection automatically. Phone numbers, websites and opening hours are deferred
until candidates have been approved for a second enrichment pass.

Manually approved exceptions live in `data/imports/manual-places.json`. These records can
override locality filtering and can belong to more than one directory category. Existing
review statuses are preserved by Google Place ID when the importer is rerun.

Run `pnpm publish:places` after review to replace sample businesses with approved,
publication-ready content entries. Only approved records meeting the 4.0 rating and
20-review minimum are published.

After publication, run `pnpm enrich:places` to request phone numbers and official
websites for approved Place IDs. If the listed website is a Facebook page, or an
official website links to one, the Facebook URL is recorded separately. The script
does not guess Facebook pages from name-only web searches. Re-running the publisher
preserves enriched contact fields.

For a confirmed manual correction, edit `data/imports/place-contact-overrides.json`.
Use the Google Place ID as the key and include only fields that should override the
enriched record:

```json
{
  "ChIJ-example-place-id": {
    "phone": "+63 900 000 0000",
    "website": "https://example.com/",
    "facebook": "https://www.facebook.com/example/"
  }
}
```

Run `pnpm publish:places` after saving overrides. To deliberately clear a value,
set it to an empty string. The review CSV remains the source for approval, categories,
matched queries and editorial notes; it is not the durable source for contact corrections.

Google Place photos are not downloaded into this static repository. Photo resource
names can expire, must not be cached, and may require author attribution. Add Google
photos later through an on-demand service, or use business-owner supplied photos with
documented permission.

Run `pnpm enrich:about` to regenerate the two-part About copy and source lists for
published places. The first paragraph is visitor-oriented; the second supplies clear
business-category and Moalboal location context. The script uses Google Maps, the listed
website, confirmed Facebook page, accessible official-site pages and reputable profiles
linked by the official site. It records no more than six sources and does not invent
first-person experiences or unsupported amenities.

Place pages load qualifying reviews dynamically through `/api/reviews`; review text is
not written into the static HTML or the business JSON files. Google Maps can return at
most five relevance-sorted reviews, which the page filters to 5 stars and displays newest
first. Tripadvisor Terra is requested for up to six most-recent 5-star reviews from the
account's available review pool. Add both `GOOGLE_MAPS_API_KEY` and
`TRIPADVISOR_API_KEY` to `.env` for local development.

The production review endpoint is a Cloudflare Pages Function in
`functions/api/reviews.js`. Add the same two values as encrypted Cloudflare Pages secrets.
GitHub Pages can host the static site but cannot execute this endpoint, so the live review
carousels require the Cloudflare deployment. `/api/reviews` is blocked in `robots.txt` and
returns `no-store` and `noindex` headers.

Instagram sections show up to six posts in a three-column carousel. Verified public post
or reel URLs work as embeds without extra setup. To load the latest six posts for a
professional account, add `INSTAGRAM_BUSINESS_ACCOUNT_ID` and `INSTAGRAM_ACCESS_TOKEN` to
`.env` and to the corresponding Cloudflare secrets. The live endpoint uses Instagram
Business Discovery and does not scrape profiles; personal accounts that are unavailable
through the API fall back to their verified profile link.

Run `pnpm enrich:emails` to check listed official websites for public email addresses.
Email is displayed only when found. Weekly opening hours are requested live from Google
Places and appear in At a glance without being stored in the static business records.

The staging file records a 30-day expiry for cached Google coordinates. Do not combine
Google Places coordinates with a non-Google map. Google Place IDs can be retained for later
refreshes.
