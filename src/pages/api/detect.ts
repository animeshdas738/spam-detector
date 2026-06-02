import type { APIRoute } from 'astro';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert spam detection system. Analyze the provided content and determine if it is spam.

Your analysis must be precise and consider:
- Phishing indicators: urgency language, suspicious links, impersonation, credential requests
- Spam patterns: excessive promotions, too-good-to-be-true offers, lottery/prize scams
- Malicious URLs: suspicious domains, URL shorteners hiding destinations, typosquatting
- Comment spam: keyword stuffing, irrelevant links, bot-like patterns, excessive self-promotion

Respond with a valid JSON object only — no prose before or after — in exactly this shape:
{
  "isSpam": boolean,
  "score": number,
  "scamType": string | null,
  "explanation": string,
  "indicators": string[],
  "educationalNote": string | null,
  "highlights": [{ "text": string, "type": "urgency" | "link" | "impersonation" }]
}

Field definitions:
- isSpam: true if score >= 50
- score: 0–100 (0 = definitely clean, 100 = definitely spam)
- scamType: short category, e.g. "Advance-Fee Fraud", "Phishing", "Lottery Scam", "Tech Support Scam", "Romance Scam", "Investment Fraud", "Comment Spam", "Malicious URL" — or null if clean
- explanation: 2–4 sentences of reasoning
- indicators: specific spam signals found (empty array if none)
- educationalNote: one actionable sentence on how to avoid this scam type — or null if clean
- highlights: exact verbatim phrases from the input that are spam signals:
    "urgency"       — pressure language, time limits, threats (e.g. "Act NOW", "expires in 24 hours")
    "link"          — suspicious URLs or misleading link text (e.g. "click here", "http://bit.ly/...")
    "impersonation" — fake brand or authority claims (e.g. "PayPal Security Team", "IRS Notice")
  Return empty array for image inputs or when content is clean.`;

type TextType = 'email' | 'url' | 'comment';

interface DetectionResult {
  isSpam: boolean;
  score: number;
  scamType: string | null;
  explanation: string;
  indicators: string[];
  educationalNote: string | null;
  highlights: Array<{ text: string; type: 'urgency' | 'link' | 'impersonation' }>;
}

function buildTextPrompt(type: TextType, content: string): string {
  const prefix: Record<TextType, string> = {
    email:   'Analyze this email or text message for spam and phishing:',
    url:     'Analyze this URL for spam, phishing, or malicious indicators:',
    comment: 'Analyze this user comment or form submission for spam:',
  };
  return `${prefix[type]}\n\n${content}`;
}

const MAX_TEXT_LENGTH  = 10_000;
const MAX_IMAGE_B64    = 5_000_000; // ~3.7 MB raw

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

  const apiKey = import.meta.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured on the server.' }), {
      status: 503,
      headers,
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400, headers });
  }

  const { type, content } = body as { type?: string; content?: string };

  if (!type || !content?.trim()) {
    return new Response(JSON.stringify({ error: 'Missing required fields: type and content' }), {
      status: 400,
      headers,
    });
  }

  if (!['email', 'url', 'comment', 'image'].includes(type)) {
    return new Response(JSON.stringify({ error: 'type must be one of: email, url, comment, image' }), {
      status: 400,
      headers,
    });
  }

  if (type === 'image') {
    if (!content.startsWith('data:image/')) {
      return new Response(JSON.stringify({ error: 'Content must be a valid image data URL.' }), { status: 400, headers });
    }
    if (content.length > MAX_IMAGE_B64) {
      return new Response(JSON.stringify({ error: 'Image is too large. Please use an image under ~3.7 MB.' }), { status: 400, headers });
    }
  } else if (content.length > MAX_TEXT_LENGTH) {
    return new Response(
      JSON.stringify({ error: `Content exceeds maximum length of ${MAX_TEXT_LENGTH.toLocaleString()} characters.` }),
      { status: 400, headers },
    );
  }

  const client = new OpenAI({ apiKey });

  try {
    const userContent = type === 'image'
      ? [
          { type: 'image_url' as const, image_url: { url: content, detail: 'auto' as const } },
          { type: 'text' as const, text: 'Analyze this screenshot for spam, phishing, or scam content.' },
        ]
      : buildTextPrompt(type as TextType, content.trim());

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 512,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: userContent },
      ],
    });

    const text = response.choices[0]?.message?.content;
    if (!text) throw new Error('Empty response from OpenAI');

    const result: DetectionResult = JSON.parse(text);
    result.score = Math.max(0, Math.min(100, Math.round(result.score)));

    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (err) {
    console.error('[detect] OpenAI API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `Detection failed: ${message}` }), {
      status: 500,
      headers,
    });
  }
};
