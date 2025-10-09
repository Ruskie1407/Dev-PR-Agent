export async function POST(req: Request, { params }: any) {
  const id = params?.id as string;
  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}
