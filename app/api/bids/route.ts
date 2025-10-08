import { NextRequest, NextResponse } from 'next/server';
export async function POST(req: NextRequest){
  const { action } = await req.json();
  if(action==='accept') return NextResponse.json({ assigned:true, bid:{ id:'bid-stub', status:'accepted' }});
  return NextResponse.json({ assigned:false, bid:{ id:'bid-stub', status:'declined' }});
}
