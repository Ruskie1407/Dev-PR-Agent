export const runtime = "nodejs";

type Evt = { t: string; event: string; note?: string };

const MAX_EVENTS = 200;

function addEvent(evt: Evt) {
  const g = globalThis as any;
  if (!g.__events) g.__events = [] as Evt[];
  g.__events.unshift(evt);
  g.__events = g.__events.slice(0, MAX_EVENTS);
}

export async function GET() {
  const g = globalThis as any;
  const events: Evt[] = g.__events ?? [];
  return Response.json({ events }, { status: 200 });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  addEvent({ t: new Date().toISOString(), event: String(body?.event || "manual"), note: String(body?.note || "") });
  return Response.json({ ok: true });
}
