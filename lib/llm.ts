const BASE = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano"; // change if you like
const KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_KEY || // alternate names, just in case
  "";

export async function askLLM(prompt: string): Promise<string> {
  if (!KEY) throw new Error("Missing OPENAI_API_KEY");
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      // OpenAI “Responses API” models use max_completion_tokens (not max_tokens)
      max_completion_tokens: 120,
      temperature: 0.7,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `OpenAI error ${res.status}`);
  }

  const msg = data?.choices?.[0]?.message?.content;
  if (typeof msg === "string") return msg;
  // some SDKs return array-of-parts; join if needed
  if (Array.isArray(msg)) return msg.map((p: any) => p?.text ?? "").join("");
  return String(msg ?? "");
}
