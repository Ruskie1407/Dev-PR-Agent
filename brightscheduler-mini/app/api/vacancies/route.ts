import { NextResponse } from 'next/server';
export async function POST(){ 
  return NextResponse.json({ vacancy: { id: 'vac-stub', status: 'open' }, shift: {} });
}
