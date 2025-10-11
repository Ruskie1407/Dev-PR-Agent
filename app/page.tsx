'use client';

import * as React from 'react';

type Msg = { id: string; role: 'user' | 'agent'; text: string };

export default function Dashboard() {
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      id: 'welcome',
      role: 'agent',
      text:
        'Hi! I’m your BrightScheduler demo assistant. Ask for ideas, copy, or quick plans.\n' +
        'Tip: “Give 5 short ideas to improve onboarding for online English teachers.”'
    }
  ]);

  // ---- short memory (localStorage)
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('devpr_chat');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) setMessages(arr);
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    try { localStorage.setItem('devpr_chat', JSON.stringify(messages)); } catch {}
  }, [messages]);

  // ---- auto-scroll inside the chat window
  const boxRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = boxRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);

    const id = crypto.randomUUID?.() ?? String(Date.now());
    setMessages(m => [...m, { id, role: 'user', text }]);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: text })
      });

      // try JSON first, fall back to text
      let reply = '';
      try {
        const j = await res.json();
        reply = (j.reply || j.output || j.text || '') as string;
      } catch {
        reply = await res.text();
      }
      if (!reply) reply = 'OK';

      setMessages(m => [...m, { id: (crypto.randomUUID?.() ?? String(Date.now()+1)), role: 'agent', text: reply }]);
    } catch (e: any) {
      setMessages(m => [...m, { id: (crypto.randomUUID?.() ?? String(Date.now()+2)), role: 'agent', text: `Error: ${e?.message || e}` }]);
    } finally {
      setBusy(false);
    }
  }

  // textarea auto-grow (up to ~6 lines)
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  function autoGrow() {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    const max = 6 * 28; // 6 lines * line-height
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
  }
  React.useEffect(() => { autoGrow(); }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = input;
    setInput('');
    autoGrow();
    send(t);
  }

  return (
    <div className="wrap">
      <h1>Dev PR Agent</h1>
      <p className="subtitle">Demo chat (short memory, centered input).</p>

      {/* Chat window (about half the viewport, scrollable) */}
      <div ref={boxRef} className="chatbox" aria-label="Chat history">
        {messages.map(m => (
          <div key={m.id} className={`msg ${m.role}`}>
            <div className="who">{m.role === 'user' ? 'You' : 'Agent'}</div>
            <div className="bubble">{m.text}</div>
          </div>
        ))}
      </div>

      {/* Input row (kept relatively high on page by putting chat in fixed height) */}
      <form onSubmit={onSubmit} className="inputrow" aria-label="Chat input">
        <textarea
          ref={taRef}
          value={input}
          onChange={e => { setInput(e.target.value); autoGrow(); }}
          placeholder="Ask for 5 short ideas for BrightScheduler…"
          rows={2}
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
        >
          {busy ? 'Sending…' : 'Send'}
        </button>
        <button
          type="button"
          onClick={() => { try { localStorage.removeItem('devpr_chat'); } catch {}; setMessages(ms => ms.slice(0, 1)); }}
          aria-label="Clear chat"
          className="secondary"
          disabled={busy}
        >
          Clear
        </button>
      </form>

      <style jsx global>{`
        /* ~16pt => ~21px base across the page */
        html, body { font-size: 21px; }
        body { margin: 0; background: #fafafa; color: #111; }
      `}</style>
      <style jsx>{`
        .wrap {
          max-width: 960px;
          margin: 40px auto;
          padding: 0 16px;
        }
        h1 { margin: 0 0 8px; font-weight: 700; }
        .subtitle { margin: 0 0 16px; color: #555; }

        .chatbox {
          border: 1px solid #e3e3e3;
          background: #fff;
          border-radius: 16px;
          padding: 14px;
          overflow-y: auto;
          /* Half-page height; won’t grow past this */
          height: min(50vh, 520px);
        }

        .msg { margin: 10px 0; }
        .who {
          font-size: 0.65em;
          text-transform: uppercase;
          letter-spacing: .04em;
          color: #777;
          margin-bottom: 4px;
        }
        .bubble {
          white-space: pre-wrap;
          line-height: 1.35;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #e6e6e6;
          background: #fbfbfb;
        }
        .msg.user .bubble { background: #eef5ff; border-color: #d7e7ff; }

        .inputrow {
          /* Keeps the input visually “higher” by not pushing it to page bottom */
          margin: 14px auto 0;
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 10px;
          align-items: start;
          max-width: 860px;
        }
        textarea {
          width: 100%;
          font: inherit;
          line-height: 28px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #cfd4dc;
          resize: none;            /* we auto-grow instead */
          background: #fff;
          outline: none;
        }
        textarea:focus { border-color: #7fb3ff; box-shadow: 0 0 0 3px rgba(127,179,255,.2); }

        button {
          font: inherit;
          padding: 10px 18px;
          border-radius: 12px;
          border: 1px solid #0b63ff;
          background: #0b63ff;
          color: #fff;
          cursor: pointer;
        }
        button[disabled] { opacity: .55; cursor: default; }
        .secondary {
          background: #fff;
          color: #333;
          border-color: #cfd4dc;
        }
      `}</style>
    </div>
  );
}
