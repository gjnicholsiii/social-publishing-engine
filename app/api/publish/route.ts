import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { createBufferPost } from '@/lib/buffer';

export async function POST(req: Request) {
  const body = await req.json();
  const ids: string[] = Array.isArray(body.ids) ? body.ids : body.id ? [body.id] : [];
  if (!ids.length) return NextResponse.json({ error: 'No posts selected' }, { status: 400 });
  const rows = await sql`SELECT * FROM generated_posts WHERE id = ANY(${ids}::uuid[]) ORDER BY scheduled_for ASC`;
  const settingRows = await sql`SELECT key, value FROM app_settings WHERE key = 'channel_map'`;
  const channelMap = settingRows[0]?.value || {};
  const results: any[] = [];

  for (const post of rows) {
    if (post.platform === 'substack') {
      const [updated] = await sql`UPDATE generated_posts SET status = 'ready_substack', updated_at = now() WHERE id = ${post.id} RETURNING *`;
      results.push({ id: post.id, platform: post.platform, status: updated.status });
      continue;
    }
    const channelId = channelMap[post.platform];
    if (!channelId) {
      await sql`UPDATE generated_posts SET error = ${`No Buffer channel mapped for ${post.platform}`}, updated_at = now() WHERE id = ${post.id}`;
      results.push({ id: post.id, platform: post.platform, error: 'Channel not mapped' });
      continue;
    }
    try {
      const sent = await createBufferPost(channelId, post.body, post.scheduled_for ? new Date(post.scheduled_for).toISOString() : null);
      await sql`UPDATE generated_posts SET status = 'scheduled', buffer_post_id = ${sent.id}, error = null, updated_at = now() WHERE id = ${post.id}`;
      results.push({ id: post.id, platform: post.platform, status: 'scheduled', bufferPostId: sent.id });
    } catch (e: any) {
      const message = e.message || 'Publish failed';
      await sql`UPDATE generated_posts SET error = ${message}, updated_at = now() WHERE id = ${post.id}`;
      results.push({ id: post.id, platform: post.platform, error: message });
    }
  }
  return NextResponse.json({ results });
}
