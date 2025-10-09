function tokenSource(): string | null {
  if (process.env.GITHUB_TOKEN) return "GITHUB_TOKEN";
  if (process.env.GH_TOKEN) return "GH_TOKEN";
  if (process.env.GH_FINEGRAINED_TOKEN) return "GH_FINEGRAINED_TOKEN";
  return null;
}
export async function GET() {
  const present = {
    GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
    GH_TOKEN: !!process.env.GH_TOKEN,
    GH_FINEGRAINED_TOKEN: !!process.env.GH_FINEGRAINED_TOKEN,
  };
  const meta = {
    vercelEnv: process.env.VERCEL_ENV || null,
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
  };
  return new Response(JSON.stringify({ present, tokenSource: tokenSource(), meta }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
