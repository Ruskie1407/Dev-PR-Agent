import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    agent: process.env.AGENT_NAME || "default-agent",
    vercelEnv: process.env.VERCEL_ENV || "unknown",
    vercelUrl: process.env.VERCEL_URL || "unknown",
  });
}
add identity endpoint
