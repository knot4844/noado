import { defineCollection, z } from 'astro:content';

const postsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.string(),
    updated: z.string().optional(),
    category: z.string(),
    image: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
});

export const collections = {
  'posts': postsCollection,
};
