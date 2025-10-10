import OpenAI from "openai";

const API_KEY = process.env.OPENAI_API_KEY || "";
const BASE_URL = process.env.OPENAI_BASE_URL || undefined;
const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";

function isResponsesModel(m: string) {
  // Treat modern models as Responses API
  return /^(gpt-5|gpt-4\.1|gpt-4o|o\d)/i.test(m);
}

export async function askLLM(prompt: string): Promise<string> {
  if (!API_KEY) return "LLM not configured (missing OPENAI_API_KEY).";

  const openai = new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL });

  if (isResponsesModel(MODEL)) {
    const r = await openai.responses.create({
      model: MODEL,
      input: prompt,
      // ✅ key fix for modern models:
      max_completion_tokens: 120,
      temperature: 0.3,
    });
    // Prefer the helper if available
    return (r as any).output_text
      ?? (r as any).output?.[0]?.content?.[0]?.text
      ?? "OK";
  }

  // Legacy chat models pathway
  const r = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: prompt }],
    max_tokens: 120,        // valid for legacy chat models
    temperature: 0.3,
  });
  return r.choices?.[0]?.message?.content ?? "OK";
}
