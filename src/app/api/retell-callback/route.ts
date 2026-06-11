import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const retellApiKey = process.env.RETELL_API_KEY || '';

const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// ─── Multilingual Sentiment Keyword Detector ─────────────────────────────────
function detectSentiment(transcript: string): 'positive' | 'neutral' | 'negative' {
  const text = transcript.toLowerCase();
  const positiveKeywords = [
    'relief', 'satisfied', 'better', 'good', 'improved', 'happy', 'healing', 'well', 'great', 'fine', 'yes',
    'आराम', 'अच्छा', 'ठीक', 'सुधार', 'धन्यवाद', 'आभारी', 'कमी', 'फरक', 'बरं', 'हो', 'योग्य'
  ];
  const negativeKeywords = [
    'pain', 'worse', 'bad', 'stiff', 'ache', 'hurts', 'swelling', 'cramp', 'dislike', 'unsatisfied', 'no',
    'दर्द', 'दुखत', 'त्रास', 'कठीण', 'सूज', 'कमी नाही', 'वाढले', 'गंभीर', 'नाही'
  ];
  let pos = 0, neg = 0;
  positiveKeywords.forEach(w => { const m = text.match(new RegExp(w, 'g')); if (m) pos += m.length; });
  negativeKeywords.forEach(w => { const m = text.match(new RegExp(w, 'g')); if (m) neg += m.length; });
  if (pos > neg) return 'positive';
  if (neg > pos) return 'negative';
  return 'neutral';
}

// ─── Find call record by retell_call_id OR metadata.call_db_id ───────────────
// n8n triggers Retell — so retell_call_id is NOT in our DB yet.
// Retell echoes back our metadata (call_db_id) in every webhook event.
async function findCallRecord(retellCallId: string, metadata: any) {
  if (!supabase) return null;

  // Strategy 1: try retell_call_id (works for calls we triggered directly)
  const { data: byRetellId } = await supabase
    .from('calls')
    .select('*')
    .eq('retell_call_id', retellCallId)
    .maybeSingle();

  if (byRetellId) return byRetellId;

  // Strategy 2: use call_db_id from metadata (set by n8n in the Retell request)
  const callDbId = metadata?.call_db_id;
  if (callDbId) {
    const { data: byDbId } = await supabase
      .from('calls')
      .select('*')
      .eq('id', callDbId)
      .maybeSingle();
    if (byDbId) return byDbId;
  }

  // Strategy 3: fuzzy match — find oldest pending call from this campaign
  const campaignId = metadata?.campaign_id;
  if (campaignId) {
    const { data: byPending } = await supabase
      .from('calls')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byPending) return byPending;

    // Also try in_progress (for call_ended after we already marked it)
    const { data: byInProgress } = await supabase
      .from('calls')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'in_progress')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (byInProgress) return byInProgress;
  }

  console.error(`[Retell] Cannot find call record for retell_call_id=${retellCallId}, metadata=${JSON.stringify(metadata)}`);
  return null;
}

