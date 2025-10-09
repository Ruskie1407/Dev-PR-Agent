import type { NextRequest } from 'next/server';

export async function POST(
  req: NextRequest,
  context: { params: { id: string } }
) {
  const { id } = context.params;
  // TODO: your real logic goes here
  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}
