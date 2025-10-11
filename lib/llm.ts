const RAW_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const BASE = RAW_BASE.replace(/\/+$/,"");
const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_KEY ||
  "";

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

export async function askLLM(prompt: string): Promise<string> {
  if (!KEY) throw new Error("Missing OPENAI_API_KEY");

  if (isResponsesModel(MODEL)) {
    const url = `${BASE}/responses`;
    const payload = {
      model: MODEL,
      input: String(prompt),
      max_output_tokens: 1024
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
    const text = extractText(body);
    if (text) return text;
    const preview = typeof body === "string" ? body : JSON.stringify(body);
    return `[unparsed model output] ${preview.slice(0, 240)}…`;
  }

  const url = `${BASE}/chat/completions`;
  const payload = {
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 120,
    temperature: 0.7,
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
