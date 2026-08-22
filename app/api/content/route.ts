import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const items = await sql`SELECT * FROM content_items ORDER BY created_at DESC LIMIT 100`;
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = await req.json();
  const text = String(body.body || '').trim();
  if (!text) return NextResponse.json({ error: 'Write or paste something first.' }, { status: 400 });
  const [item] = await sql`
    INSERT INTO content_items (source_type, title, body, source_url)
    VALUES (${body.sourceType || 'thought'}, ${body.title || null}, ${text}, ${body.sourceUrl || null})
    RETURNING *`;
  return NextResponse.json({ item }, { status: 201 });
}
