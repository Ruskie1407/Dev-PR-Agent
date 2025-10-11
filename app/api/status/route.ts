export async function GET() {
  const ok = {
    WEBHOOK_SECRET: !!process.env.WEBHOOK_SECRET,
    GITHUB_TOKEN:
      !!process.env.GITHUB_TOKEN ||
      !!process.env.GH_TOKEN ||
      !!process.env.GH_FINEGRAINED_TOKEN,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
  };
  const llm = {
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5-nano",
  };
  const body = { ok, llm, time: new Date().toISOString() };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
