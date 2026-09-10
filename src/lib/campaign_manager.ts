import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

export interface Campaign {
  id: string;
  name: string;
  total_patients: number;
  completed: number;
  failed: number;
  in_progress: number;
  created_at: string;
}

export interface Call {
  id: string;
  campaign_id: string;
  patient_name: string;
  contact: string;
  age: string;
  patient_type: string;
  context: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  live_state?: 'queued' | 'ringing' | 'speaking' | 'ended';
  retell_call_id?: string;
  transcript?: string;
  duration_seconds?: number;
  recording_url?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  language?: string;
  created_at: string;
  updated_at?: string;
}

interface CampaignStoreData {
  campaigns: Record<string, Campaign>;
  calls: Record<string, Call[]>;
}

const retellApiKey = process.env.RETELL_API_KEY || '';
const retellFromNumber = process.env.RETELL_FROM_NUMBER || '';
const retellAgentId = process.env.RETELL_AGENT_ID || '';
const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://health360-nu.vercel.app';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Determine storage path (fallback to /tmp in read-only serverless like Vercel)
function getStoreFilePath(): string {
  const localLibDir = path.join(process.cwd(), 'src', 'lib');
  if (fs.existsSync(localLibDir)) {
    return path.join(localLibDir, 'campaigns_store.json');
  }
  return path.join('/tmp', 'campaigns_store.json');
}

// In-memory cache
let memStore: CampaignStoreData = {
  campaigns: {},
  calls: {},
};

function loadStore(): CampaignStoreData {
  try {
    const filePath = getStoreFilePath();
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      memStore = {
        campaigns: { ...memStore.campaigns, ...data.campaigns },
        calls: { ...memStore.calls, ...data.calls },
      };
    }
  } catch (err) {
    console.warn('[CampaignManager] loadStore fallback to memory:', err);
  }
  return memStore;
}

