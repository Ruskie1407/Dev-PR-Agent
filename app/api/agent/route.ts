import type { NextRequest } from "next/server";
import { GITHUB_TOKEN, WEBHOOK_SECRET } from "@/lib/github";
import { chatLLM } from "@/lib/llm";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  // read JSON or raw text
  let input = "";
  try { const data = await req.json(); input = (data?.input ?? "").toString(); }
  catch { input = (await req.text()); }
  const text = input.trim();

  if (!text) {
    return Response.json({ ok:false, mode:"none", reply:"No input provided." }, { status:400 });
  }

  // Slash-commands handled here (extend later)
  if (text.startsWith("/")) {
    const reply = await handleCommand(text);
    return Response.json({ ok:true, mode:"command", reply });
  }

  // Always try LLM first for natural text
  try {
    const reply = await chatLLM(text);
    return Response.json({ ok:true, mode:"llm", reply });
  } catch (e:any) {
    // Fallback only if LLM fails (e.g., no key/quota)
    const reply = smallTalk(text);
    return Response.json({ ok:true, mode:"fallback", error: e?.message || String(e), reply });
  }
}

function smallTalk(t: string) {
  // keep this minimal; only used when LLM fails
  const s = t.toLowerCase();
  if (/\b(good (morning|afternoon|evening)|hi|hello|hey)\b/.test(s)) {
    if (s.includes("morning")) return "Good morning! ☀️";
    if (s.includes("afternoon")) return "Good afternoon! 🕑";
    if (s.includes("evening")) return "Good evening! 🌙";
    return "Hello! 👋";
  }
  return `Got it: “${t}”.`;
}

async function handleCommand(cmd: string): Promise<string> {
  if (/^\/status\b/i.test(cmd)) {
    return `Status:\n- WEBHOOK_SECRET: ${!!WEBHOOK_SECRET}\n- GITHUB_TOKEN: ${!!GITHUB_TOKEN}`;
  }
  if (/^\/chat\b/i.test(cmd)) {
    const rest = cmd.replace(/^\/chat\b/i, "").trim();
    if (!rest) return "Usage: /chat Your message";
    try { return await chatLLM(rest); } catch { return smallTalk(rest); }
  }
  if (/^\/hello\b/i.test(cmd) || /^\/hi\b/i.test(cmd)) {
    const rest = cmd.replace(/^\/(hello|hi)\b/i, "").trim();
    if (!rest) return "👋 Hello! I’m alive. What’s up?";
    try { return await chatLLM(rest); } catch { return smallTalk(rest); }
  }
  return "I don't recognize that command. Try /chat or /status";
}

export async function GET() {
  return new Response("POST only", { status:405, headers:{ "content-type":"text/plain" }});
}
