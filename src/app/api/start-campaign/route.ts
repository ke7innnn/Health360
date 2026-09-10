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
  let cleanNumber = patient.contact.replace(/[\s\-()]/g, '');
  if (!cleanNumber.startsWith('+')) {
    if (cleanNumber.length === 10) {
      cleanNumber = `+91${cleanNumber}`;
    } else {
      cleanNumber = `+${cleanNumber}`;
    }
  }

  const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${retellApiKey}`,
    },
    body: JSON.stringify({
      from_number: retellFromNumber,
      to_number: cleanNumber,
      agent_id: retellAgentId,
      webhook_url: `${appUrl}/api/retell-callback`,
      metadata: {
        call_db_id: callDbId,
        campaign_id: campaignId,
      },
      retell_llm_dynamic_variables: {
        patient_name: patient.patient_name,
        patient_type: patient.patient_type || 'General',
        patient_context: patient.context || 'Checking on physiotherapy progress',
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
    if (!retellApiKey || !retellFromNumber || !retellAgentId) {
      return NextResponse.json({ error: 'Retell credentials not configured.' }, { status: 500 });
    }

    const body = await request.json();
    const { name, patients }: { name: string; patients: PatientInput[] } = body;

    if (!name || !patients || patients.length === 0) {
      return NextResponse.json({ error: 'Campaign name and patients list are required.' }, { status: 400 });
    }

    console.log(`[StartCampaign] Starting "${name}" with ${patients.length} patients`);

    let campaignId = `camp_${Date.now()}`;
    let firstCallDbId = `call_${Date.now()}_0`;
    const firstPatient = patients[0];

    // Attempt Supabase record (non-blocking)
    if (supabase) {
      try {
        const { data: campaign } = await supabase
          .from('campaigns')
          .insert([{
            name,
            total_patients: patients.length,
            completed: 0,
            failed: 0,
            in_progress: 1,
          }])
          .select()
          .single();

        if (campaign) {
          campaignId = campaign.id;
          const callsToInsert = patients.map((p, idx) => ({
            campaign_id: campaign.id,
            patient_name: p.patient_name,
            contact: p.contact,
            age: p.age,
            patient_type: p.patient_type,
            context: p.context || '',
            language: p.language || 'English',
            status: idx === 0 ? 'in_progress' : 'pending',
          }));

          const { data: insertedCalls } = await supabase
            .from('calls')
            .insert(callsToInsert)
            .select();

          if (insertedCalls && insertedCalls.length > 0) {
            firstCallDbId = insertedCalls[0].id;
          }
        }
      } catch (dbErr) {
        console.warn('[StartCampaign] Supabase logging warning (continuing call):', dbErr);
      }
    }

    // Always fire Retell call directly!
    try {
      console.log(`[StartCampaign] Firing Retell call to ${firstPatient.patient_name} (${firstPatient.contact})...`);
      const retellCallId = await fireRetellCall(firstCallDbId, campaignId, firstPatient);
      console.log(`[StartCampaign] ✓ First call fired → ${firstPatient.patient_name} | Retell ID: ${retellCallId}`);

      if (supabase) {
        try {
          await supabase
            .from('calls')
            .update({ status: 'in_progress', retell_call_id: retellCallId })
            .eq('id', firstCallDbId);
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: true,
        campaign_id: campaignId,
        campaign_name: name,
        total_patients: patients.length,
        first_call: {
          db_id: firstCallDbId,
          retell_call_id: retellCallId,
          patient: firstPatient.patient_name,
        },
      }, { status: 200 });

    } catch (retellErr: any) {
      console.error('[StartCampaign] Failed to fire Retell call:', retellErr.message);

      if (supabase) {
        try {
          await supabase.from('calls').update({ status: 'failed' }).eq('id', firstCallDbId);
          await supabase.from('campaigns').update({ failed: 1, in_progress: 0 }).eq('id', campaignId);
        } catch {
          // ignore
        }
      }

      return NextResponse.json({
        success: false,
        error: `Retell dialer error: ${retellErr.message}`,
      }, { status: 502 });
    }

  } catch (error: any) {
    console.error('[StartCampaign] Unhandled error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
