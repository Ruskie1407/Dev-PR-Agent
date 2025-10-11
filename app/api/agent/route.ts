import type { NextRequest } from "next/server";
import { askLLM } from "@/lib/llm";

// Force Node runtime (so env + fetch to OpenAI work consistently)
export const runtime = "nodejs";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Parse body as JSON if possible; otherwise treat body as raw text
async function getInput(req: NextRequest): Promise<string> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  try {
    if (ct.includes("application/json")) {
      const data = await req.json();
      return String(data?.input ?? "");
    }
  } catch {
    // fall through to text
  }
  const raw = await req.text();
  return raw.trim();
}

export async function POST(req: NextRequest) {
  try {
    const text = (await getInput(req)).trim();

    // Slash-commands
    if (text.startsWith("/")) {
      if (/^\/(hello|hi)\b/i.test(text)) return json({ ok: true, reply: "👋 Hello! I’m alive." });
      if (/^\/status\b/i.test(text))     return json({ ok: true, reply: "Status: ready ✅" });
      return json({ ok: false, reply: "I don't recognize that command. Try /hello or /status" });
    }

    // Freeform → LLM
    const prompt = text || "Say hi briefly.";
    const reply = await askLLM(prompt);
    return json({ ok: true, reply });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "agent error" }, 500);
  }
}
