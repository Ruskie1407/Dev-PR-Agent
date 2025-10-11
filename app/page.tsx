'use client';

import * as React from 'react';

type Msg = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  expanded?: boolean;
};

export default function Chat() {
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

  // --- Short memory: load once ---
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('devpr_chat');
      if (saved) {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) setMessages(arr);
      }
    } catch {}
  }, []);

  // --- Short memory: save on change ---
  React.useEffect(() => {
    try {
      localStorage.setItem('devpr_chat', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);

    const id = (globalThis.crypto?.randomUUID?.() ?? String(Date.now()));
    setMessages(m => [...m, { id, role: 'user', text }]);

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: text })
      });

      let data: any = null;
      try { data = await res.json(); } catch {}
      let reply =
        (data && (data.reply || data.output || data.text)) ||
        (await res.text()).trim() ||
        'Sorry, no reply.';

      if (typeof reply !== 'string') reply = JSON.stringify(reply);

      setMessages(m => [...m, { id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now()+1)), role: 'agent', text: reply }]);
    } catch (e: any) {
      setMessages(m => [...m, { id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now()+2)), role: 'agent', text: `Error: ${e?.message || e}` }]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = input;
    setInput('');
    send(t);
  }

  return (
    <main className="min-h-[100svh] flex flex-col items-center p-4 md:p-6 font-[system-ui] bg-gray-50">
      <div className="w-full max-w-4xl">
        <header className="mb-3">
          <h1 className="text-2xl font-semibold">Dev PR Agent</h1>
          <p className="text-sm text-gray-600">Demo chat (short memory, centered input).</p>
        </header>

        <div
          ref={scrollRef}
          className="rounded-2xl border bg-white p-4 space-y-4 overflow-y-auto"
          style={{ maxHeight: 'calc(100svh - 220px)' }}
          aria-label="Chat history"
        >
          {messages.map(m => (
            <div
              key={m.id}
              className={`rounded-xl px-3 py-2 ${m.role === 'user' ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border'}`}
            >
              <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                {m.role === 'user' ? 'You' : 'Agent'}
              </div>
              <p className="whitespace-pre-wrap">{m.text}</p>
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="mt-5 flex items-center justify-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask for 5 short ideas for BrightScheduler…"
            className="w-full max-w-2xl rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            aria-label="Message input"
          />
          <button
            type="button"
            onClick={() => { try { localStorage.removeItem('devpr_chat'); } catch {}; setMessages(ms => ms.slice(0, 1)); }}
            className="rounded-xl px-4 py-3 border bg-white"
            disabled={busy}
            aria-label="Clear chat history"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-xl px-5 py-3 bg-blue-600 text-white disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send'}
          </button>
        </form>
      </div>
    </main>
  );
}
