import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { sql } from '@/lib/db';
import { DEFAULT_SLOTS, slotForToday } from '@/lib/schedule';

const voice = `Write like a human writer, not a social-media assistant. Clear, intelligent, colloquial when useful, occasionally severe or funny. Paragraphs, not fake-poetic line breaks. No emojis unless source material genuinely calls for one. No em dashes. Avoid canned hooks, leadership clichés, engagement bait, hashtag piles, "here are 5 lessons," or tidy self-help conclusions. Preserve tension. Do not invent autobiographical facts. Keep the core idea intact.`;

type Source = { id: string; title?: string | null; body: string; source_url?: string | null };

function sourceText(sources: Source[]) {
  return sources.map((s, i) => `SOURCE ${i + 1}\n${s.body}${s.source_url ? `\nURL: ${s.source_url}` : ''}`).join('\n\n');
}

function parseArray(text: string) {
  const stripped = text.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  const parsed = JSON.parse(stripped);
  if (!Array.isArray(parsed)) throw new Error('Expected array');
  return parsed.map(x => String(x || '').trim()).filter(Boolean);
}

async function generate(client: OpenAI, platform: 'threads'|'linkedin'|'substack', sources: Source[]) {
  if (!sources.length) return [];

  const instructions: Record<string, string> = {
    threads: `Create exactly 3 Threads posts. Threads may draw from Books/Writing, Blackvane, and 2081 material. Make the three posts genuinely different in angle and phrasing. Keep them concise, conversational, sharp, and worth replying to. They can be literary, cultural, business-minded, mission-driven, or provocative depending on the source. Do not force brand mentions. Return ONLY a valid JSON array of 3 strings.`,
    linkedin: `Create exactly 1 LinkedIn post using ONLY the supplied 2081 and/or Blackvane material. Never use book promotion or literary material here unless the supplied Blackvane/2081 source itself makes that relevant. For Blackvane, write substantive observations about organizational diagnostics, revenue, retention, execution, leadership, or the actual business issue in the source. For 2081, write about the veteran mission, impact, service, fundraising, community, or the actual nonprofit issue in the source. If both brands are present, choose the strongest single argument; do not blur the brands together. Avoid corporate inspiration and generic leadership language. Return ONLY a valid JSON array containing 1 string.`,
    substack: `Create exactly 3 Substack Notes using ONLY the supplied Books/Writing material. These should support the books and the writing without turning every Note into an advertisement. Use themes, lines, ideas, tensions, excerpts, behind-the-work observations, questions, or provocations supported by the source. Mention a book title when the source gives you one and it helps. Writerly, compact, human, and worth responding to. Return ONLY a valid JSON array of 3 strings.`,
  };

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || 'gpt-5.6',
    instructions: `${voice}\n\n${instructions[platform]}`,
    input: sourceText(sources),
  });

  return parseArray(response.output_text);
}

export async function POST() {
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY is not configured.' }, { status: 503 });

  const sources = await sql<Source[]>`SELECT id, title, body, source_url FROM content_items WHERE status = 'inbox' ORDER BY created_at DESC LIMIT 12`;
  if (!sources.length) return NextResponse.json({ error: 'Your inbox is empty. Add something first.' }, { status: 400 });

  const lane = (s: Source) => String(s.title || '').toLowerCase();
  const linkedinSources = sources.filter(s => lane(s) === '2081' || lane(s) === 'blackvane');
  const substackSources = sources.filter(s => lane(s) === 'books');
  const threadSources = sources;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  let generated: Record<string, string[]>;
  try {
    const [threads, linkedin, substack] = await Promise.all([
      generate(client, 'threads', threadSources),
      generate(client, 'linkedin', linkedinSources),
      generate(client, 'substack', substackSources),
    ]);
    generated = { threads, linkedin, substack };
  } catch {
    return NextResponse.json({ error: 'The generator returned malformed output. Try again.' }, { status: 502 });
  }

  const created: any[] = [];
  for (const platform of ['threads', 'linkedin', 'substack']) {
    const posts = generated[platform] || [];
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

  return NextResponse.json({
    posts: created,
    sourceCount: sources.length,
    lanes: {
      threads: threadSources.length,
      linkedin: linkedinSources.length,
      substack: substackSources.length,
    },
  });
}
