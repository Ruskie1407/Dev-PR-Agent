// app/dashboard/DashboardClient.tsx
"use client";

import React, { useState } from "react";

export default function DashboardClient() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<string[]>([]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;

    setLog((l) => [...l, `You: ${text}`]);
    setInput("");

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: text }),
      });

      const data = await res.json().catch(() => ({} as any));
      const reply = (data as any)?.reply ?? (res.ok ? "OK" : `Error ${res.status}`);
      setLog((l) => [...l, `Agent: ${reply}`]);
    } catch {
      setLog((l) => [...l, `Agent: network error`]);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "32px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1>Dev PR Agent — Dashboard</h1>

      <form onSubmit={send} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command… (/status) or say Hello"
          style={{ flex: 1, padding: 10 }}
        />
        <button type="submit">Send</button>
      </form>

      <pre style={{ whiteSpace: "pre-wrap", background: "#f6f6f6", padding: 12, marginTop: 16 }}>
        {log.join("\n")}
      </pre>

      <p style={{ color: "#666", marginTop: 8 }}>
        Tip: Messages starting with <code>/</code> are treated as commands. Others get small-talk.
      </p>
    </main>
  );
}
