import type { APIRoute } from 'astro';

const BASE = 'https://home.spampishing.com';

// lastmod = date content was last meaningfully updated
const PAGES = [
  { loc: '/',        priority: '1.0', changefreq: 'weekly',  lastmod: '2025-06-01' },
  { loc: '/contact', priority: '0.7', changefreq: 'monthly', lastmod: '2025-06-01' },
  { loc: '/privacy', priority: '0.4', changefreq: 'yearly',  lastmod: '2025-06-01' },
  { loc: '/terms',   priority: '0.4', changefreq: 'yearly',  lastmod: '2025-06-01' },
];

export const GET: APIRoute = () => {
  const urls = PAGES.map(
    ({ loc, priority, changefreq, lastmod }) =>
      `  <url>\n    <loc>${BASE}${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
};