// ─── Trigger next pending call via Retell API ─────────────────────────────────
async function triggerNextCall(campaignId: string) {
  if (!supabase || !retellApiKey) return;

  const { data: nextCall } = await supabase
    .from('calls')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!nextCall) {
    console.log(`[AutoDial] No more pending calls in campaign ${campaignId}.`);
    return;
  }

  console.log(`[AutoDial] Triggering next call → ${nextCall.patient_name} (${nextCall.contact})`);

  try {
    const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retellApiKey}`,
      },
      body: JSON.stringify({
        from_number: process.env.RETELL_FROM_NUMBER || '',
        to_number: nextCall.contact.replace(/\s+/g, ''),
        agent_id: process.env.RETELL_AGENT_ID || '',
        webhook_url: 'https://health360-nu.vercel.app/api/retell-callback',
        metadata: {
          call_db_id: nextCall.id,
          campaign_id: campaignId,
          patient_name: nextCall.patient_name,
          patient_type: nextCall.patient_type,
          context: nextCall.context,
        },
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

    // Save retell_call_id and mark in_progress right away
    await supabase
      .from('calls')
      .update({ status: 'in_progress', retell_call_id: newRetellCallId })
      .eq('id', nextCall.id);

    // Update campaign counter
    const { data: camp } = await supabase
      .from('campaigns').select('in_progress').eq('id', campaignId).maybeSingle();
    if (camp) {
      await supabase
        .from('campaigns')
        .update({ in_progress: (camp.in_progress || 0) + 1 })
        .eq('id', campaignId);
    }

    console.log(`[AutoDial] ✓ Next call triggered — Retell ID: ${newRetellCallId}`);
  } catch (err) {
    console.error('[AutoDial] Exception:', err);
  }
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { event, data } = body;

    // Always log — helps debug in Vercel logs
    console.log(`[Retell Webhook] event="${event}" call_id="${data?.call_id}" metadata=${JSON.stringify(data?.metadata)}`);

    if (!supabase) {
      return NextResponse.json({ message: 'Supabase not configured.' }, { status: 200 });
    }

    // ── call_started: link retell_call_id → DB record, mark in_progress ────
    if (event === 'call_started') {
      const retellCallId = data?.call_id;
      if (!retellCallId) return NextResponse.json({ error: 'Missing call_id' }, { status: 400 });

      const callRecord = await findCallRecord(retellCallId, data?.metadata);
      if (!callRecord) {
        // Return 200 so Retell doesn't retry — we just can't find it
        return NextResponse.json({ message: 'call_started: no matching record found, ignoring.' }, { status: 200 });
      }

      // Save the Retell call_id and mark in_progress
      await supabase
        .from('calls')
        .update({ status: 'in_progress', retell_call_id: retellCallId })
        .eq('id', callRecord.id);

      // Update campaign in_progress counter (only if not already in_progress)
      if (callRecord.status !== 'in_progress' && callRecord.campaign_id) {
        const { data: camp } = await supabase
          .from('campaigns').select('in_progress').eq('id', callRecord.campaign_id).maybeSingle();
        if (camp) {
          await supabase
            .from('campaigns')
            .update({ in_progress: (camp.in_progress || 0) + 1 })
            .eq('id', callRecord.campaign_id);
        }
      }

      console.log(`[Retell] ✓ call_started → DB record ${callRecord.id} marked in_progress`);
      return NextResponse.json({ message: 'call_started processed.' }, { status: 200 });
    }

    // ── Ignore all events except call_ended ─────────────────────────────────
    if (event !== 'call_ended') {
      return NextResponse.json({ message: `Event "${event}" ignored.` }, { status: 200 });
    }

    // ── call_ended ──────────────────────────────────────────────────────────
    const retellCallId = data?.call_id;
    if (!retellCallId) return NextResponse.json({ error: 'Missing call_id' }, { status: 400 });

    const { transcript, duration_ms, recording_url, metadata } = data;
    const durationSeconds = duration_ms ? Math.round(duration_ms / 1000) : 0;
    const callStatus = durationSeconds > 0 ? 'completed' : 'failed';
    const sentiment = transcript ? detectSentiment(transcript) : 'neutral';

    const callRecord = await findCallRecord(retellCallId, metadata);
    if (!callRecord) {
      return NextResponse.json({ error: 'Matching call record not found.' }, { status: 200 });
    }

    // Idempotency guard
    if (callRecord.status === 'completed' || callRecord.status === 'failed') {
      return NextResponse.json({ message: 'Call already finalized.' }, { status: 200 });
    }

    // Update call record
    await supabase
      .from('calls')
      .update({
        status: callStatus,
        retell_call_id: retellCallId, // ensure it's saved even if call_started was missed
        transcript: transcript || '',
        duration_seconds: durationSeconds,
        recording_url: recording_url || '',
        sentiment,
      })
      .eq('id', callRecord.id);

    // Update campaign metrics
    if (callRecord.campaign_id) {
      const { data: campaign } = await supabase
        .from('campaigns').select('*').eq('id', callRecord.campaign_id).maybeSingle();

      if (campaign) {
        await supabase
          .from('campaigns')
          .update({
            in_progress: Math.max(0, (campaign.in_progress || 0) - 1),
            completed: (campaign.completed || 0) + (callStatus === 'completed' ? 1 : 0),
            failed: (campaign.failed || 0) + (callStatus === 'failed' ? 1 : 0),
          })
          .eq('id', campaign.id);
      }

      // Auto-dial next call in the campaign
      await triggerNextCall(callRecord.campaign_id);
    }

    console.log(`[Retell] ✓ call_ended → DB record ${callRecord.id} status="${callStatus}"`);
    return NextResponse.json({
      message: 'Callback processed successfully.',
      call_id: callRecord.id,
      status: callStatus,
      sentiment,
    }, { status: 200 });

  } catch (error) {
    console.error('[Retell] Unhandled error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
