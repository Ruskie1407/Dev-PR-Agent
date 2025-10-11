import { NextRequest } from "next/server";
import { askLLM } from "@/lib/llm";

// ensure Node runtime
export const runtime = "nodejs";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { input } = await req.json();
    const text = String(input ?? "").trim();

    if (text.startsWith("/")) {
      if (/^\/(hello|hi)\b/i.test(text)) return json({ ok: true, reply: "👋 Hello! I’m alive." });
      if (/^\/status\b/i.test(text))   return json({ ok: true, reply: "Status: ready ✅" });
      return json({ ok: false, reply: "I don't recognize that command. Try /hello or /status" });
    }

    // Freeform -> LLM
    const reply = await askLLM(text || "Say hi briefly.");
    return json({ ok: true, reply });
  } catch (e: any) {
    return json({ ok: false, error: e?.message ?? "agent error" }, 500);
  }
}
