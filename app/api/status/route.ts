function tokenSource(): string | null {
  if (process.env.GITHUB_TOKEN) return "GITHUB_TOKEN";
  if (process.env.GH_TOKEN) return "GH_TOKEN";
  if (process.env.GH_FINEGRAINED_TOKEN) return "GH_FINEGRAINED_TOKEN";
  return null;
}

export async function GET() {
  const source = tokenSource();
  const ok = {
    WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET,
    GITHUB_TOKEN: !!source,
  };
  return new Response(JSON.stringify({ ok, tokenSource: source, events: (globalThis as any).__events ?? [] }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
