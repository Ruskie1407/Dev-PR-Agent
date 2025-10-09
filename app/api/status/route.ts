import { getEvents } from "@/lib/state";

export async function GET() {
  const ok = {
    WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET,
    GITHUB_TOKEN:   !!process.env.GITHUB_TOKEN,
  };
  return new Response(JSON.stringify({ ok, events: getEvents() }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
