import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: process.env.SITE_URL || 'https://noado.kr', // Change this to your domain
  integrations: [sitemap()],
  markdown: {
    shikiConfig: {
      theme: 'one-dark-pro',
    },
  },
});
// Note: SITE_URL env can be set in deployment (e.g. Cloudflare / Vercel)
