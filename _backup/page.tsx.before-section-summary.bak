'use client';

import React from 'react';

type Msg = {
  id: string;
  role: 'user' | 'agent';
  text: string;
  expanded?: boolean;
};

const LONG_THRESHOLD = 420;          // when to show "Show more"
const SUMMARY_CHARS = 220;           // compact summary length

function summarize(text: string, limit = SUMMARY_CHARS) {
  const t = text.trim().replace(/\s+/g, ' ');
  if (t.length <= limit) return t;
  // try to end at a sentence boundary
  const slice = t.slice(0, limit);
  const dot = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('! '), slice.lastIndexOf('? '));
  return (dot > 80 ? slice.slice(0, dot + 1) : slice) + ' …';
}

/** Naive sectionizer: if the model returns many bullets or headings,
 *  we place them inside <details> to keep things compact. */
function Sectioned({ text }: { text: string }) {
  // split by blank lines into sections
  const blocks = text.split(/\n\s*\n/);
  if (blocks.length < 3) return <p className="whitespace-pre-wrap">{text}</p>;

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        // use the first line as a summary if looks like a heading/bullet
        const first = b.split('\n')[0]?.trim() || `Section ${i+1}`;
        const looksLikeHeading = /^[-*•]|\d+\.\s|#{1,6}\s|[A-Z].+:\s*$/.test(first);
        return (
          <details key={i} className="rounded-xl border p-3">
            <summary className="cursor-pointer select-none">
              {looksLikeHeading ? first.replace(/^#{1,6}\s/, '') : `Section ${i+1}`}
            </summary>
            <div className="mt-2 whitespace-pre-wrap">{b}</div>
          </details>
        );
      })}
    </div>
  );
}

export default function Chat() {
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([
    {
      id: 'hello',
      role: 'agent',
      text:
        'Hi! I’m your BrightScheduler demo assistant. Ask for ideas, copy, or quick plans. ' +
        'Tip: try “Give 5 short ideas to improve onboarding for online English teachers.”'
    }
  ]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // smooth auto-scroll to bottom on new messages
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);

    const userMsg: Msg = { id: crypto.randomUUID(), role: 'user', text };
    setMessages(m => [...m, userMsg]);

    try {
      // The API supports raw text or JSON {input:"..."}; JSON is safer for punctuation.
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: text })
      });

      let data: any = null;
      try { data = await res.json(); } catch { /* ignore */ }

      let reply = (data && (data.reply || data.output || data.text)) || 'Sorry, no reply.';
      // guard against huge blobs
      if (typeof reply !== 'string') reply = JSON.stringify(reply);

      const agentMsg: Msg = {
        id: crypto.randomUUID(),
        role: 'agent',
        text: reply
      };
      setMessages(m => [...m, agentMsg]);
    } catch (e: any) {
      setMessages(m => [
        ...m,
        { id: crypto.randomUUID(), role: 'agent', text: `Error: ${e?.message || e}` }
      ]);
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

  function toggleExpand(id: string) {
    setMessages(ms => ms.map(m => (m.id === id ? { ...m, expanded: !m.expanded } : m)));
  }

  return (
    <main className="min-h-[100svh] flex flex-col items-center p-4 md:p-6 font-[system-ui] bg-gray-50">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <header className="mb-3">
          <h1 className="text-2xl font-semibold">Dev PR Agent</h1>
          <p className="text-sm text-gray-600">Demo chat — scrollable, concise, with “Show more”.</p>
        </header>

        {/* Chat container (scrollable, max-height = viewport – input area) */}
        <div
          ref={scrollRef}
          className="rounded-2xl border bg-white p-4 space-y-4 overflow-y-auto"
          style={{ maxHeight: 'calc(100svh - 220px)' }}
          aria-label="Chat history"
        >
          {messages.map((m) => {
            const isLong = m.text.length > LONG_THRESHOLD;
            const showCompact = isLong && !m.expanded && m.role === 'agent';
            const compact = showCompact ? summarize(m.text) : null;

            return (
              <div
                key={m.id}
                className={`rounded-xl px-3 py-2 ${
                  m.role === 'user' ? 'bg-blue-50 border border-blue-100' : 'bg-gray-50 border'
                }`}
              >
                <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                  {m.role === 'user' ? 'You' : 'Agent'}
                </div>

                {/* Compact summary + “Show more” */}
                {showCompact ? (
                  <>
                    <p className="whitespace-pre-wrap">{compact}</p>
                    <button
                      onClick={() => toggleExpand(m.id)}
                      className="mt-2 text-xs underline text-blue-600"
                    >
                      Show more
                    </button>

                    {/* Optional: also provide collapsible sections view */}
                    <details className="mt-2">
                      <summary className="text-xs cursor-pointer select-none">
                        Open full (collapsible sections)
                      </summary>
                      <div className="mt-2">
                        <Sectioned text={m.text} />
                      </div>
                    </details>
                  </>
                ) : (
                  <>
                    {/* Full text (can still collapse back) */}
                    <div className="whitespace-pre-wrap">
                      <Sectioned text={m.text} />
                    </div>
                    {isLong && m.role === 'agent' && (
                      <button
                        onClick={() => toggleExpand(m.id)}
                        className="mt-2 text-xs underline text-blue-600"
                      >
                        Show less
                      </button>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Composer */}
        <form onSubmit={onSubmit} className="mt-5 flex items-center justify-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask for 5 short ideas for BrightScheduler…"
            className="w-full max-w-2xl rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            aria-label="Message input"
          />
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
