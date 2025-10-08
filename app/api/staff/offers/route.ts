import { NextResponse } from 'next/server';
export async function GET(){ 
  return NextResponse.json({ staff_id: 'stub', offers: [] });
}
