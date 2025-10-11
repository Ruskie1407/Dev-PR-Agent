export async function GET() {
  const body = {
    has_OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5-nano",
    BRIEFS: {
      BRIGHTSCHEDULER_BRIEF: !!process.env.BRIGHTSCHEDULER_BRIEF,
      PAULSPEAKS_BRIEF: !!process.env.PAULSPEAKS_BRIEF,
    }
  };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }});
}
