import { NextResponse } from "next/server";
import { retryAllFailedCalls } from "@/lib/campaign_manager";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  try {
    const result = await retryAllFailedCalls();

    return NextResponse.json({
      success: true,
      total_retried: result.totalCount,
    }, { status: 200 });
  } catch (error: any) {
    console.error("[RetryAllCampaigns API] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
