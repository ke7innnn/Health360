import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Multilingual Sentiment Keyword Detector
function detectSentiment(transcript: string): 'positive' | 'neutral' | 'negative' {
  const text = transcript.toLowerCase();
  
  // Hindi, Marathi, and English positive terms
  const positiveKeywords = [
    'relief', 'satisfied', 'better', 'good', 'improved', 'happy', 'healing', 'well', 'great', 'fine', 'yes',
    'आराम', 'अच्छा', 'ठीक', 'सुधार', 'धन्यवाद', 'आभारी', 'कमी', 'फरक', 'बरं', 'हो', 'योग्य'
  ];
  
  // Hindi, Marathi, and English negative/pain terms
  const negativeKeywords = [
    'pain', 'worse', 'bad', 'stiff', 'ache', 'hurts', 'swelling', 'cramp', 'dislike', 'unsatisfied', 'no',
    'दर्द', 'दुखत', 'त्रास', 'कठीण', 'सूज', 'कमी नाही', 'वाढले', 'गंभीर', 'नाही'
  ];
  
  let positiveScore = 0;
  let negativeScore = 0;
  
  positiveKeywords.forEach(word => {
    const regex = new RegExp(word, 'g');
    const matches = text.match(regex);
    if (matches) positiveScore += matches.length;
  });
  
  negativeKeywords.forEach(word => {
    const regex = new RegExp(word, 'g');
    const matches = text.match(regex);
    if (matches) negativeScore += matches.length;
  });
  
  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('Received Retell Webhook Callback:', JSON.stringify(body, null, 2));

    const { event, data } = body;

    // Check for call ended events
    if (event !== 'call_ended') {
      return NextResponse.json({ message: 'Event ignored. Only call_ended is processed.' }, { status: 200 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Missing callback data payload.' }, { status: 400 });
    }

    const { call_id, transcript, duration_ms, recording_url } = data;
    
    if (!call_id) {
      return NextResponse.json({ error: 'Missing call_id parameter.' }, { status: 400 });
    }

    const durationSeconds = duration_ms ? Math.round(duration_ms / 1000) : 0;
    
    // Determine status (completed if duration > 0, otherwise failed)
    const callStatus = durationSeconds > 0 ? 'completed' : 'failed';
    const sentiment = transcript ? detectSentiment(transcript) : 'neutral';

    if (!supabase) {
      console.warn('Supabase is not configured. Retell callback received but skipped DB write. Data processed:', {
        call_id,
        durationSeconds,
        callStatus,
        sentiment
      });
      return NextResponse.json({ 
        message: 'Callback processed in Sandbox mode (Supabase is not configured).',
        processed_data: { call_id, durationSeconds, callStatus, sentiment }
      }, { status: 200 });
    }

    // 1. Find the call with the matching retell_call_id
    const { data: callRecord, error: findError } = await supabase
      .from('calls')
      .select('*')
      .eq('retell_call_id', call_id)
      .single();

    if (findError || !callRecord) {
      console.error(`Call not found in database for retell_call_id: ${call_id}`, findError);
      return NextResponse.json({ error: 'Matching call record not found.' }, { status: 404 });
    }

    // Guard: check if status has already been finalized to avoid double counting
    if (callRecord.status === 'completed' || callRecord.status === 'failed') {
      return NextResponse.json({ message: 'Call status already finalized in database.' }, { status: 200 });
    }

    // 2. Update the call record with Retell metadata
    const { error: updateError } = await supabase
      .from('calls')
      .update({
        status: callStatus,
        transcript: transcript || '',
        duration_seconds: durationSeconds,
        recording_url: recording_url || '',
        sentiment: sentiment
      })
      .eq('id', callRecord.id);

    if (updateError) {
      console.error(`Failed to update call record ${callRecord.id}:`, updateError);
      return NextResponse.json({ error: 'Failed to update call record.' }, { status: 500 });
    }

    // 3. Update the parent campaign completion / progress metrics
    if (callRecord.campaign_id) {
      const { data: campaign, error: campFindError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', callRecord.campaign_id)
        .single();

      if (campaign && !campFindError) {
        const completedIncrement = callStatus === 'completed' ? 1 : 0;
        const failedIncrement = callStatus === 'failed' ? 1 : 0;
        // Shift in_progress down
        const newInProgress = Math.max(0, (campaign.in_progress || 0) - 1);

        const { error: campUpdateError } = await supabase
          .from('campaigns')
          .update({
            in_progress: newInProgress,
            completed: (campaign.completed || 0) + completedIncrement,
            failed: (campaign.failed || 0) + failedIncrement
          })
          .eq('id', campaign.id);

        if (campUpdateError) {
          console.error(`Failed to update campaign ${callRecord.campaign_id} stats:`, campUpdateError);
        }
      }
    }

    return NextResponse.json({ 
      message: 'Callback processed successfully.',
      call_id: callRecord.id,
      status: callStatus,
      sentiment
    }, { status: 200 });

  } catch (error) {
    console.error('Error handling Retell callback:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
