import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET() {
  const rows = await sql`SELECT key, value FROM app_settings`;
  return NextResponse.json({ settings: Object.fromEntries(rows.map(r => [r.key, r.value])) });
}

export async function POST(req: Request) {
  const body = await req.json();
  for (const [key, value] of Object.entries(body || {})) {
    await sql`INSERT INTO app_settings (key, value) VALUES (${key}, ${sql.json(value as any)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
  }
  return NextResponse.json({ ok: true });
}
