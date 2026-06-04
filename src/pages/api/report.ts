import type { APIRoute } from 'astro';
import { createDb } from '../../lib/db';

interface ReportBody {
  issue_type?: string;
  description?: string;
  page_url?: string;
  user_agent?: string;
  browser_language?: string;
  screen_resolution?: string;
  viewport_size?: string;
  timezone?: string;
  platform?: string;
  referrer?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  const headers = { 'Content-Type': 'application/json' };

  const dbUrl = locals.runtime?.env?.DATABASE_URL || import.meta.env.DATABASE_URL;
  if (!dbUrl) {
    return new Response(JSON.stringify({ error: 'Database not configured.' }), { status: 503, headers });
  }

  let body: ReportBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400, headers });
  }

  const { issue_type, description } = body;
  if (!issue_type?.trim() || !description?.trim()) {
    return new Response(
      JSON.stringify({ error: 'issue_type and description are required.' }),
      { status: 400, headers },
    );
  }

  if (description.length > 5000) {
    return new Response(
      JSON.stringify({ error: 'Description must be under 5000 characters.' }),
      { status: 400, headers },
    );
  }

  const sql = createDb(dbUrl);
  try {
    await sql`
      INSERT INTO spampishing.reported_issues (
        issue_type, description, page_url,
        user_agent, browser_language, screen_resolution,
        viewport_size, timezone, platform, referrer
      ) VALUES (
        ${issue_type.trim()},
        ${description.trim()},
        ${body.page_url ?? null},
        ${body.user_agent ?? null},
        ${body.browser_language ?? null},
        ${body.screen_resolution ?? null},
        ${body.viewport_size ?? null},
        ${body.timezone ?? null},
        ${body.platform ?? null},
        ${body.referrer ?? null}
      )
    `;
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (err) {
    console.error('[report] DB error:', err);
    return new Response(JSON.stringify({ error: 'Failed to save report.' }), { status: 500, headers });
  } finally {
    await sql.end();
  }
};
