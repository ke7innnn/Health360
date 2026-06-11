import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const retellApiKey = process.env.RETELL_API_KEY || '';
const retellFromNumber = process.env.RETELL_FROM_NUMBER || '';
const retellAgentId = process.env.RETELL_AGENT_ID || '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://health360-nu.vercel.app';

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

interface PatientInput {
  patient_name: string;
  contact: string;
  age: string;
  patient_type: string;
  context: string;
  language?: string;
}

// ─── Fire a single Retell outbound call ──────────────────────────────────────
async function fireRetellCall(callDbId: string, campaignId: string, patient: PatientInput) {
  const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${retellApiKey}`,
    },
    body: JSON.stringify({
      from_number: retellFromNumber,
      to_number: patient.contact.replace(/\s+/g, ''),
      agent_id: retellAgentId,
      webhook_url: `${appUrl}/api/retell-callback`,
      metadata: {
        call_db_id: callDbId,
        campaign_id: campaignId,
      },
      retell_llm_dynamic_variables: {
        patient_name: patient.patient_name,
        patient_type: patient.patient_type,
        patient_context: patient.context,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Retell API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.call_id as string; // Retell's call_id
}

// ─── POST /api/start-campaign ─────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured.' }, { status: 500 });
    }
    if (!retellApiKey || !retellFromNumber || !retellAgentId) {
      return NextResponse.json({ error: 'Retell credentials not configured.' }, { status: 500 });
    }

    const body = await request.json();
    const { name, patients }: { name: string; patients: PatientInput[] } = body;

    if (!name || !patients || patients.length === 0) {
      return NextResponse.json({ error: 'Campaign name and patients list are required.' }, { status: 400 });
    }

    console.log(`[StartCampaign] Creating campaign "${name}" with ${patients.length} patients`);

    // ── 1. Create campaign in Supabase ───────────────────────────────────────
    const { data: campaign, error: campErr } = await supabase
      .from('campaigns')
      .insert([{
        name,
        total_patients: patients.length,
        completed: 0,
        failed: 0,
        in_progress: 0,
      }])
      .select()
      .single();

    if (campErr || !campaign) {
      console.error('[StartCampaign] Failed to create campaign:', campErr);
      return NextResponse.json({ error: 'Failed to create campaign.' }, { status: 500 });
    }

    console.log(`[StartCampaign] Campaign created: ${campaign.id}`);

    // ── 2. Insert all call records as "pending" ──────────────────────────────
    const callsToInsert = patients.map(p => ({
      campaign_id: campaign.id,
      patient_name: p.patient_name,
      contact: p.contact,
      age: p.age,
      patient_type: p.patient_type,
      context: p.context,
      language: p.language || 'English',
      status: 'pending',
    }));

    const { data: insertedCalls, error: callsErr } = await supabase
      .from('calls')
      .insert(callsToInsert)
      .select();

    if (callsErr || !insertedCalls || insertedCalls.length === 0) {
      console.error('[StartCampaign] Failed to insert calls:', callsErr);
      // Rollback campaign
      await supabase.from('campaigns').delete().eq('id', campaign.id);
      return NextResponse.json({ error: 'Failed to insert call records.' }, { status: 500 });
    }

    console.log(`[StartCampaign] ${insertedCalls.length} call records inserted`);

    // ── 3. Fire the FIRST call to Retell ────────────────────────────────────
    // Sort by created_at ascending to preserve CSV order
    const firstCall = insertedCalls.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )[0];

    try {
      const retellCallId = await fireRetellCall(firstCall.id, campaign.id, {
        patient_name: firstCall.patient_name,
        contact: firstCall.contact,
        age: firstCall.age,
        patient_type: firstCall.patient_type,
        context: firstCall.context,
        language: firstCall.language,
      });

      // ── 4. Save retell_call_id immediately & mark in_progress ─────────────
      // This is the KEY fix — we save it BEFORE any callback fires
      await supabase
        .from('calls')
        .update({ status: 'in_progress', retell_call_id: retellCallId })
        .eq('id', firstCall.id);

      await supabase
        .from('campaigns')
        .update({ in_progress: 1 })
        .eq('id', campaign.id);

      console.log(`[StartCampaign] ✓ First call fired → ${firstCall.patient_name} | Retell ID: ${retellCallId}`);

      return NextResponse.json({
        success: true,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        total_patients: patients.length,
        first_call: {
          db_id: firstCall.id,
          retell_call_id: retellCallId,
          patient: firstCall.patient_name,
        },
      }, { status: 200 });

    } catch (retellErr: any) {
      console.error('[StartCampaign] Failed to fire first Retell call:', retellErr.message);

      // Mark first call as failed, campaign still created
      await supabase
        .from('calls')
        .update({ status: 'failed' })
        .eq('id', firstCall.id);

      await supabase
        .from('campaigns')
        .update({ failed: 1 })
        .eq('id', campaign.id);

      return NextResponse.json({
        success: true,
        campaign_id: campaign.id,
        warning: `Campaign created but first call failed: ${retellErr.message}`,
      }, { status: 200 });
    }

  } catch (error: any) {
    console.error('[StartCampaign] Unhandled error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
