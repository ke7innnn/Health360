import { NextResponse } from 'next/server';
import { getAllCampaigns } from '@/lib/campaign_manager';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const campaigns = await getAllCampaigns();
    return NextResponse.json({ campaigns }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
