export async function POST(req: Request) {
  const body = await req.text();
  console.log("Webhook received:", body.slice(0, 200));
  return new Response("ok", {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET() {
  return new Response("POST only", {
    status: 405,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
