const RAW_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const BASE = RAW_BASE.replace(/\/+$/,"");
const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_KEY ||
  "";

const MAX_OUT = Math.max(256, Number(process.env.OPENAI_MAX_OUTPUT || "4096")); // you can raise via env

// Project briefs (from env). Keep replies compact by default.
const BRIEF =
  [process.env.BRIGHTSCHEDULER_BRIEF, process.env.PAULSPEAKS_BRIEF]
    .filter(Boolean)
    .join("\n\n");

const INSTRUCTIONS =
  "You are a helpful, concise product assistant.\n" +
  "Default to <= 80 words unless explicitly asked for detail.\n" +
  "For ideas, return at most 5 bullets, <= 14 words each.\n\n" +
  (BRIEF ? "PROJECT CONTEXT:\n" + BRIEF + "\n\n" : "");

function isResponsesModel(m: string) {
  return /^(gpt-5|gpt-4\.1|gpt-4o|o\d)/i.test(m);
}

function extractText(body: any): string | null {
  if (typeof body?.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  if (Array.isArray(body?.output) && body.output.length) {
    const chunks: string[] = [];
    for (const item of body.output) {
      const c = item?.content;
      if (typeof c === "string") chunks.push(c);
      else if (Array.isArray(c)) {
        for (const b of c) {
          if (typeof b?.text === "string") chunks.push(b.text);
          else if (typeof b?.content === "string") chunks.push(b.content);
        }
      }
    }
    const txt = chunks.join("").trim();
    if (txt) return txt;
  }
  const cand = body?.candidates?.[0]?.content;
  if (cand) {
    if (typeof cand === "string" && cand.trim()) return cand.trim();
    if (Array.isArray(cand)) {
      const txt = cand.map((c:any)=>c?.text ?? c?.content ?? "").join("").trim();
      if (txt) return txt;
    }
  }
  const msg = body?.choices?.[0]?.message?.content;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  if (Array.isArray(msg)) {
    const txt = msg.map((p:any)=>p?.text ?? p?.content ?? "").join("").trim();
    if (txt) return txt;
  }
  return null;
}

async function callResponses(prompt: string, maxOut: number, preface?: string) {
  const url = `${BASE}/responses`;
  const payload: any = {
    model: MODEL,
    instructions: INSTRUCTIONS,
    input: preface ? `${preface}\n\n${prompt}` : String(prompt),
    max_output_tokens: maxOut
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  let body: any; try { body = await res.json(); } catch { body = await res.text(); }
  return { res, body };
}

export async function askLLM(prompt: string): Promise<string> {
  if (!KEY) throw new Error("Missing OPENAI_API_KEY");

  if (isResponsesModel(MODEL)) {
    // 1st try
    let { res, body } = await callResponses(prompt, MAX_OUT);
    if (!res.ok) {
      const msg = (body?.error?.message || body?.error?.code || String(body)).toString();
      throw new Error(`OpenAI ${res.status}: ${msg}`);
    }

    let text = extractText(body) || "";
    const incomplete = body?.status === "incomplete" || /max_?output_?tokens/i.test(body?.incomplete_details?.reason || "");

    // If the model stopped at the cap, ask it to finish briefly once.
    if (incomplete) {
      const part = text || (typeof body === "string" ? body : JSON.stringify(body));
      const tail = part.slice(-1500);
      ({ res, body } = await callResponses(`Continue **briefly** (<= 100 words) to complete:\n${tail}`, Math.min(800, MAX_OUT)));
      if (res.ok) text = (text + "\n" + (extractText(body) || "")).trim();
    }

    if (text) return text;
    const preview = typeof body === "string" ? body : JSON.stringify(body);
    return `[unparsed model output] ${preview.slice(0, 240)}…`;
  }

  // Legacy chat models
  const url = `${BASE}/chat/completions`;
  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: INSTRUCTIONS },
      { role: "user", content: prompt }
    ],
    max_tokens: Math.min(1024, MAX_OUT),
    temperature: 1, // gpt-5-* only accepts default
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  let body: any; try { body = await res.json(); } catch { body = await res.text(); }
  if (!res.ok) {
    const msg = (body?.error?.message || body?.error?.code || String(body)).toString();
    throw new Error(`OpenAI ${res.status}: ${msg}`);
  }
  const msg = body?.choices?.[0]?.message?.content;
  if (typeof msg === "string" && msg.trim()) return msg.trim();
  if (Array.isArray(msg)) {
    const txt = msg.map((p:any)=>p?.text ?? p?.content ?? "").join("").trim();
    if (txt) return txt;
  }
  const preview = typeof body === "string" ? body : JSON.stringify(body);
  return `[unparsed chat output] ${preview.slice(0, 240)}…`;
}
