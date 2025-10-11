import type { NextRequest } from "next/server";
import { askLLM } from "@/lib/llm";

export const runtime = "nodejs";

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function getInput(req: NextRequest): Promise<{text:string, ct:string}> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    try { const j = await req.json(); return { text: String(j?.input ?? "").trim(), ct }; }
    catch (e:any) { return { text: "", ct: ct + " (json parse error: " + (e?.message||e) + ")" }; }
  }
  const raw = (await req.text()).trim();
  return { text: raw, ct };
}

export async function GET() {
  // Friendly GET for dashboards/preflight
  return json({ ok: true, note: "POST a message as raw text or JSON { input }" });
}

export async function POST(req: NextRequest) {
  const { text, ct } = await getInput(req);
  try {
    if (text.startsWith("/")) {
      if (/^\/(hello|hi)\b/i.test(text)) return json({ ok:true, mode:"command", reply:"👋 Hello! I’m alive." });
      if (/^\/status\b/i.test(text))     return json({ ok:true, mode:"command", reply:"Status: ready ✅" });
      return json({ ok:false, mode:"command", reply:"Unknown command. Try /hello or /status" });
    }
    const prompt = text || "Say hi briefly.";
    const reply = await askLLM(prompt);
    return json({ ok: true, mode:"llm", reply });
  } catch (e:any) {
    return json({ ok:false, mode:"error", error:String(e?.message||e), received:{ contentType: ct, length: text.length } }, 500);
  }
}
