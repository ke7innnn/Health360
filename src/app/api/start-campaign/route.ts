import { NextResponse } from 'next/server';
import { createAndLaunchCampaign } from '@/lib/campaign_manager';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, patients } = body;

    if (!name || !patients || !Array.isArray(patients) || patients.length === 0) {
      return NextResponse.json(
        { error: 'Campaign name and a non-empty patients list are required.' },
        { status: 400 }
      );
    }

    console.log(`[StartCampaign] Launching "${name}" with ${patients.length} patient(s)...`);

    const result = await createAndLaunchCampaign(name, patients);

    return NextResponse.json({
      success: true,
      campaign_id: result.campaign.id,
      campaign: result.campaign,
      calls: result.calls,
      first_call_id: result.firstCallId,
    }, { status: 200 });

  } catch (error: any) {
    console.error('[StartCampaign] Error launching campaign:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start campaign.' },
      { status: 500 }
    );
  }
}
