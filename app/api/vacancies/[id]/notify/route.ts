import { NextRequest, NextResponse } from 'next/server';
import { rankCandidates, TIER_WINDOWS_SEC } from '@/lib/match';
export async function POST(req: NextRequest, { params }:{params:{id:string}}){
  const tier = Math.max(1, Math.min(3, parseInt(new URL(req.url).searchParams.get('tier')||'1',10))) as 1|2|3;
  const notified = await rankCandidates(params.id, tier);
  return NextResponse.json({ tier, window_sec: TIER_WINDOWS_SEC[tier], notified });
}
