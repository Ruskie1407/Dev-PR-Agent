export const runtime = "nodejs";

async function getStatus() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/status`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function getEvents() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/events`, { cache: "no-store" });
    if (!res.ok) return { events: [] };
    return await res.json();
  } catch { return { events: [] }; }
}

export default async function UpdatesPage() {
  const [status, ev] = await Promise.all([getStatus(), getEvents()]);
  const ok = status?.ok ?? {};
  const events = Array.isArray(ev?.events) ? ev.events : [];

  return (
    <main style={{padding:24, fontFamily:"system-ui"}}>
      <h1 style={{marginBottom:12}}>Dev PR Agent — Updates</h1>

      <section style={{marginBottom:24}}>
        <h2 style={{fontSize:18, margin:"12px 0"}}>Environment & API</h2>
        <div style={{display:"grid", gap:8}}>
          <div>WEBHOOK_SECRET: <b style={{color: ok.WEBHOOK_SECRET ? "green" : "crimson"}}>{String(!!ok.WEBHOOK_SECRET)}</b></div>
          <div>GITHUB_TOKEN: <b style={{color: ok.GITHUB_TOKEN ? "green" : "crimson"}}>{String(!!ok.GITHUB_TOKEN)}</b></div>
          {status?.tokenSource ? <div>Token Source: <code>{status.tokenSource}</code></div> : null}
        </div>
      </section>

      <section>
        <h2 style={{fontSize:18, margin:"12px 0"}}>Recent Events</h2>
        <div style={{maxHeight:"50vh", overflowY:"auto", border:"1px solid #eee", borderRadius:12, padding:12}}>
          {events.length === 0 ? (
            <div style={{opacity:0.7}}>No events yet.</div>
          ) : (
            <ul style={{listStyle:"none", padding:0, margin:0}}>
              {events.map((e:any, i:number) => (
                <li key={i} style={{padding:"8px 0", borderBottom:"1px solid #f0f0f0"}}>
                  <div style={{fontSize:12, opacity:0.7}}>{e.t}</div>
                  <div><b>{e.event}</b> {e.note ? <span>— {e.note}</span> : null}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}