function saveStore(data: CampaignStoreData) {
  memStore = data;
  try {
    const filePath = getStoreFilePath();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    try {
      fs.writeFileSync('/tmp/campaigns_store.json', JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Memory cache is still preserved
    }
  }
}

// ── Normalize Phone Number to E.164 ──────────────────────────────────────────
export function normalizePhone(raw: string): string {
  let cleaned = (raw || '').replace(/[\s\-()]/g, '');
  if (!cleaned.startsWith('+')) {
    if (cleaned.length === 10) {
      cleaned = `+91${cleaned}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = `+91${cleaned.slice(1)}`;
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = `+${cleaned}`;
    } else {
      cleaned = `+${cleaned}`;
    }
  }
  return cleaned;
}

// ── Fire Retell Outbound Call ────────────────────────────────────────────────
export async function fireSingleRetellCall(call: Call): Promise<string> {
  const targetNumber = normalizePhone(call.contact);
  console.log(`[CampaignManager] Dialing Retell call for ${call.patient_name} -> ${targetNumber}...`);

  const res = await fetch('https://api.retellai.com/v2/create-phone-call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${retellApiKey}`,
    },
    body: JSON.stringify({
      from_number: retellFromNumber,
      to_number: targetNumber,
      agent_id: retellAgentId,
      webhook_url: `${appUrl}/api/retell-callback`,
      metadata: {
        call_db_id: call.id,
        campaign_id: call.campaign_id,
      },
      retell_llm_dynamic_variables: {
        patient_name: call.patient_name,
        patient_type: call.patient_type || 'General',
        patient_context: call.context || 'Checking on physiotherapy progress',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Retell API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.call_id as string;
}

// ── Check Live Call Status Directly from Retell AI ───────────────────────────
export async function fetchLiveRetellCall(retellCallId: string): Promise<any> {
  try {
    const res = await fetch(`https://api.retellai.com/v2/get-call/${retellCallId}`, {
      headers: { Authorization: `Bearer ${retellApiKey}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[CampaignManager] Error fetching Retell call ${retellCallId}:`, err);
    return null;
  }
}

// ── Create and Launch Campaign ───────────────────────────────────────────────
export async function createAndLaunchCampaign(
  name: string,
  patientsList: { patient_name: string; contact: string; age?: string; patient_type?: string; context?: string; language?: string }[]
): Promise<{ campaign: Campaign; calls: Call[]; firstCallId?: string }> {
  const store = loadStore();
  const campaignId = `camp_${Date.now()}`;
  const now = new Date().toISOString();

  const newCampaign: Campaign = {
    id: campaignId,
    name,
    total_patients: patientsList.length,
    completed: 0,
    failed: 0,
    in_progress: patientsList.length > 0 ? 1 : 0,
    created_at: now,
  };

  const newCalls: Call[] = patientsList.map((p, idx) => ({
    id: `call_${Date.now()}_${idx}`,
    campaign_id: campaignId,
    patient_name: p.patient_name,
    contact: p.contact,
    age: p.age || '',
    patient_type: p.patient_type || 'General',
    context: p.context || '',
    language: p.language || 'Hindi',
    status: idx === 0 ? 'in_progress' : 'pending',
    live_state: idx === 0 ? 'ringing' : 'queued',
    created_at: now,
    updated_at: now,
  }));

  // Store in memory & file immediately
  store.campaigns[campaignId] = newCampaign;
  store.calls[campaignId] = newCalls;
  saveStore(store);

  // Attempt async sync to Supabase (non-blocking)
  if (supabase) {
    try {
      const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000));
      await Promise.race([
        supabase.from('campaigns').insert([{
          id: newCampaign.id,
          name: newCampaign.name,
          total_patients: newCampaign.total_patients,
          completed: 0,
          failed: 0,
          in_progress: 1,
        }]),
        timeoutPromise,
      ]);
      await Promise.race([
        supabase.from('calls').insert(newCalls.map(c => ({
          id: c.id,
          campaign_id: c.campaign_id,
          patient_name: c.patient_name,
          contact: c.contact,
          age: c.age,
          patient_type: c.patient_type,
          context: c.context,
          language: c.language,
          status: c.status,
        }))),
        timeoutPromise,
      ]);
    } catch {
      // Supabase is paused or timed out; memory store has 100% of data
    }
  }

  // Dial first patient
  if (newCalls.length > 0) {
    const firstCall = newCalls[0];
    try {
      const retellCallId = await fireSingleRetellCall(firstCall);
      firstCall.retell_call_id = retellCallId;
      firstCall.live_state = 'ringing';
      saveStore(store);

      if (supabase) {
        Promise.resolve(supabase.from('calls').update({ retell_call_id: retellCallId, status: 'in_progress' }).eq('id', firstCall.id)).catch(() => {});
      }
      return { campaign: newCampaign, calls: newCalls, firstCallId: retellCallId };
    } catch (err: any) {
      console.error('[CampaignManager] Failed to fire first call:', err.message);
      firstCall.status = 'failed';
      firstCall.live_state = 'ended';
      newCampaign.in_progress = 0;
      newCampaign.failed = 1;
      saveStore(store);
      throw err;
    }
  }

  return { campaign: newCampaign, calls: newCalls };
}

// ── Trigger Next Pending Call in Campaign ────────────────────────────────────
export async function triggerNextCampaignCall(campaignId: string): Promise<Call | null> {
  const store = loadStore();
  const campaign = store.campaigns[campaignId];
  const calls = store.calls[campaignId] || [];

  if (!campaign) return null;

  // Find next pending call
  const nextCall = calls.find(c => c.status === 'pending');
  if (!nextCall) {
    console.log(`[CampaignManager] Campaign ${campaignId} has no more pending calls.`);
    campaign.in_progress = 0;
    saveStore(store);
    return null;
  }

  console.log(`[CampaignManager] Advancing queue -> calling ${nextCall.patient_name} (${nextCall.contact})...`);
  nextCall.status = 'in_progress';
  nextCall.live_state = 'ringing';
  nextCall.updated_at = new Date().toISOString();
  campaign.in_progress = 1;
  saveStore(store);

  try {
    const retellCallId = await fireSingleRetellCall(nextCall);
    nextCall.retell_call_id = retellCallId;
    saveStore(store);

    if (supabase) {
      Promise.resolve(supabase.from('calls').update({ status: 'in_progress', retell_call_id: retellCallId }).eq('id', nextCall.id)).catch(() => {});
    }

    return nextCall;
  } catch (err: any) {
    console.error(`[CampaignManager] Error dialing ${nextCall.patient_name}:`, err.message);
    nextCall.status = 'failed';
    nextCall.live_state = 'ended';
    campaign.failed += 1;
    saveStore(store);

    // Recursively attempt the next one
    return triggerNextCampaignCall(campaignId);
  }
}

// ── Poll and Refresh Campaign Status with Live Retell Feedback ───────────────
export async function getAndSyncCampaign(campaignId: string): Promise<{ campaign: Campaign | null; calls: Call[] }> {
  const store = loadStore();
  const campaign = store.campaigns[campaignId];
  const calls = store.calls[campaignId] || [];

  if (!campaign) {
    return { campaign: null, calls: [] };
  }

  // Look for any call currently marked in_progress
  const activeCall = calls.find(c => c.status === 'in_progress');
  if (activeCall && activeCall.retell_call_id) {
    const retellData = await fetchLiveRetellCall(activeCall.retell_call_id);
    if (retellData) {
      const callStatus = retellData.call_status; // 'registered' | 'ongoing' | 'ended' | 'not_connected'

      if (callStatus === 'registered') {
        activeCall.live_state = 'ringing';
      } else if (callStatus === 'ongoing') {
        activeCall.live_state = 'speaking';
        if (retellData.start_timestamp) {
          activeCall.duration_seconds = Math.max(1, Math.round((Date.now() - retellData.start_timestamp) / 1000));
        }
      } else if (callStatus === 'ended' || callStatus === 'not_connected') {
        const durationSec = retellData.duration_ms ? Math.round(retellData.duration_ms / 1000) : 0;
        const failedReason = ['voicemail_reached', 'dial_busy', 'dial_failed', 'dial_no_answer', 'not_connected', 'connection_lost'].includes(retellData.disconnection_reason);

        const isSuccess = durationSec > 5 && !failedReason;
        activeCall.status = isSuccess ? 'completed' : 'failed';
        activeCall.live_state = 'ended';
        activeCall.duration_seconds = durationSec;
        activeCall.recording_url = retellData.recording_url || activeCall.recording_url;
        activeCall.transcript = retellData.transcript || activeCall.transcript;
        activeCall.updated_at = new Date().toISOString();

        if (isSuccess) {
          campaign.completed += 1;
        } else {
          campaign.failed += 1;
        }
        campaign.in_progress = Math.max(0, campaign.in_progress - 1);

        saveStore(store);

        if (supabase) {
          Promise.resolve(supabase.from('calls').update({
            status: activeCall.status,
            duration_seconds: durationSec,
            recording_url: activeCall.recording_url,
            transcript: activeCall.transcript,
          }).eq('id', activeCall.id)).catch(() => {});

          Promise.resolve(supabase.from('campaigns').update({
            completed: campaign.completed,
            failed: campaign.failed,
            in_progress: campaign.in_progress,
            status: (campaign.completed + campaign.failed >= campaign.total_patients) ? 'completed' : 'in_progress',
          }).eq('id', campaign.id)).catch(() => {});
        }

        // Call ended! Automatically advance to the NEXT patient in queue!
        console.log(`[CampaignManager] Call ${activeCall.id} ended. Immediately triggering next call in queue...`);
        await triggerNextCampaignCall(campaignId);
      }

      saveStore(store);
    }
  }

  return { campaign, calls };
}

// ── Get All Campaigns ────────────────────────────────────────────────────────
export async function getAllCampaigns(): Promise<Campaign[]> {
  const store = loadStore();
  const localList = Object.values(store.campaigns);

  if (supabase) {
    try {
      const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        const map = new Map<string, Campaign>();
        data.forEach((c: Campaign) => map.set(c.id, c));
        localList.forEach(c => map.set(c.id, c)); // in-flight local takes priority
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      }
    } catch {
      // fallback
    }
  }

  return localList.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// ── Update Call from Retell Webhook ──────────────────────────────────────────
export async function updateCallFromWebhook(
  event: string,
  callData: any
): Promise<{ success: boolean; nextCallFired?: boolean }> {
  const retellCallId = callData?.call_id;
  const campaignId = callData?.metadata?.campaign_id;
  const callDbId = callData?.metadata?.call_db_id;

  if (!retellCallId && !callDbId) return { success: false };

  const store = loadStore();
  let foundCall: Call | undefined;
  let targetCampaignId = campaignId;

  // Locate call
  for (const cId of Object.keys(store.calls)) {
    const match = store.calls[cId].find(c => c.retell_call_id === retellCallId || c.id === callDbId);
    if (match) {
      foundCall = match;
      targetCampaignId = cId;
      break;
    }
  }

  if (!foundCall) return { success: false };

  const campaign = store.campaigns[targetCampaignId];

  if (event === 'call_started') {
    foundCall.status = 'in_progress';
    foundCall.live_state = 'speaking';
    foundCall.retell_call_id = retellCallId;
    saveStore(store);

    if (supabase) {
      Promise.resolve(supabase.from('calls').update({
        status: 'in_progress',
        retell_call_id: retellCallId,
      }).eq('id', foundCall.id)).catch(() => {});
    }
    return { success: true };
  }

  if (event === 'call_ended') {
    const durationMs = callData?.duration_ms || callData?.call_duration_ms || 0;
    const durationSec = Math.round(durationMs / 1000);
    const disconnectionReason = callData?.disconnection_reason || '';
    const failedReason = ['voicemail_reached', 'dial_busy', 'dial_failed', 'dial_no_answer', 'not_connected', 'connection_lost'].includes(disconnectionReason);

    const isSuccess = durationSec > 5 && !failedReason;
    foundCall.status = isSuccess ? 'completed' : 'failed';
    foundCall.live_state = 'ended';
    foundCall.duration_seconds = durationSec;
    foundCall.recording_url = callData?.recording_url || foundCall.recording_url;
    foundCall.transcript = callData?.transcript || foundCall.transcript;
    foundCall.updated_at = new Date().toISOString();

    if (campaign) {
      if (isSuccess) campaign.completed += 1;
      else campaign.failed += 1;
      campaign.in_progress = Math.max(0, campaign.in_progress - 1);
    }
    saveStore(store);

    if (supabase) {
      Promise.resolve(supabase.from('calls').update({
        status: foundCall.status,
        duration_seconds: durationSec,
        recording_url: foundCall.recording_url,
        transcript: foundCall.transcript,
      }).eq('id', foundCall.id)).catch(() => {});

      if (campaign) {
        Promise.resolve(supabase.from('campaigns').update({
          completed: campaign.completed,
          failed: campaign.failed,
          in_progress: campaign.in_progress,
          status: (campaign.completed + campaign.failed >= campaign.total_patients) ? 'completed' : 'in_progress',
        }).eq('id', campaign.id)).catch(() => {});
      }
    }

    // Auto-dial next patient in queue
    console.log(`[Webhook] Call finished for ${foundCall.patient_name}. Advancing queue for campaign ${targetCampaignId}...`);
    const nextCall = await triggerNextCampaignCall(targetCampaignId);
    return { success: true, nextCallFired: !!nextCall };
  }

  if (event === 'call_analyzed') {
    if (callData?.transcript) foundCall.transcript = callData.transcript;
    saveStore(store);
    return { success: true };
  }

  return { success: true };
}
