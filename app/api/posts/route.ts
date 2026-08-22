import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const posts = await sql`SELECT * FROM generated_posts WHERE scheduled_for IS NULL OR scheduled_for > now() - interval '8 hours' ORDER BY scheduled_for ASC NULLS LAST, created_at DESC LIMIT 200`;
  return NextResponse.json({ posts });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: 'Missing post id' }, { status: 400 });
  const [post] = await sql`
    UPDATE generated_posts
    SET body = COALESCE(${body.body ?? null}, body),
        status = COALESCE(${body.status ?? null}, status),
        scheduled_for = COALESCE(${body.scheduledFor ?? null}, scheduled_for),
        updated_at = now()
    WHERE id = ${body.id}
    RETURNING *`;
  return NextResponse.json({ post });
}
