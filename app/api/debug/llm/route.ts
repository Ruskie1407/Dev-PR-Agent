export const runtime = "nodejs";

export async function GET() {
  const key = process.env.OPENAI_API_KEY || "";
  const rawBase = (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/,"");
  const base = /\/v1$/.test(rawBase) ? rawBase : `${rawBase}/v1`;
  const url  = `${base}/chat/completions`;
  const meta = {
    OPENAI_API_KEY: !!key,
    OPENAI_BASE_URL: base,
    model: process.env.OPENAI_MODEL || "gpt-5-nano",
    vercelEnv: process.env.VERCEL_ENV || "unknown",
  };

  if (!key) {
    return new Response(JSON.stringify({ ok:false, meta, note:"No OPENAI_API_KEY in this environment." }), {
      headers: { "content-type":"application/json" }
    });
  }

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type":"application/json", "authorization": `Bearer ${key}` },
      body: JSON.stringify({
        model: meta.model,
        messages: [{ role:"user", content:"ping" }],
        max_tokens: 5
      })
    });
    let body: any; try { body = await r.json(); } catch { body = await r.text(); }
    return new Response(JSON.stringify({ ok: r.ok, status: r.status, body, meta }), {
      headers: { "content-type":"application/json" }
    });
  } catch (e:any) {
    return new Response(JSON.stringify({ ok:false, error:String(e), meta }), {
      headers: { "content-type":"application/json" }
    });
  }
}
