import { getEvents } from "@/lib/state";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const events = getEvents();
  const ok = {
    WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET,
    GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
  };

  return (
    <main style={{padding:24, fontFamily:"system-ui", maxWidth:900, margin:"0 auto"}}>
      <h1 style={{marginBottom:8}}>Dev PR Agent — Dashboard</h1>
      <p style={{opacity:.7, marginTop:0}}>Webhook health & recent events</p>

      <section style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))", gap:12, margin:"16px 0"}}>
        <div style={{border:"1px solid #ddd", borderRadius:12, padding:16}}>
          <div style={{fontSize:12, opacity:.7}}>Env</div>
          <div>WEBHOOK_SECRET: <b style={{color: ok.WEBHOOK_SECRET ? "green":"crimson"}}>{String(ok.WEBHOOK_SECRET)}</b></div>
          <div>GITHUB_TOKEN: <b style={{color: ok.GITHUB_TOKEN ? "green":"crimson"}}>{String(ok.GITHUB_TOKEN)}</b></div>
        </div>
        <a href="/api/status" style={{textDecoration:"none", color:"inherit"}}>
          <div style={{border:"1px solid #ddd", borderRadius:12, padding:16}}>
            <div style={{fontSize:12, opacity:.7}}>API</div>
            <div><b>/api/status</b> (JSON)</div>
          </div>
        </a>
        <a href="/api/webhook" style={{textDecoration:"none", color:"inherit"}}>
          <div style={{border:"1px solid #ddd", borderRadius:12, padding:16}}>
            <div style={{fontSize:12, opacity:.7}}>Webhook</div>
            <div><b>/api/webhook</b> (GET = 405)</div>
          </div>
        </a>
      </section>

      <h3 style={{marginTop:16}}>Recent events</h3>
      {events.length === 0 ? (
        <p style={{opacity:.7}}>No events yet — open a PR or post a comment mentioning <code>dev-pr-agent</code>.</p>
      ) : (
        <ul style={{listStyle:"none", padding:0, margin:0, display:"grid", gap:10}}>
          {events.map((e, i) => (
            <li key={i} style={{border:"1px solid #eee", borderRadius:12, padding:12}}>
              <div style={{fontSize:12, opacity:.7}}>{e.t}</div>
              <div><b>{e.event}</b> {e.action ? `· ${e.action}` : ""}</div>
              <div style={{opacity:.8}}>{e.repo ? e.repo : ""} {e.pr ? `#${e.pr}` : ""}</div>
              {e.note ? <div style={{opacity:.8}}>{e.note}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
