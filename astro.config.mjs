import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://spamdetector.app',
  output: 'server',
  adapter: cloudflare({
    platformProxy: { enabled: true }, // enables Cloudflare bindings in `astro dev`
  }),
  vite: {
    plugins: [tailwindcss()],
    // Required: Cloudflare Workers uses the browser-compatible bundle of packages
    resolve: {
      alias: { 'node:buffer': 'buffer/' },
    },
  },
});
