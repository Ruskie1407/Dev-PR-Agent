"use client";
import * as React from "react";

type Msg = { role: "you" | "agent"; text: string };

export default function Home() {
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [msgs, setMsgs] = React.useState<Msg[]>([
    { role: "agent", text: "Hi! I’m your Dev PR Agent. Ask me anything." },
  ]);

  async function send(text: string) {
    if (!text.trim()) return;
    setMsgs(m => [...m, { role: "you", text }]);
    setBusy(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      const data = await res.json().catch(() => ({}));
      const reply = data.reply || data.message || data.text || (res.ok ? "OK" : `Error ${res.status}`);
      setMsgs(m => [...m, { role: "agent", text: String(reply) }]);
    } catch (e: any) {
      setMsgs(m => [...m, { role: "agent", text: "Network error." }]);
    } finally {
      setBusy(false);
      setInput("");
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    send(input);
  }

  return (
    <main style={{
      minHeight:"100svh", display:"grid", placeItems:"center",
      background:"#0b1020", color:"#e6e8ef", padding:"24px"
    }}>
      <div style={{
        width:"min(900px, 92vw)",
        display:"grid",
        gridTemplateRows:"auto 1fr auto",
        gap:"16px",
        background:"rgba(255,255,255,0.04)",
        border:"1px solid rgba(255,255,255,0.08)",
        borderRadius:"18px",
        boxShadow:"0 10px 40px rgba(0,0,0,0.35)",
        padding:"20px 18px",
        maxHeight:"85svh"
      }}>
        <header style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <h1 style={{margin:0, fontSize:24, letterSpacing:0.2}}>Dev PR Agent</h1>
          <div style={{opacity:0.7, fontSize:14}}>{busy ? "Thinking…" : "Ready"}</div>
        </header>

        <section style={{
          overflowY:"auto", padding:"8px", borderRadius:12,
          background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)"
        }}>
          {msgs.map((m, i) => (
            <div key={i} style={{
              margin:"10px 0", display:"flex",
              justifyContent: m.role === "you" ? "flex-end" : "flex-start"
            }}>
              <div style={{
                maxWidth:"85%", whiteSpace:"pre-wrap", lineHeight:1.5,
                fontSize:16,
                background: m.role === "you" ? "rgba(64,160,255,0.16)" : "rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.08)",
                padding:"10px 12px", borderRadius:12
              }}>
                {m.text}
              </div>
            </div>
          ))}
        </section>

        <form onSubmit={onSubmit} style={{display:"grid", gap:10, gridTemplateColumns:"1fr auto"}}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type here and press Enter (Shift+Enter for newline)…"
            rows={3}
            style={{
              width:"100%", resize:"vertical", fontSize:16,
              borderRadius:12, border:"1px solid rgba(255,255,255,0.12)",
              background:"rgba(0,0,0,0.25)", color:"#e6e8ef",
              padding:"10px 12px"
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy) send(input);
              }
            }}
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            style={{
              minWidth:110, borderRadius:12, border:"1px solid rgba(255,255,255,0.12)",
              background: busy ? "rgba(255,255,255,0.15)" : "#1f6feb",
              color:"white", fontSize:16, cursor: busy ? "not-allowed":"pointer"
            }}
            aria-busy={busy}
          >
            {busy ? "Sending…" : "Send"}
          </button>
        </form>
      </div>
    </main>
  );
}
