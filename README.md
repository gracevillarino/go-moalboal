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

The staging file records a 30-day expiry for cached Google coordinates. Do not combine
Google Places coordinates with a non-Google map. Google Place IDs can be retained for later
refreshes.
