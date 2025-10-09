import type { NextRequest } from "next/server";
import { ghFetch, verifySignature, WEBHOOK_SECRET, GITHUB_TOKEN } from "@/lib/github";
import { addEvent } from "@/lib/state";

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-hub-signature-256");
  const evt = req.headers.get("x-github-event") || "unknown";

  if (!WEBHOOK_SECRET || !GITHUB_TOKEN) {
    addEvent({ event: evt, action: "error", note: "Missing env" });
    return new Response("Missing env", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  if (!verifySignature(raw, sig)) {
    addEvent({ event: evt, action: "error", note: "Bad signature" });
    return new Response("Invalid signature", { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  const payload = JSON.parse(raw);

  try {
    // pull_request opened → leave a friendly comment
    if (evt === "pull_request" && payload.action === "opened") {
      const repo: string = payload.repository.full_name; // "owner/name"
      const number: number = payload.pull_request.number;
      addEvent({ event: evt, action: "opened", repo, pr: number, note: payload.pull_request.title });

      const body = "👋 Thanks for the PR! The dev-pr-agent is online and reviewing.";
      await ghFetch(`/repos/${repo}/issues/${number}/comments`, {
        method: "POST",
        body: JSON.stringify({ body })
      });
    }

    // issue_comment mentioning 'dev-pr-agent' → reply
    if (evt === "issue_comment" && /dev-?pr-?agent/i.test(payload.comment?.body || "")) {
      const repo: string = payload.repository.full_name;
      const issue: number = payload.issue.number;
      addEvent({ event: evt, action: "mention", repo, pr: issue, note: "mentioned in comment" });

      const body = "🧠 Got it. Running checks… (demo reply)";
      await ghFetch(`/repos/${repo}/issues/${issue}/comments`, {
        method: "POST",
        body: JSON.stringify({ body })
      });
    }
  } catch (err: any) {
    addEvent({ event: evt, action: "error", note: String(err?.message || err) });
    return new Response("handler error", { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
  }

  return new Response("ok", { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } });
}

export async function GET() {
  // explicit text 405, per your preference
  return new Response("POST only", {
    status: 405,
    headers: { "content-type": "text/plain; charset=utf-8" }
  });
}
