import { NextResponse } from "next/server";
import { retryFailedCampaignCalls } from "@/lib/campaign_manager";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing campaign id" }, { status: 400 });
    }

    const result = await retryFailedCampaignCalls(id);

    return NextResponse.json({
      success: true,
      retried_count: result.count,
      next_call: result.nextCall,
    }, { status: 200 });
  } catch (error: any) {
    console.error("[RetryCampaign API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
