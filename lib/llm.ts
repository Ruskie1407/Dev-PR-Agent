import { fetchWithRetry } from "./retry";

/**
 * Minimal LLM client using OpenAI-compatible Chat Completions.
 * Env:
 *  - OPENAI_API_KEY (required for LLM mode; otherwise caller should fallback)
 *  - OPENAI_BASE_URL (optional; defaults to https://api.openai.com)
 */
export async function chatLLM(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) throw new Error("NO_API_KEY");

  const base = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/,"");
  const url  = `${base}/v1/chat/completions`;

  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a friendly engineering helper. Be concise, warm, and helpful." },
      { role: "user",   content: prompt }
    ],
    temperature: 0.7
  };

  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body)
  }, {
    retries: 5,
    baseDelayMs: 400,
    maxDelayMs: 8000,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`LLM ${res.status}: ${text.slice(0,200)}`);
  }
  const j = await res.json();
  return j.choices?.[0]?.message?.content?.trim() || "I’m not sure what to say yet.";
}
