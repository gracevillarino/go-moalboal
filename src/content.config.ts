import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const barangay = z.string().min(1);
const publicationStatus = z.enum(['draft', 'published', 'archived']).default('draft');

const businesses = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/businesses' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    summary: z.string(),
    description: z.string(),
    category: z.enum(['eat', 'stay', 'dive', 'shop', 'transport', 'health', 'services']),
    categories: z.array(z.enum(['eat', 'stay', 'dive', 'shop', 'transport', 'health', 'services'])).min(1),
    barangay,
    address: z.string(),
    coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable(),
    phone: z.string().default(''),
    email: z.string().default(''),
    website: z.url().or(z.literal('')).default(''),
    facebook: z.url().or(z.literal('')).default(''),
    contactCheckedAt: z.iso.datetime().optional(),
    contactSources: z.array(z.url()).default([]),
    aboutGeneratedAt: z.iso.datetime().optional(),
    sources: z.array(z.object({
      title: z.string(),
      publisher: z.string(),
      url: z.url(),
    })).max(6).default([]),
    reviewInsights: z.object({
      generatedAt: z.iso.datetime(),
      google: z.object({
        reviewCount: z.number().int().min(0).max(5),
        topTerms: z.array(z.object({ term: z.string(), mentions: z.number().int(), reviews: z.number().int() })).max(5),
      }),
      tripadvisor: z.object({
        locationId: z.string(),
        url: z.url().or(z.literal('')),
        reviewCount: z.number().int().min(0).max(5),
        topTerms: z.array(z.object({ term: z.string(), mentions: z.number().int(), reviews: z.number().int() })).max(5),
      }).nullable(),
      notice: z.string(),
    }).optional(),
    googleMapsUri: z.url().or(z.literal('')).default(''),
    googlePlaceId: z.string().default(''),
    photos: z.array(z.object({
      path: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      attribution: z.object({ displayName: z.string(), uri: z.url().or(z.literal('')) }),
    })).default([]),
    rating: z.number().min(0).max(5).nullable(),
    ratingCount: z.number().int().min(0).default(0),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    verified: z.boolean().default(false),
    status: publicationStatus,
    sample: z.boolean().default(false),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.enum(['food', 'diving', 'beaches', 'day-trips', 'first-visit', 'snorkelling', 'biodiversity', 'recreation']),
    barangay: barangay.optional(),
    relatedBusinesses: z.array(z.string()).default([]),
    readingMinutes: z.number().int().min(1),
    reviewStatus: z.enum(['local-review-draft', 'locally-reviewed']).default('local-review-draft'),
    sources: z.array(z.object({
      title: z.string(),
      publisher: z.string(),
      url: z.url(),
    })).min(1).max(6),
    publishedAt: z.coerce.date(),
    status: publicationStatus,
  }),
});

const living = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/living' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    category: z.enum(['moving', 'cost-of-living', 'internet', 'renting', 'healthcare']),
    barangay: barangay.optional(),
    readingMinutes: z.number().int().min(1),
    reviewStatus: z.enum(['local-review-draft', 'locally-reviewed']).default('local-review-draft'),
    sources: z.array(z.object({
      title: z.string(),
      publisher: z.string(),
      url: z.url(),
    })).min(1).max(6),
    updatedAt: z.coerce.date(),
    status: publicationStatus,
  }),
});

const organizations = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/organizations' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    summary: z.string(),
    category: z.string(),
    barangay,
    contact: z.object({
      email: z.string().default(''),
      phone: z.string().default(''),
      website: z.url().or(z.literal('')).default(''),
      facebook: z.url().or(z.literal('')).default(''),
      instagram: z.url().or(z.literal('')).default(''),
    }),
    sourceUrl: z.url(),
    verifiedAt: z.coerce.date(),
    status: publicationStatus,
  }),
});

const volunteer = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/volunteer' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    organization: z.string(),
    summary: z.string(),
    category: z.string(),
    barangay,
    commitment: z.string(),
    schedule: z.string(),
    skillsRequired: z.array(z.string()).default([]),
    howToHelp: z.array(z.string()).min(1),
    sourceUrl: z.url(),
    contactUrl: z.url(),
    verifiedAt: z.coerce.date(),
    availability: z.enum(['active', 'recurring-contact-first', 'seasonal-contact-first']),
    status: publicationStatus,
  }),
});

const stories = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/stories' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    summary: z.string(),
    type: z.enum(['people', 'places', 'history', 'community', 'local-business']),
    barangay: barangay.optional(),
    readingMinutes: z.number().int().min(1),
    featured: z.boolean().default(false),
    reviewStatus: z.enum(['research-draft', 'locally-reviewed']).default('research-draft'),
    sources: z.array(z.object({
      title: z.string(),
      publisher: z.string(),
      url: z.url(),
    })).min(1),
    photos: z.array(z.object({
      path: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      attribution: z.object({ displayName: z.string(), uri: z.url().or(z.literal('')) }),
      license: z.string(),
      source: z.url(),
    })).default([]),
    publishedAt: z.coerce.date(),
    status: publicationStatus,
  }),
});

export const collections = { businesses, guides, living, organizations, volunteer, stories };
