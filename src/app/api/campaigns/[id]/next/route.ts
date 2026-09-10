import { NextResponse } from 'next/server';
import { triggerNextCampaignCall } from '@/lib/campaign_manager';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing campaign id' }, { status: 400 });
    }

    const nextCall = await triggerNextCampaignCall(id);

    return NextResponse.json({
      success: true,
      next_call: nextCall,
      queue_finished: !nextCall,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[TriggerNextCall API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
