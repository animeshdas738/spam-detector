import type { APIRoute } from 'astro';
import { createDb } from '../../lib/db';

interface ContactBody {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  _hp?: string; // honeypot
}

export const POST: APIRoute = async ({ request, locals }) => {
  const headers = { 'Content-Type': 'application/json' };

  let body: ContactBody;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400, headers });
  }

  // Honeypot — bots fill this, humans don't
  if (body._hp) {
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  }

  const { name, email, subject, message } = body;

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return new Response(JSON.stringify({ error: 'Name, email, and message are required.' }), { status: 400, headers });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(JSON.stringify({ error: 'Please enter a valid email address.' }), { status: 400, headers });
  }

  if (message.trim().length < 10) {
    return new Response(JSON.stringify({ error: 'Message must be at least 10 characters.' }), { status: 400, headers });
  }

  const dbUrl = locals.runtime?.env?.DATABASE_URL || import.meta.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[contact] DATABASE_URL not configured');
    return new Response(JSON.stringify({ error: 'Service unavailable.' }), { status: 503, headers });
  }

  const userAgent = request.headers.get('user-agent') ?? null;
  const ipAddress = request.headers.get('cf-connecting-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    ?? null;

  const sql = createDb(dbUrl);
  try {
    await sql`
      INSERT INTO spampishing.contact_messages (name, email, subject, message, user_agent, ip_address)
      VALUES (
        ${name.trim()},
        ${email.trim()},
        ${subject?.trim() || null},
        ${message.trim()},
        ${userAgent},
        ${ipAddress}
      )
    `;
  } catch (err) {
    console.error('[contact] DB error:', err);
    return new Response(JSON.stringify({ error: 'Failed to save message.' }), { status: 500, headers });
  } finally {
    await sql.end();
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
