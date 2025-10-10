"use client";
import { useState } from "react";

type Msg = { role: "you" | "agent"; text: string };

export default function AgentConsole() {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "agent", text: "Hi! Type a command like:\n/hello\n/status\n/comment Ruskie1407/Dev-PR-Agent#1 Thanks!\n/review  Ruskie1407/Dev-PR-Agent#1" }
  ]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMsgs(m => [...m, { role: "you", text }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text })
      });
      const data = await res.json();
      setMsgs(m => [...m, { role: "agent", text: data.reply || JSON.stringify(data) }]);
    } catch (err: any) {
      setMsgs(m => [...m, { role: "agent", text: "Error: " + (err?.message || String(err)) }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{maxWidth:800,margin:"40px auto",padding:"0 16px",fontFamily:"system-ui"}}>
      <h1>Dev PR Agent — Console</h1>
      <p>Talk to the agent here. Useful commands:</p>
      <ul style={{lineHeight:"1.6"}}>
        <li><code>/hello</code> — quick check</li>
        <li><code>/status</code> — show env readiness</li>
        <li><code>/comment owner/repo#123 Your message…</code> — post a comment to a PR</li>
        <li><code>/review owner/repo#123</code> — (demo) post a review stub</li>
      </ul>

      <div style={{border:"1px solid #ddd",borderRadius:12,padding:12,marginTop:16,minHeight:200}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{whiteSpace:"pre-wrap",margin:"8px 0"}}>
            <strong>{m.role === "you" ? "You" : "Agent"}:</strong> {m.text}
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} style={{display:"flex",gap:8,marginTop:16}}>
        <input
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Type a command…"
          style={{flex:1,padding:"10px 12px",border:"1px solid #ccc",borderRadius:8}}
        />
        <button disabled={busy} style={{padding:"10px 16px",border:"1px solid #111",borderRadius:8,background:"#111",color:"#fff"}}>
          {busy ? "Working…" : "Send"}
        </button>
      </form>
    </main>
  );
}
