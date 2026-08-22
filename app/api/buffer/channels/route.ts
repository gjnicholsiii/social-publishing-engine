import { NextResponse } from 'next/server';
import { getBufferChannels, getBufferOrganizations } from '@/lib/buffer';

export async function GET() {
  try {
    const organizations = await getBufferOrganizations();
    const org = organizations[0];
    if (!org) return NextResponse.json({ organizations: [], channels: [] });
    const channels = await getBufferChannels(org.id);
    return NextResponse.json({ organizations, organization: org, channels });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Buffer connection failed' }, { status: 502 });
  }
}
