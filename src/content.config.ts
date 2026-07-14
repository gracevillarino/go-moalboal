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
    googleMapsUri: z.url().or(z.literal('')).default(''),
    googlePlaceId: z.string().default(''),
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
    barangay: barangay.optional(),
    relatedBusinesses: z.array(z.string()).default([]),
    publishedAt: z.coerce.date(),
    status: publicationStatus,
  }),
});

const living = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/living' }),
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    barangay: barangay.optional(),
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
    contact: z.object({ email: z.string().default(''), facebook: z.string().default('') }),
    status: publicationStatus,
  }),
});

const volunteer = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/volunteer' }),
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    organization: z.string(),
    category: z.string(),
    barangay,
    commitment: z.string(),
    skillsRequired: z.array(z.string()).default([]),
    howToHelp: z.array(z.string()).min(1),
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
    publishedAt: z.coerce.date(),
    status: publicationStatus,
  }),
});

export const collections = { businesses, guides, living, organizations, volunteer, stories };
