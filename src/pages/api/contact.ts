import type { APIRoute } from 'astro';

interface ContactBody {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
  _hp?: string; // honeypot
}

export const POST: APIRoute = async ({ request }) => {
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

  // TODO: integrate an email provider (Resend, SendGrid, Nodemailer) here.
  // Example with Resend:
  //   const resend = new Resend(import.meta.env.RESEND_API_KEY);
  //   await resend.emails.send({ from: 'noreply@spamdetector.app', to: 'hello@spamdetector.app',
  //     subject: `Contact: ${subject}`, text: `From: ${name} <${email}>\n\n${message}` });

  console.log('[contact] New message from', name, email, '|', subject);

  return new Response(JSON.stringify({ success: true }), { status: 200, headers });
};
