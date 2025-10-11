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

// Load saved chat once on mount
React.useEffect(() => {
  try {
    const saved = localStorage.getItem('devpr_chat');
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr)) setMessages(arr);
    }
  } catch {}
}, []);

// Save chat to localStorage whenever it changes
React.useEffect(() => {
  try {
    localStorage.setItem('devpr_chat', JSON.stringify(messages));
  } catch {}
}, [messages]);
