export const runtime = "nodejs";

export async function GET() {
  const meta = {
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-5-nano",
    vercelEnv: process.env.VERCEL_ENV || "unknown",
  };

  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response(JSON.stringify({ ok: false, note: "No OPENAI_API_KEY", meta }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const { askLLM } = await import("@/lib/llm");
    const reply = await askLLM("Reply with just: ok");
    return new Response(JSON.stringify({ ok: true, reply, meta }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e?.message, meta }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
