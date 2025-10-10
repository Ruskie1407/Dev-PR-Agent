import type { NextRequest } from "next/server";
export const runtime = "edge";

export async function POST(req: NextRequest) {
  let input = "";
  try { const data = await req.json(); input = (data?.input ?? "").toString(); }
  catch { input = (await req.text()); }
  const text = input.trim();
  if (!text) return Response.json({ ok:false, reply:"No input." }, { status:400 });

  if (text.startsWith("/")) {
    if (/^\/(hello|hi)\b/i.test(text)) return Response.json({ ok:true, reply:"👋 Hello! I’m alive." });
    if (/^\/status\b/i.test(text))     return Response.json({ ok:true, reply:"Status endpoint reachable." });
    return Response.json({ ok:true, reply:"I don't recognize that command. Try /hello or /status" });
  }

  if (/morning/i.test(text)) return Response.json({ ok:true, reply:"Good morning! ☀️ How are you?" });
  return Response.json({ ok:true, reply:`Got it: “${text}”. Try /hello` });
}

export async function GET() {
  return new Response("POST only", { status:405, headers:{ "content-type":"text/plain" }});
}
