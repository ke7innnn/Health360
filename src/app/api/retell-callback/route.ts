import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const retellApiKey = process.env.RETELL_API_KEY || '';

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// ─── Sentiment Detector ───────────────────────────────────────────────────────
function detectSentiment(transcript: string): 'positive' | 'neutral' | 'negative' {
  const text = transcript.toLowerCase();
  const positiveKeywords = ['relief', 'satisfied', 'better', 'good', 'improved', 'happy', 'healing', 'well', 'great', 'fine', 'yes', 'आराम', 'अच्छा', 'ठीक', 'सुधार', 'धन्यवाद', 'बरं', 'हो'];
  const negativeKeywords = ['pain', 'worse', 'bad', 'stiff', 'ache', 'hurts', 'swelling', 'cramp', 'no', 'दर्द', 'दुखत', 'त्रास', 'कठीण', 'नाही'];
  let pos = 0, neg = 0;
  positiveKeywords.forEach(w => { const m = text.match(new RegExp(w, 'g')); if (m) pos += m.length; });
  negativeKeywords.forEach(w => { const m = text.match(new RegExp(w, 'g')); if (m) neg += m.length; });
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

// ─── Find call record — 3 strategies ─────────────────────────────────────────
async function findCallRecord(retellCallId: string, metadata: any) {
  if (!supabase) return null;

  // 1. By retell_call_id (best — works for calls we triggered)
  const { data: byRetellId } = await supabase
    .from('calls').select('*').eq('retell_call_id', retellCallId).maybeSingle();
  if (byRetellId) return byRetellId;

  // 2. By metadata.call_db_id (set by our start-campaign route)
  const callDbId = metadata?.call_db_id;
  if (callDbId) {
    const { data: byDbId } = await supabase
      .from('calls').select('*').eq('id', callDbId).maybeSingle();
    if (byDbId) return byDbId;
  }

  // 3. Oldest in_progress call in the campaign (last resort)
  const campaignId = metadata?.campaign_id;
  if (campaignId) {
    const { data: byInProgress } = await supabase
      .from('calls').select('*')
      .eq('campaign_id', campaignId).eq('status', 'in_progress')
      .order('created_at', { ascending: true }).limit(1).maybeSingle();
    if (byInProgress) return byInProgress;
  }

  console.error(`[Callback] ❌ Cannot find call for retell_call_id=${retellCallId}`);
  return null;
}

// ─── Auto-dial next pending call ──────────────────────────────────────────────
async function triggerNextCall(campaignId: string) {
  if (!supabase || !retellApiKey) return;

  const { data: nextCall } = await supabase
    .from('calls').select('*')
    .eq('campaign_id', campaignId).eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(1).maybeSingle();

  if (!nextCall) {
    console.log(`[AutoDial] ✅ Campaign ${campaignId} complete — no more pending calls.`);
    return;
  }

  console.log(`[AutoDial] → Firing next call: ${nextCall.patient_name} (${nextCall.contact})`);

  try {
    const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${retellApiKey}` },
      body: JSON.stringify({
        from_number: process.env.RETELL_FROM_NUMBER || '',
        to_number: nextCall.contact.replace(/\s+/g, ''),
        agent_id: process.env.RETELL_AGENT_ID || '',
        webhook_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://health360-nu.vercel.app'}/api/retell-callback`,
        metadata: { call_db_id: nextCall.id, campaign_id: campaignId },
        retell_llm_dynamic_variables: {
          patient_name: nextCall.patient_name,
          patient_type: nextCall.patient_type,
          patient_context: nextCall.context,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`[AutoDial] Retell API error: ${res.status} ${err}`);
      await supabase.from('calls').update({ status: 'failed' }).eq('id', nextCall.id);
      return;
    }

    const retellData = await res.json();
    const newRetellCallId = retellData.call_id;

    await supabase.from('calls')
      .update({ status: 'in_progress', retell_call_id: newRetellCallId })
      .eq('id', nextCall.id);

    const { data: camp } = await supabase.from('campaigns')
      .select('in_progress').eq('id', campaignId).maybeSingle();
    if (camp) {
      await supabase.from('campaigns')
        .update({ in_progress: (camp.in_progress || 0) + 1 }).eq('id', campaignId);
    }

    console.log(`[AutoDial] ✅ Next call fired — Retell ID: ${newRetellCallId}`);
  } catch (err) {
    console.error('[AutoDial] Exception:', err);
  }
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // ── IMPORTANT: Retell sends { event, call } NOT { event, data } ──────────
    // Support both formats for safety
    const event: string = body.event;
    const callData = body.call || body.data || body; // handle all Retell payload formats

    const retellCallId: string = callData?.call_id;
    const metadata = callData?.metadata;

    console.log(`[Retell Webhook] event="${event}" call_id="${retellCallId}" metadata=${JSON.stringify(metadata)}`);
    console.log(`[Retell Webhook] Full payload keys: ${Object.keys(body).join(', ')}`);

    if (!supabase) {
      return NextResponse.json({ message: 'Supabase not configured.' }, { status: 200 });
    }

    // ── call_started: mark in_progress ───────────────────────────────────────
    if (event === 'call_started') {
      if (!retellCallId) return NextResponse.json({ error: 'Missing call_id' }, { status: 200 });

      const record = await findCallRecord(retellCallId, metadata);
      if (record) {
        // Save retell_call_id (crucial link) and mark in_progress
        await supabase.from('calls')
          .update({ status: 'in_progress', retell_call_id: retellCallId })
          .eq('id', record.id);

        if (record.status !== 'in_progress' && record.campaign_id) {
          const { data: camp } = await supabase.from('campaigns')
            .select('in_progress').eq('id', record.campaign_id).maybeSingle();
          if (camp) {
            await supabase.from('campaigns')
              .update({ in_progress: (camp.in_progress || 0) + 1 }).eq('id', record.campaign_id);
          }
        }
        console.log(`[Callback] ✅ call_started → record ${record.id} marked in_progress`);
      }

      return NextResponse.json({ message: 'call_started processed.' }, { status: 200 });
    }

    // ── call_ended: finalize, update campaign, auto-dial next ─────────────────
    if (event === 'call_ended') {
      if (!retellCallId) return NextResponse.json({ error: 'Missing call_id' }, { status: 200 });

      const transcript = callData?.transcript || '';
      const durationMs = callData?.duration_ms || callData?.call_duration_ms || 0;
      const recordingUrl = callData?.recording_url || '';

      const durationSeconds = durationMs ? Math.round(durationMs / 1000) : 0;
      // Consider completed if > 3 seconds (avoid false positives from missed calls)
      const callStatus = durationSeconds > 3 ? 'completed' : 'failed';
      const sentiment = transcript ? detectSentiment(transcript) : 'neutral';

      console.log(`[Callback] call_ended — duration=${durationSeconds}s → status="${callStatus}"`);

      const record = await findCallRecord(retellCallId, metadata);
      if (!record) {
        return NextResponse.json({ message: 'No matching record found, ignoring.' }, { status: 200 });
      }

      // Idempotency
      if (record.status === 'completed' || record.status === 'failed') {
        return NextResponse.json({ message: 'Already finalized.' }, { status: 200 });
      }

      // Update call record
      await supabase.from('calls').update({
        status: callStatus,
        retell_call_id: retellCallId,
        transcript,
        duration_seconds: durationSeconds,
        recording_url: recordingUrl,
        sentiment,
      }).eq('id', record.id);

      // Update campaign metrics
      if (record.campaign_id) {
        const { data: campaign } = await supabase.from('campaigns')
          .select('*').eq('id', record.campaign_id).maybeSingle();

        if (campaign) {
          await supabase.from('campaigns').update({
            in_progress: Math.max(0, (campaign.in_progress || 0) - 1),
            completed: (campaign.completed || 0) + (callStatus === 'completed' ? 1 : 0),
            failed: (campaign.failed || 0) + (callStatus === 'failed' ? 1 : 0),
          }).eq('id', campaign.id);
        }

        // Auto-dial next patient
        await triggerNextCall(record.campaign_id);
      }

      console.log(`[Callback] ✅ call_ended → record ${record.id} → "${callStatus}"`);
      return NextResponse.json({ message: 'Processed.', status: callStatus, sentiment }, { status: 200 });
    }

    // ── All other events ─────────────────────────────────────────────────────
    return NextResponse.json({ message: `Event "${event}" ignored.` }, { status: 200 });

  } catch (error) {
    console.error('[Retell Callback] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
