import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { sql } from '@/lib/db';
import { DEFAULT_SLOTS, slotForToday } from '@/lib/schedule';

const voice = `Write like a human writer, not a social-media assistant. Clear, intelligent, colloquial when useful, occasionally severe or funny. Paragraphs, not fake-poetic line breaks. No emojis unless source material genuinely calls for one. No em dashes. Avoid canned hooks, leadership clichés, engagement bait, hashtag piles, "here are 5 lessons," or tidy self-help conclusions. Preserve tension. Do not invent autobiographical facts. Keep the core idea intact while making each post native to its platform.`;

function parseJson(text: string) {
  const stripped = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(stripped);
}

export async function POST() {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 503 });
  const sources = await sql`SELECT id, title, body, source_url FROM content_items WHERE status = 'inbox' ORDER BY created_at DESC LIMIT 8`;
  if (!sources.length) return NextResponse.json({ error: 'Your inbox is empty. Add a thought, passage, quote, or link first.' }, { status: 400 });

  const sourceText = sources.map((s, i) => `SOURCE ${i + 1}${s.title ? ` — ${s.title}` : ''}\n${s.body}${s.source_url ? `\nURL: ${s.source_url}` : ''}`).join('\n\n');
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6',
    instructions: voice,
    input: `Turn the source material into one day's publishing queue. Return ONLY valid JSON using this exact shape: {"threads":["","",""],"linkedin":[""],"substack":["","",""]}. Threads should be concise and conversational, with three genuinely different angles. LinkedIn should be an argument with substance, not corporate inspiration. Substack means Substack Notes: writerly, compact, and worth responding to. Do not duplicate wording across platforms. Do not refer to "the source".\n\n${sourceText}`,
  });

  let generated: Record<string, string[]>;
  try { generated = parseJson(response.output_text); }
  catch { return NextResponse.json({ error: 'The generator returned malformed output. Try again.' }, { status: 502 }); }

  const created: any[] = [];
  for (const platform of ['threads', 'linkedin', 'substack']) {
    const posts = Array.isArray(generated[platform]) ? generated[platform] : [];
    for (let i = 0; i < Math.min(posts.length, DEFAULT_SLOTS[platform].length); i++) {
      const text = String(posts[i] || '').trim();
      if (!text) continue;
      const [row] = await sql`
        INSERT INTO generated_posts (platform, body, status, scheduled_for)
        VALUES (${platform}, ${text}, 'draft', ${slotForToday(DEFAULT_SLOTS[platform][i])})
        RETURNING *`;
      created.push(row);
    }
  }
  await sql`UPDATE content_items SET status = 'used', updated_at = now() WHERE id = ANY(${sources.map(s => s.id)}::uuid[])`;
  return NextResponse.json({ posts: created, sourceCount: sources.length });
}
