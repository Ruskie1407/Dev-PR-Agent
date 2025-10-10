import type { NextRequest } from "next/server";
import { GITHUB_TOKEN, WEBHOOK_SECRET, ghFetch } from "@/lib/github";
import { fetchPR, analyze, renderSummary } from "@/lib/review";
import { chatLLM } from "@/lib/llm"; // falls back if no OPENAI_API_KEY

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let input = "";
  try { const data = await req.json(); input = (data?.input ?? "").toString(); }
  catch { input = (await req.text()); }

  const text = input.trim();
  if (!text) return Response.json({ ok:false, reply:"No input received." }, { status:400 });

  // Slash commands
  if (text.startsWith("/")) return Response.json({ ok:true, reply: await handleCommand(text) });

  // Natural chat (LLM), with graceful fallback
  try {
    const reply = await chatLLM(text);
    return Response.json({ ok:true, reply });
  } catch {
    return Response.json({ ok:true, reply: smallTalk(text) });
  }
}

function smallTalk(t: string) {
  const s = t.toLowerCase();
  if (/\b(good (morning|afternoon|evening)|hi|hello|hey)\b/.test(s)) {
    if (s.includes("morning")) return "Good morning! ☀️";
    if (s.includes("afternoon")) return "Good afternoon! 🕑";
    if (s.includes("evening")) return "Good evening! 🌙";
    return "Hello! 👋";
  }
  if (/\b(how (are|r) (you|u)|how's it going)\b/.test(s)) return "I’m doing well—thanks for asking! How about you?";
  if (/\b(thanks|thank you|cheers)\b/.test(s)) return "You're welcome! 😊 Anything else I can help with?";
  if (/\b(who (are|r) you|what (are|r) you)\b/.test(s)) return "I’m the Dev PR Agent. I can chat and also help on GitHub PRs with slash commands.";
  if (/\b(bye|goodbye|see (ya|you))\b/.test(s)) return "Bye for now! 👋";
  return `Got it: “${t}”. Want me to do something? Try /help`;
}

async function handleCommand(cmd: string): Promise<string> {
  // /hi [message?]  or /hello [message?]
  if (/^\/(hi|hello)\b/i.test(cmd)) {
    const rest = cmd.replace(/^\/(hi|hello)\b/i, "").trim();
    if (!rest) return "👋 Hello! I’m alive. What’s up?";
    // If there is extra text, treat it like chat
    try {
      return await chatLLM(rest);
    } catch {
      return smallTalk(rest);
    }
  }

  // Explicit chat: /chat your message
  if (/^\/chat\b/i.test(cmd)) {
    const rest = cmd.replace(/^\/chat\b/i, "").trim();
    if (!rest) return "Usage: /chat Tell me something to talk about";
    try {
      return await chatLLM(rest);
    } catch {
      return smallTalk(rest);
    }
  }

  if (/^\/help\b/i.test(cmd))
    return "Commands:\n/hello [msg]\n/hi [msg]\n/chat message…\n/status\n/comment owner/repo#123 Message\n/review owner/repo#123";

  if (/^\/status\b/i.test(cmd))
    return `Status:\n- WEBHOOK_SECRET: ${!!WEBHOOK_SECRET}\n- GITHUB_TOKEN: ${!!GITHUB_TOKEN}`;

  // /comment owner/repo#123 Message...
  if (/^\/comment\b/i.test(cmd)) {
    const m = cmd.match(/^\/comment\s+([\w.-]+\/[\w.-]+)#(\d+)\s+([\s\S]+)$/i);
    if (!m) return "Usage: /comment owner/repo#123 Your message";
    if (!GITHUB_TOKEN) return "Server missing GITHUB_TOKEN";
    const [, repo, numStr, msg] = m;
    const r = await ghFetch(`/repos/${repo}/issues/${Number(numStr)}/comments`, {
      method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ body: msg })
    });
    if (!r.ok) return `GitHub API error ${r.status}: ${(await r.text()).slice(0,200)}`;
    return `✅ Comment posted to ${repo}#${numStr}`;
  }

  // /review owner/repo#123
  if (/^\/review\b/i.test(cmd)) {
    const m = cmd.match(/^\/review\s+([\w.-]+\/[\w.-]+)#(\d+)$/i);
    if (!m) return "Usage: /review owner/repo#123";
    if (!GITHUB_TOKEN) return "Server missing GITHUB_TOKEN";
    const [, repo, numStr] = m;
    try {
      const pr = Number(numStr);
      const { meta, files } = await fetchPR(repo, pr);
      const summary = renderSummary(analyze(repo, pr, meta, files));
      const r = await ghFetch(`/repos/${repo}/issues/${pr}/comments`, {
        method:"POST", headers:{ "content-type":"application/json" }, body: JSON.stringify({ body: summary })
      });
      if (!r.ok) return `GitHub API error ${r.status}: ${(await r.text()).slice(0,200)}`;
      return `✅ Posted review summary to ${repo}#${pr}`;
    } catch (e:any) {
      return `Error: ${e?.message || String(e)}`;
    }
  }

  return "I don't recognize that command. Try /help";
}

export async function GET() {
  return new Response("POST only", { status:405, headers:{ "content-type":"text/plain" }});
}
