import { NextResponse } from 'next/server';
import { getAndSyncCampaign } from '@/lib/campaign_manager';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing campaign id' }, { status: 400 });
    }

    const { campaign, calls } = await getAndSyncCampaign(id);

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    return NextResponse.json({ campaign, calls }, { status: 200 });
  } catch (error: any) {
    console.error('[GetCampaign API] Error syncing campaign:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
