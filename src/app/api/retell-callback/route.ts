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

  let positiveScore = 0;
  let negativeScore = 0;

  positiveKeywords.forEach((word) => {
    const matches = text.match(new RegExp(word, 'g'));
    if (matches) positiveScore += matches.length;
  });
  negativeKeywords.forEach((word) => {
    const matches = text.match(new RegExp(word, 'g'));
    if (matches) negativeScore += matches.length;
  });

  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

// ─── Trigger next pending call in the campaign via Retell ────────────────────
async function triggerNextCall(campaignId: string) {
  if (!supabase || !retellApiKey) return;

  // Find the oldest pending call in this campaign
  const { data: nextCall, error } = await supabase
    .from('calls')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(1)
    .single();

  if (error || !nextCall) {
    console.log(`[AutoDial] No more pending calls in campaign ${campaignId}.`);
    return;
  }

  console.log(`[AutoDial] Triggering next call for ${nextCall.patient_name} (${nextCall.contact})`);

  try {
    // Call the Retell API to initiate the next outbound call
    const retellResponse = await fetch('https://api.retellai.com/v2/create-phone-call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${retellApiKey}`,
      },
      body: JSON.stringify({
        from_number: process.env.RETELL_FROM_NUMBER || '',
        to_number: nextCall.contact.replace(/\s+/g, ''),
        override_agent_id: process.env.RETELL_AGENT_ID || undefined,
        metadata: {
          call_db_id: nextCall.id,
          campaign_id: campaignId,
          patient_name: nextCall.patient_name,
          patient_type: nextCall.patient_type,
          context: nextCall.context,
        },
      }),
    });

    if (!retellResponse.ok) {
      const errText = await retellResponse.text();
      console.error(`[AutoDial] Retell API error for next call: ${retellResponse.status} ${errText}`);
      // Mark this call as failed so the queue can move on
      await supabase
        .from('calls')
        .update({ status: 'failed' })
        .eq('id', nextCall.id);
      return;
    }

    const retellData = await retellResponse.json();
    const newRetellCallId = retellData.call_id;

    // Mark the next call as in_progress and store the retell_call_id
    await supabase
      .from('calls')
      .update({ status: 'in_progress', retell_call_id: newRetellCallId })
      .eq('id', nextCall.id);

    // Update campaign in_progress counter
    const { data: camp } = await supabase
      .from('campaigns')
      .select('in_progress')
      .eq('id', campaignId)
      .single();

    if (camp) {
      await supabase
        .from('campaigns')
        .update({ in_progress: (camp.in_progress || 0) + 1 })
        .eq('id', campaignId);
    }

    console.log(`[AutoDial] Next call triggered — Retell ID: ${newRetellCallId}`);
  } catch (err) {
    console.error('[AutoDial] Exception triggering next call:', err);
  }
}

// ─── Main Webhook Handler ─────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Retell Webhook Event:', JSON.stringify(body, null, 2));

    const { event, data } = body;

    // ── Handle call_started: mark the call as in_progress ──────────────────
    if (event === 'call_started') {
      if (!data?.call_id) {
        return NextResponse.json({ error: 'Missing call_id.' }, { status: 400 });
      }

      if (supabase) {
        // Try to find by retell_call_id first
        const { data: callRecord } = await supabase
          .from('calls')
          .select('id, status')
          .eq('retell_call_id', data.call_id)
          .single();

        if (callRecord && callRecord.status === 'pending') {
          await supabase
            .from('calls')
            .update({ status: 'in_progress' })
            .eq('id', callRecord.id);

          // Update campaign in_progress counter
          const { data: fullCall } = await supabase
            .from('calls')
            .select('campaign_id')
            .eq('id', callRecord.id)
            .single();

          if (fullCall?.campaign_id) {
            const { data: camp } = await supabase
              .from('campaigns')
              .select('in_progress')
              .eq('id', fullCall.campaign_id)
              .single();
            if (camp) {
              await supabase
                .from('campaigns')
                .update({ in_progress: (camp.in_progress || 0) + 1 })
                .eq('id', fullCall.campaign_id);
            }
          }
        }
      }

      return NextResponse.json({ message: 'call_started processed.' }, { status: 200 });
    }

    // ── Ignore events other than call_ended ─────────────────────────────────
    if (event !== 'call_ended') {
      return NextResponse.json({ message: `Event "${event}" ignored.` }, { status: 200 });
    }

    // ── Handle call_ended ───────────────────────────────────────────────────
    if (!data) {
      return NextResponse.json({ error: 'Missing callback data payload.' }, { status: 400 });
    }

    const { call_id, transcript, duration_ms, recording_url } = data;

    if (!call_id) {
      return NextResponse.json({ error: 'Missing call_id parameter.' }, { status: 400 });
    }

    const durationSeconds = duration_ms ? Math.round(duration_ms / 1000) : 0;
    const callStatus = durationSeconds > 0 ? 'completed' : 'failed';
    const sentiment = transcript ? detectSentiment(transcript) : 'neutral';

    if (!supabase) {
      console.warn('Supabase not configured. Sandbox mode:', { call_id, durationSeconds, callStatus, sentiment });
      return NextResponse.json({
        message: 'Callback processed in Sandbox mode (Supabase not configured).',
        processed_data: { call_id, durationSeconds, callStatus, sentiment },
      }, { status: 200 });
    }

    // 1. Find the call record by retell_call_id
    const { data: callRecord, error: findError } = await supabase
      .from('calls')
      .select('*')
      .eq('retell_call_id', call_id)
      .single();

    if (findError || !callRecord) {
      console.error(`Call not found for retell_call_id: ${call_id}`, findError);
      return NextResponse.json({ error: 'Matching call record not found.' }, { status: 404 });
    }

    // Guard: skip already-finalized calls (idempotent)
    if (callRecord.status === 'completed' || callRecord.status === 'failed') {
      return NextResponse.json({ message: 'Call status already finalized.' }, { status: 200 });
    }

    // 2. Update the call record
    const { error: updateError } = await supabase
      .from('calls')
      .update({
        status: callStatus,
        transcript: transcript || '',
        duration_seconds: durationSeconds,
        recording_url: recording_url || '',
        sentiment,
      })
      .eq('id', callRecord.id);

    if (updateError) {
      console.error(`Failed to update call ${callRecord.id}:`, updateError);
      return NextResponse.json({ error: 'Failed to update call record.' }, { status: 500 });
    }

    // 3. Update the parent campaign metrics
    if (callRecord.campaign_id) {
      const { data: campaign } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', callRecord.campaign_id)
        .single();

      if (campaign) {
        const completedIncrement = callStatus === 'completed' ? 1 : 0;
        const failedIncrement = callStatus === 'failed' ? 1 : 0;
        const newInProgress = Math.max(0, (campaign.in_progress || 0) - 1);

        await supabase
          .from('campaigns')
          .update({
            in_progress: newInProgress,
            completed: (campaign.completed || 0) + completedIncrement,
            failed: (campaign.failed || 0) + failedIncrement,
          })
          .eq('id', campaign.id);
      }

      // 4. Auto-dial the next pending call in the campaign
      await triggerNextCall(callRecord.campaign_id);
    }

    return NextResponse.json({
      message: 'Callback processed successfully.',
      call_id: callRecord.id,
      status: callStatus,
      sentiment,
    }, { status: 200 });

  } catch (error) {
    console.error('Error handling Retell callback:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
