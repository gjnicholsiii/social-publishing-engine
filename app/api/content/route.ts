import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

const LANES = new Set(['books', 'blackvane', '2081']);

export async function GET() {
  const items = await sql`SELECT * FROM content_items ORDER BY created_at DESC LIMIT 100`;
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json();
  const text = String(body.body || '').trim();
  if (!text) return NextResponse.json({ error: 'Write or paste something first.' }, { status: 400 });

  const requestedLane = String(body.lane || body.title || 'books').toLowerCase();
  const lane = LANES.has(requestedLane) ? requestedLane : 'books';

  const [item] = await sql`
    INSERT INTO content_items (source_type, title, body, source_url)
    VALUES (${body.sourceType || 'thought'}, ${lane}, ${text}, ${body.sourceUrl || null})
    RETURNING *`;
  return NextResponse.json({ item }, { status: 201 });
}
