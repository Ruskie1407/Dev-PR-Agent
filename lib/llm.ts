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

function pickTextFromResponses(body: any): string | null {
  // 1) output_text (convenience)
  if (typeof body?.output_text === "string" && body.output_text.trim()) {
    return body.output_text.trim();
  }
  // 2) output[].content[] parts (text fields)
  const parts = body?.output?.[0]?.content;
  if (Array.isArray(parts) && parts.length) {
    const txt = parts
      .map((p: any) =>
        typeof p?.text === "string" ? p.text :
        typeof p?.content === "string" ? p.content : "")
      .join("")
      .trim();
    if (txt) return txt;
  }
  // 3) candidates[0].content (older shapes)
  const cand = body?.candidates?.[0]?.content;
  if (cand) {
    if (typeof cand === "string" && cand.trim()) return cand.trim();
    if (Array.isArray(cand)) {
      const txt = cand.map((c:any)=>c?.text ?? c?.content ?? "").join("").trim();
      if (txt) return txt;
    }
  }
  return null;
}

export async function askLLM(prompt: string): Promise<string> {
  if (!KEY) throw new Error("Missing OPENAI_API_KEY");

  if (isResponsesModel(MODEL)) {
    // Modern models → Responses API (no temperature; max_output_tokens is correct)
    const url = `${BASE}/responses`;
    const payload = {
      model: MODEL,
      input: [{ role: "user", content: prompt }],
      max_output_tokens: 120
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

    const text = pickTextFromResponses(body);
    return text ?? "OK";
  }

  // Legacy chat models → Chat Completions (temperature allowed)
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
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map((p: any) => p?.text ?? "").join("");
  return String(msg ?? "OK");
}
