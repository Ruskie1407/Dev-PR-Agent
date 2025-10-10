export const runtime = "nodejs";
import type { NextRequest } from "next/server";
import { verifySignature, ghFetch } from "@/lib/github";

export async function POST(req: NextRequest) {
  const sig = req.headers.get("x-hub-signature-256");
  const evt = req.headers.get("x-github-event") || "unknown";
  const ct  = (req.headers.get("content-type") || "").toLowerCase();

  // Read raw body exactly as delivered (this is what GitHub signs)
  const raw = await req.text();

  // Verify HMAC signature over the *raw* body (works for both JSON and form)
  if (!verifySignature(raw, sig)) {
    return new Response("Invalid signature", { status: 401, headers: { "content-type": "text/plain" }});
  }

  // Parse the payload depending on content-type
  let body: any = {};
  try {
    if (ct.includes("application/json")) {
      body = JSON.parse(raw);
    } else if (ct.includes("application/x-www-form-urlencoded")) {
      const params = new URLSearchParams(raw);
      const p = params.get("payload");
      body = p ? JSON.parse(p) : {};
    } else {
      // fallback: try JSON
      body = JSON.parse(raw);
    }
  } catch {
    body = {};
  }

  // Handle PR open/sync → leave a friendly comment
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
