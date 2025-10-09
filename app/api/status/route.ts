const hasToken =
  !!process.env.GITHUB_TOKEN ||
  !!process.env.GH_TOKEN ||
  !!process.env.GH_FINEGRAINED_TOKEN;

export async function GET() {
  const ok = {
    WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET,
    GITHUB_TOKEN: hasToken,
  };
  return new Response(JSON.stringify({ ok, events: (globalThis as any).__events ?? [] }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
