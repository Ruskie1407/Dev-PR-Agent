const RAW_BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const BASE = RAW_BASE.replace(/\/+$/,""); // no trailing slash
const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";
const KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_KEY ||
  "";

function isResponsesModel(m: string) {
  return /^(gpt-5|gpt-4\.1|gpt-4o|o\d)/i.test(m);
}

export async function askLLM(prompt: string): Promise<string> {
  if (!KEY) throw new Error("Missing OPENAI_API_KEY");

  if (isResponsesModel(MODEL)) {
    // ✅ Modern models → Responses API, no temperature, use max_completion_tokens
    const url = `${BASE}/responses`;
    const payload = {
      model: MODEL,
      input: prompt,
      max_completion_tokens: 120,
      // NO temperature (default behavior only for these models)
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

    // Prefer output_text; fallback to parts if needed
    const text = (body as any).output_text
      ?? (body as any).output?.[0]?.content?.[0]?.text
      ?? "";
    return String(text || "OK");
  }

  // �� Legacy chat models → Chat Completions, allow temperature
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
