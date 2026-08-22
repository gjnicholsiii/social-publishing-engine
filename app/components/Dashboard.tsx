'use client';

import { useEffect, useMemo, useState } from 'react';

type Post = { id: string; platform: string; body: string; status: string; scheduled_for?: string; error?: string };
type Content = { id: string; body: string; title?: string; status: string; created_at: string };
type Channel = { id: string; name: string; displayName?: string; service: string };

const platformLabel: Record<string,string> = { threads: 'Threads', linkedin: 'LinkedIn', substack: 'Substack Note' };
const laneLabel: Record<string,string> = { books: 'Books / Writing', blackvane: 'Blackvane', '2081': '2081' };

export default function Dashboard() {
  const [tab, setTab] = useState<'queue'|'inbox'|'settings'>('queue');
  const [posts, setPosts] = useState<Post[]>([]);
  const [items, setItems] = useState<Content[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [map, setMap] = useState<Record<string,string>>({});
  const [capture, setCapture] = useState('');
  const [lane, setLane] = useState('books');
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    const [p, c, s] = await Promise.all([fetch('/api/posts').then(r=>r.json()), fetch('/api/content').then(r=>r.json()), fetch('/api/settings').then(r=>r.json())]);
    setPosts(p.posts || []); setItems(c.items || []); setMap(s.settings?.channel_map || {});
  }
  useEffect(() => { refresh(); }, []);

  const counts = useMemo(() => ({ draft: posts.filter(p=>p.status==='draft').length, scheduled: posts.filter(p=>p.status==='scheduled').length, inbox: items.filter(i=>i.status==='inbox').length }), [posts,items]);

  async function addCapture() {
    if (!capture.trim()) return;
    setBusy('capture'); setNotice('');
    const r = await fetch('/api/content',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({body:capture,lane})});
    const j = await r.json(); setBusy('');
    if (!r.ok) return setNotice(j.error || 'Could not save');
    setCapture(''); setNotice(`Saved to ${laneLabel[lane]} source inbox.`); refresh();
  }

  async function generateDay() {
    setBusy('generate'); setNotice('');
    const r = await fetch('/api/generate-day',{method:'POST'}); const j = await r.json(); setBusy('');
    if (!r.ok) return setNotice(j.error || 'Generation failed');
    setNotice(`Built ${j.posts?.length || 0} posts from ${j.sourceCount} source item${j.sourceCount===1?'':'s'}.`); setTab('queue'); refresh();
  }

  async function savePost(post: Post, body: string) {
    await fetch('/api/posts',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id:post.id,body})}); refresh();
  }

  async function publishDrafts() {
    const ids = posts.filter(p=>p.status==='draft').map(p=>p.id);
    if (!ids.length) return setNotice('Nothing waiting for approval.');
    setBusy('publish'); setNotice('');
    const r = await fetch('/api/publish',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({ids})}); const j=await r.json(); setBusy('');
    if (!r.ok) return setNotice(j.error || 'Publish failed');
    const failures=(j.results||[]).filter((x:any)=>x.error).length;
    setNotice(failures ? `${j.results.length-failures} queued. ${failures} need attention.` : 'Approved. Threads and LinkedIn are queued in Buffer; Substack Notes are ready to copy.'); refresh();
  }

  async function loadChannels() {
    setBusy('channels'); setNotice(''); const r=await fetch('/api/buffer/channels'); const j=await r.json(); setBusy('');
    if (!r.ok) return setNotice(j.error || 'Could not load Buffer channels'); setChannels(j.channels||[]);
  }

  async function saveMap() {
    await fetch('/api/settings',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({channel_map:map})}); setNotice('Channel mapping saved.');
  }

  return <main>
    <header>
      <div><div className="eyebrow">PUBLISHING ENGINE</div><h1>One thought in.<br/>A day of posts out.</h1></div>
      <button className="primary" onClick={generateDay} disabled={!!busy}>{busy==='generate'?'Writing…':'Generate Day'}</button>
    </header>

    <section className="metrics">
      <div><strong>{counts.inbox}</strong><span>ideas waiting</span></div>
      <div><strong>{counts.draft}</strong><span>posts to approve</span></div>
      <div><strong>{counts.scheduled}</strong><span>scheduled</span></div>
    </section>

    <section className="routingStrip">
      <span><b>LinkedIn</b> 2081 + Blackvane</span>
      <span><b>Substack</b> Books / Writing</span>
      <span><b>Threads</b> Everything</span>
    </section>

    <section className="capture">
      <select value={lane} onChange={e=>setLane(e.target.value)} aria-label="Source lane">
        <option value="books">Books / Writing</option>
        <option value="blackvane">Blackvane</option>
        <option value="2081">2081</option>
      </select>
      <textarea value={capture} onChange={e=>setCapture(e.target.value)} placeholder="Drop a thought, paragraph, quote, rough idea, passage, update, or something worth arguing about…" />
      <button onClick={addCapture} disabled={busy==='capture'}>{busy==='capture'?'Saving…':'Add to Inbox'}</button>
    </section>

    {notice && <div className="notice">{notice}</div>}

    <nav><button className={tab==='queue'?'active':''} onClick={()=>setTab('queue')}>Today’s Queue</button><button className={tab==='inbox'?'active':''} onClick={()=>setTab('inbox')}>Inbox</button><button className={tab==='settings'?'active':''} onClick={()=>setTab('settings')}>Channels</button></nav>

    {tab==='queue' && <section>
      <div className="sectionHead"><h2>Today’s Queue</h2><button className="approve" onClick={publishDrafts} disabled={busy==='publish'}>{busy==='publish'?'Sending…':'Approve Day'}</button></div>
      <div className="queue">
        {posts.length===0 && <div className="empty">Nothing generated yet. Add material above, then hit <b>Generate Day</b>.</div>}
        {posts.map(post=><PostCard key={post.id} post={post} onSave={savePost}/>) }
      </div>
    </section>}

    {tab==='inbox' && <section><div className="sectionHead"><h2>Source Inbox</h2></div><div className="inboxList">{items.map(i=><article key={i.id}><span className={`dot ${i.status}`}></span><div><div className="laneTag">{laneLabel[String(i.title || '').toLowerCase()] || 'Legacy / General'}</div><p>{i.body}</p><small>{i.status} · {new Date(i.created_at).toLocaleString()}</small></div></article>)}</div></section>}

    {tab==='settings' && <section><div className="sectionHead"><h2>Buffer Channels</h2><button onClick={loadChannels}>{busy==='channels'?'Connecting…':'Load My Channels'}</button></div>
      <p className="muted">Map Threads and LinkedIn once here. Substack Notes remain copy-ready.</p>
      <div className="settingsGrid">{['threads','linkedin'].map(platform=><label key={platform}><span>{platformLabel[platform]}</span><select value={map[platform]||''} onChange={e=>setMap({...map,[platform]:e.target.value})}><option value="">Choose channel</option>{channels.filter(c=>c.service===platform).map(c=><option key={c.id} value={c.id}>{c.displayName||c.name}</option>)}</select></label>)}</div>
      <button className="primary small" onClick={saveMap}>Save Mapping</button>
      <div className="substackBox"><b>Substack</b><p>Books and writing sources generate Substack Notes here. They stay “ready” for copy because Substack does not currently expose supported publishing through its developer API.</p></div>
    </section>}

    <footer>Capture once. Route it where it belongs.</footer>
  </main>
}

function PostCard({post,onSave}:{post:Post,onSave:(p:Post,b:string)=>void}) {
  const [body,setBody]=useState(post.body); const [editing,setEditing]=useState(false);
  useEffect(()=>setBody(post.body),[post.body]);
  return <article className="postCard">
    <div className="postMeta"><span className={`platform ${post.platform}`}>{platformLabel[post.platform]||post.platform}</span><span>{post.scheduled_for ? new Date(post.scheduled_for).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}) : 'Unscheduled'}</span><span className={`status ${post.status}`}>{post.status.replace('_',' ')}</span></div>
    {editing ? <textarea className="editArea" value={body} onChange={e=>setBody(e.target.value)} /> : <p>{post.body}</p>}
    {post.error && <div className="error">{post.error}</div>}
    <div className="cardActions"><button onClick={()=>{if(editing) onSave(post,body); setEditing(!editing)}}>{editing?'Save':'Edit'}</button>{post.platform==='substack' && <button onClick={()=>navigator.clipboard.writeText(post.body)}>Copy</button>}</div>
  </article>
}
