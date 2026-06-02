import type { APIRoute } from 'astro';
import Anthropic from '@anthropic-ai/sdk';

// Stable system prompt — cached on first request, reused on subsequent ones
const SYSTEM_PROMPT = `You are an expert spam detection system. Analyze the provided content and determine if it is spam.

Your analysis must be precise and consider:
- Phishing indicators: urgency language, suspicious links, impersonation, credential requests
- Spam patterns: excessive promotions, too-good-to-be-true offers, lottery/prize scams
- Malicious URLs: suspicious domains, URL shorteners hiding destinations, typosquatting
- Comment spam: keyword stuffing, irrelevant links, bot-like patterns, excessive self-promotion

Always respond with a valid JSON object — no prose before or after — in exactly this shape:
{
  "isSpam": boolean,
  "score": number,
  "explanation": string,
  "indicators": string[]
}

Where:
- isSpam: true if spam probability >= 50
- score: 0–100 (0 = definitely clean, 100 = definitely spam)
- explanation: 2–4 sentences describing your reasoning
- indicators: specific spam signals found (empty array if none)`;

type DetectionType = 'email' | 'url' | 'comment';

interface DetectionResult {
  isSpam: boolean;
  score: number;
  explanation: string;
  indicators: string[];
}

function buildPrompt(type: DetectionType, content: string): string {
  const prefix: Record<DetectionType, string> = {
    email: 'Analyze this email or text message for spam and phishing:',
    url: 'Analyze this URL for spam, phishing, or malicious indicators:',
    comment: 'Analyze this user comment or form submission for spam:',
  };
  return `${prefix[type]}\n\n${content}`;
}

export const POST: APIRoute = async ({ request }) => {
  const headers = { 'Content-Type': 'application/json' };

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

  if (!['email', 'url', 'comment'].includes(type)) {
    return new Response(JSON.stringify({ error: 'type must be one of: email, url, comment' }), {
      status: 400,
      headers,
    });
  }

  const client = new Anthropic({ apiKey: import.meta.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      // System prompt with cache_control — the large stable prefix is cached
      // after the first request, cutting cost ~90% on subsequent calls
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: buildPrompt(type as DetectionType, content.trim()),
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    // Claude is instructed to return raw JSON — parse it directly
    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response');
    }

    const result: DetectionResult = JSON.parse(jsonMatch[0]);

    // Clamp score to valid range
    result.score = Math.max(0, Math.min(100, Math.round(result.score)));

    return new Response(JSON.stringify(result), { status: 200, headers });
  } catch (err) {
    console.error('[detect] Claude API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return new Response(JSON.stringify({ error: `Detection failed: ${message}` }), {
      status: 500,
      headers,
    });
  }
};
