import { db } from "@/lib/libsql";

export async function GET() {
  const rs = await db.execute(
    "SELECT id, role, content, created_at FROM messages ORDER BY created_at DESC LIMIT 20;"
  );
  return Response.json({ data: rs.rows });
}

export async function POST(req: Request) {
  const { role, content } = await req.json();
  if (!content) return new Response("Missing content", { status: 400 });
  await db.execute({
    sql: "INSERT INTO messages (role, content, created_at) VALUES (?, ?, datetime('now'))",
    args: [role ?? "user", content],
  });
  return Response.json({ ok: true });
}
