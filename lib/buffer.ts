const ENDPOINT = 'https://api.buffer.com';

async function gql(query: string) {
  const token = process.env.BUFFER_API_KEY;
  if (!token) throw new Error('BUFFER_API_KEY is not configured');
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || json.errors?.length) {
    throw new Error(json.errors?.[0]?.message || `Buffer request failed (${res.status})`);
  }
  return json.data;
}

export async function getBufferOrganizations() {
  const data = await gql(`query { account { organizations { id name } } }`);
  return data.account.organizations as Array<{ id: string; name: string }>;
}

export async function getBufferChannels(organizationId: string) {
  const safe = JSON.stringify(organizationId);
  const data = await gql(`query { channels(input: { organizationId: ${safe} }) { id name displayName service avatar isQueuePaused } }`);
  return data.channels as Array<{ id: string; name: string; displayName?: string; service: string; avatar?: string; isQueuePaused?: boolean }>;
}

export async function createBufferPost(channelId: string, text: string, dueAt?: string | null) {
  const safeText = JSON.stringify(text);
  const safeChannel = JSON.stringify(channelId);
  const mode = dueAt ? `customScheduled, dueAt: ${JSON.stringify(dueAt)}` : 'addToQueue';
  const data = await gql(`mutation { createPost(input: { text: ${safeText}, channelId: ${safeChannel}, schedulingType: automatic, mode: ${mode} }) { ... on PostActionSuccess { post { id text dueAt } } ... on MutationError { message } } }`);
  if (data.createPost?.message) throw new Error(data.createPost.message);
  if (!data.createPost?.post?.id) throw new Error('Buffer did not return a post ID');
  return data.createPost.post as { id: string; text: string; dueAt?: string };
}
