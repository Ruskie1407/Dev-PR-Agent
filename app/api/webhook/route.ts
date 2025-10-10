import type { NextRequest } from "next/server";
import { verifySignature, ghFetch } from "@/lib/github";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  const evt = req.headers.get("x-github-event") || "unknown";

  // verify signature
  if (!verifySignature(raw, sig)) {
    return new Response("Invalid signature", { status: 401, headers: { "content-type": "text/plain" }});
  }

  // parse payload
  let body: any = {};
  try { body = JSON.parse(raw); } catch { /* ignore */ }

  // handle pull_request opened/synchronize
  if (evt === "pull_request" && (body.action === "opened" || body.action === "synchronize")) {
    const repo = body.repository?.full_name as string | undefined;
    const num  = body.pull_request?.number as number | undefined;
    const who  = body.sender?.login as string | "someone";

    if (repo && num) {
      const comment = `👋 Hi @${who}! Thanks for your PR.
      
This is an automated check-in from *Dev PR Agent*. If you want me to run extra checks, reply with \`/agent review\`.`;
      const res = await ghFetch(`/repos/${repo}/issues/${num}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: comment }),
        headers: { "content-type": "application/json" },
      });
      if (!res.ok) {
        const txt = await res.text();
        console.error("GH comment failed:", res.status, txt.slice(0,200));
        return new Response("ok (comment failed)", { status: 200 });
      }
    }
  }

  return new Response("ok", { status: 200, headers: { "content-type": "text/plain" }});
}

export async function GET() {
  return new Response("POST only", { status: 405, headers: { "content-type": "text/plain; charset=utf-8" }});
}
