import { createClient } from '@supabase/supabase-js';

// Types matching Supabase schema
export interface Campaign {
  id: string;
  name: string;
  total_patients: number;
  completed: number;
  failed: number;
  in_progress: number;
  created_at: string;
}

export interface ProjectPatient {
  patient_name: string;
  contact: string;
  age: string;
  patient_type: string;
  context: string;
  language?: string;
}

export interface Patient {
  id: string;
  patient_name: string;
  contact: string;
  age: string;
  patient_type: string;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  patients: ProjectPatient[];
  created_at: string;
}

export interface Call {
  id: string;
  campaign_id?: string;
  patient_name: string;
  contact: string;
  age: string;
  patient_type: string;
  context: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  retell_call_id?: string;
  transcript?: string;
  duration_seconds?: number;
  recording_url?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  language?: string;
  created_at: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Mock Data Templates for Simulating Calls
const PATIENT_TYPES = ['Knee Pain', 'Lower Back Pain', 'Frozen Shoulder', 'Post-Sprain Rehab', 'Cervical Spondylosis'];
const LANGUAGES = ['English', 'Hindi', 'Marathi'];
const SENTIMENTS: ('positive' | 'neutral' | 'negative')[] = ['positive', 'neutral', 'negative'];

const MOCK_TRANSCRIPTS = {
  English: `Agent: Hello, this is Health 360 Physiotherapy. Am I speaking with the patient?
User: Yes, this is they.
Agent: I am calling to check on your shoulder recovery. Are you doing the daily stretches we recommended?
User: Yes, I am doing them twice a day. The stiffness has gone down a lot.
Agent: That is wonderful news! Keep doing them. Would you like to schedule your next follow-up this Friday at 10 AM?
User: Yes, that timing works perfectly for me. Thank you.
Agent: Excellent, we have booked you in. See you on Friday!`,
  Hindi: `Agent: नमस्ते, मैं हेल्थ 360 फिजियोथेरेपी से बात कर रही हूँ। क्या मैं मरीज़ से बात कर सकती हूँ?
User: हाँ, मैं ही बोल रहा हूँ। बताइए।
Agent: मैं आपके घुटने के दर्द की फिजियोथेरेपी के बारे में पूछने के लिए कॉल कर रही हूँ। क्या आप रोज़ाना व्यायाम कर रहे हैं?
User: हाँ, मैं रोज़ सुबह व्यायाम करता हूँ। अब दर्द में काफी आराम है, चलने में भी आसानी हो रही है।
Agent: बहुत बढ़िया! कृपया व्यायाम जारी रखें। क्या हम आपकी अगली अपॉइंटमेंट बुधवार सुबह 11 बजे रख दें?
User: हाँ, बिल्कुल। मैं समय पर आ जाऊँगा। धन्यवाद।
Agent: धन्यवाद! अपना ख्याल रखिएगा।`,
  Marathi: `Agent: नमस्कार, मी हेल्थ 360 फिजिओथेरेपी मधून बोलत आहे. मी पेशंटशी बोलू शकते का?
User: हो, मीच बोलतोय. सांगा.
Agent: तुमच्या पाठीच्या दुखापतीसाठी दिलेला व्यायाम तुम्ही घरी करत आहात का? आता कसा फरक वाटतोय?
User: हो, मी रोज सकाळी व्यायाम करतोय. आता पाठदुखी खूप कमी झाली आहे, आधीपेक्षा खूप बरं वाटतंय.
Agent: ऐकून खूप आनंद झाला! आपण पुढची अपॉइंटमेंट शनिवार दुपारी ४ वाजता निश्चित करूया का?
User: हो चालेल, मी शनिवार दुपारी ४ वाजता येईन.
Agent: धन्यवाद, काळजी घ्या!`
};

const MOCK_RECORDINGS = [
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
  'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
];

// Helper to load mock data from localStorage
const getLocalStorageData = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
};

const setLocalStorageData = <T>(key: string, data: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error('LocalStorage write error:', err);
  }
};

// Global subscription registry for Mock Realtime
type SubscriptionCallback = (payload: { event: string; table: string; record: any }) => void;
const subscribers = new Set<SubscriptionCallback>();

export const subscribeToRealtime = (callback: SubscriptionCallback) => {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
};

const notifySubscribers = (event: string, table: string, record: any) => {
  subscribers.forEach(cb => cb({ event, table, record }));
};

import INITIAL_PATIENTS from './all_patients.json';

// INITIAL SEED MOCK DATA
const seedMockData = () => {
  if (typeof window === 'undefined') return;
  
  const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
  const calls = getLocalStorageData<Call[]>('h360_calls', []);
  const patients = getLocalStorageData<Patient[]>('h360_patients', []);

  if (patients.length < 10) {
    setLocalStorageData('h360_patients', INITIAL_PATIENTS as Patient[]);
  }

  if (campaigns.length === 0 || calls.length === 0) {
    const initialCampaigns: Campaign[] = [
      {
        id: 'c1',
        name: 'Knee Pain Follow-up Batch A',
        total_patients: 12,
        completed: 8,
        failed: 2,
        in_progress: 0,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'c2',
        name: 'Post-Sprain Survey',
        total_patients: 8,
        completed: 6,
        failed: 1,
        in_progress: 1,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const initialCalls: Call[] = [
      {
        id: 'call1',
        campaign_id: 'c1',
        patient_name: 'Rahul Sharma',
        contact: '+91 98765 43210',
        age: '45',
        patient_type: 'Knee Pain',
        context: 'Post-surgery follow up 3 weeks',
        status: 'completed',
        duration_seconds: 45,
        sentiment: 'positive',
        language: 'Hindi',
        recording_url: MOCK_RECORDINGS[0],
        transcript: MOCK_TRANSCRIPTS.Hindi,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString()
      },
      {
        id: 'call2',
        campaign_id: 'c1',
        patient_name: 'Sunita Patil',
        contact: '+91 98234 56789',
        age: '62',
        patient_type: 'Knee Pain',
        context: 'Routine check for osteoarthritis treatment',
        status: 'completed',
        duration_seconds: 78,
        sentiment: 'positive',
        language: 'Marathi',
        recording_url: MOCK_RECORDINGS[1],
        transcript: MOCK_TRANSCRIPTS.Marathi,
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 20 * 60 * 1000).toISOString()
      },
      {
        id: 'call3',
        campaign_id: 'c1',
        patient_name: 'David Miller',
        contact: '+91 99112 23344',
        age: '38',
        patient_type: 'Frozen Shoulder',
        context: 'First session checkin',
        status: 'failed',
        duration_seconds: 0,
        recording_url: '',
        transcript: '',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
      },
      ...Array.from({ length: 6 }).map((_, i) => ({
        id: `c1_auto_${i}`,
        campaign_id: 'c1',
        patient_name: `Patient ${i + 1}`,
        contact: `+91 91234 5678${i}`,
        age: String(30 + i * 5),
        patient_type: PATIENT_TYPES[i % PATIENT_TYPES.length],
        context: 'General follow up',
        status: (i === 5 ? 'failed' : 'completed') as any,
        duration_seconds: i === 5 ? 0 : 50 + i * 12,
        sentiment: SENTIMENTS[i % SENTIMENTS.length],
        language: LANGUAGES[i % LANGUAGES.length],
        recording_url: i === 5 ? '' : MOCK_RECORDINGS[i % MOCK_RECORDINGS.length],
        transcript: i === 5 ? '' : (MOCK_TRANSCRIPTS as any)[LANGUAGES[i % LANGUAGES.length]],
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + (40 + i * 10) * 60 * 1000).toISOString()
      })),
      {
        id: 'call_c2_1',
        campaign_id: 'c2',
        patient_name: 'Anjali Deshmukh',
        contact: '+91 88776 65544',
        age: '29',
        patient_type: 'Post-Sprain Rehab',
        context: 'Ankle sprain progress check',
        status: 'completed',
        duration_seconds: 62,
        sentiment: 'neutral',
        language: 'Marathi',
        recording_url: MOCK_RECORDINGS[2],
        transcript: MOCK_TRANSCRIPTS.Marathi,
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString()
      },
      {
        id: 'call_c2_2',
        campaign_id: 'c2',
        patient_name: 'Karan Malhotra',
        contact: '+91 90088 77665',
        age: '54',
        patient_type: 'Lower Back Pain',
        context: 'L4-L5 disc pain feedback',
        status: 'in_progress',
        duration_seconds: 15,
        language: 'Hindi',
        recording_url: '',
        transcript: '',
        created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString()
      },
      ...Array.from({ length: 6 }).map((_, i) => ({
        id: `c2_auto_${i}`,
        campaign_id: 'c2',
        patient_name: `Patient B-${i + 1}`,
        contact: `+91 95432 1000${i}`,
        age: String(25 + i * 7),
        patient_type: PATIENT_TYPES[i % PATIENT_TYPES.length],
        context: 'Weekly progress survey',
        status: (i === 4 ? 'failed' : 'completed') as any,
        duration_seconds: i === 4 ? 0 : 40 + i * 8,
        sentiment: SENTIMENTS[i % SENTIMENTS.length],
        language: LANGUAGES[i % LANGUAGES.length],
        recording_url: i === 4 ? '' : MOCK_RECORDINGS[i % MOCK_RECORDINGS.length],
        transcript: i === 4 ? '' : (MOCK_TRANSCRIPTS as any)[LANGUAGES[i % LANGUAGES.length]],
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000 + (20 + i * 15) * 60 * 1000).toISOString()
      }))
    ];

    setLocalStorageData('h360_campaigns', initialCampaigns);
    setLocalStorageData('h360_calls', initialCalls);
  }
};

// Execute seed
seedMockData();

// Helper to safely execute Supabase queries with strict timeout and fallback to localStorage cache
async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  fallbackFn: () => T,
  storageKey?: string,
  timeoutMs: number = 2500
): Promise<T> {
  if (!isSupabaseConfigured || !supabase) {
    return fallbackFn();
  }

  try {
    const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase query timeout')), timeoutMs)
    );

    const result = await Promise.race([queryFn(), timeoutPromise]);
    if (result.error || !result.data) {
      console.warn('[Supabase] Query error/empty, using fallback:', result.error?.message || 'No data');
      return fallbackFn();
    }
    // Update local cache if storageKey provided
    if (storageKey && Array.isArray(result.data) && result.data.length > 0) {
      setLocalStorageData(storageKey, result.data);
    }
    return result.data;
  } catch (err: any) {
    console.warn('[Supabase] Fetch failed or timed out, using fallback cache:', err?.message || err);
    return fallbackFn();
  }
}

// Database API Wrapper
export const db = {
  async getPatients(): Promise<Patient[]> {
    return safeQuery(
      async () => {
        const { data, error } = await supabase!.from('patients').select('*').order('created_at', { ascending: false });
        return { data, error };
      },
      () => getLocalStorageData<Patient[]>('h360_patients', []),
      'h360_patients'
    );
  },

  async upsertPatients(patients: Omit<Patient, 'id' | 'created_at'>[]): Promise<void> {
    if (patients.length === 0) return;
    
    // Always update local storage first for instant UI response
    const existing = getLocalStorageData<Patient[]>('h360_patients', []);
    for (const p of patients) {
      const idx = existing.findIndex(e => e.contact === p.contact);
      if (idx >= 0) {
        existing[idx] = { ...existing[idx], ...p };
      } else {
        existing.unshift({
          id: `pat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          ...p,
          created_at: new Date().toISOString()
        });
      }
    }
    setLocalStorageData('h360_patients', existing);
    notifySubscribers('REFRESH', 'patients', null);

    if (isSupabaseConfigured && supabase) {
      try {
        const payload = patients.map(p => ({
          patient_name: p.patient_name,
          contact: p.contact,
          age: p.age,
          patient_type: p.patient_type
        }));
        await supabase.from('patients').upsert(payload, { onConflict: 'contact' });
      } catch (e) {
        console.warn('[Supabase] Non-blocking upsert error:', e);
      }
    }
  },

  // Projects (Patient Lists)
  async getProjects(): Promise<Project[]> {
    return safeQuery(
      async () => {
        const { data, error } = await supabase!.from('projects').select('*').order('created_at', { ascending: false });
        return { data, error };
      },
      () => getLocalStorageData<Project[]>('h360_projects', []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      'h360_projects'
    );
  },

  async getProject(id: string): Promise<Project | null> {
    return safeQuery(
      async () => {
        const { data, error } = await supabase!.from('projects').select('*').eq('id', id).single();
        return { data, error };
      },
      () => {
        const projects = getLocalStorageData<Project[]>('h360_projects', []);
        return projects.find(p => p.id === id) || null;
      }
    );
  },

  async createProject(name: string, patients: ProjectPatient[]): Promise<Project> {
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name,
      patients,
      created_at: new Date().toISOString()
    };
    const projects = getLocalStorageData<Project[]>('h360_projects', []);
    projects.unshift(newProject);
    setLocalStorageData('h360_projects', projects);
    notifySubscribers('INSERT', 'projects', newProject);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from('projects').insert([{ name, patients }]).select().single();
        if (data) return data;
      } catch (e) {
        console.warn('[Supabase] Project insert error:', e);
      }
    }
    return newProject;
  },

  async updateProject(id: string, name: string, patients: ProjectPatient[]): Promise<Project> {
    const projects = getLocalStorageData<Project[]>('h360_projects', []);
    const idx = projects.findIndex(p => p.id === id);
    let updatedProj = projects[idx] || { id, name, patients, created_at: new Date().toISOString() };
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], name, patients };
      updatedProj = projects[idx];
      setLocalStorageData('h360_projects', projects);
      notifySubscribers('UPDATE', 'projects', updatedProj);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from('projects').update({ name, patients }).eq('id', id).select().single();
        if (data) return data;
      } catch (e) {
        console.warn('[Supabase] Project update error:', e);
      }
    }
    return updatedProj;
  },

  async deleteProject(id: string): Promise<void> {
    const projects = getLocalStorageData<Project[]>('h360_projects', []);
    setLocalStorageData('h360_projects', projects.filter(p => p.id !== id));
    notifySubscribers('REFRESH', 'all', null);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('projects').delete().eq('id', id);
      } catch (e) {
        console.warn('[Supabase] Project delete error:', e);
      }
    }
  },

  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    return safeQuery(
      async () => {
        const { data, error } = await supabase!.from('campaigns').select('*').order('created_at', { ascending: false });
        return { data, error };
      },
      () => getLocalStorageData<Campaign[]>('h360_campaigns', []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      'h360_campaigns'
    );
  },

  async getCampaign(id: string): Promise<Campaign | null> {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.campaign) {
          const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
          const idx = campaigns.findIndex(c => c.id === id);
          if (idx >= 0) campaigns[idx] = data.campaign;
          else campaigns.unshift(data.campaign);
          setLocalStorageData('h360_campaigns', campaigns);
          return data.campaign;
        }
      }
    } catch {
      // fallback
    }

    return safeQuery(
      async () => {
        const { data, error } = await supabase!.from('campaigns').select('*').eq('id', id).single();
        return { data, error };
      },
      () => {
        const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
        return campaigns.find(c => c.id === id) || null;
      }
    );
  },

  async deleteCampaign(id: string): Promise<void> {
    const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    setLocalStorageData('h360_campaigns', campaigns.filter(c => c.id !== id));
    setLocalStorageData('h360_calls', calls.filter(c => c.campaign_id !== id));
    notifySubscribers('REFRESH', 'all', null);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('calls').delete().eq('campaign_id', id);
        await supabase.from('campaigns').delete().eq('id', id);
      } catch (e) {
        console.warn('[Supabase] Campaign delete error:', e);
      }
    }
  },

  async createCampaign(name: string, patients: Omit<Call, 'id' | 'status' | 'created_at'>[]): Promise<Campaign> {
    try {
      const res = await fetch('/api/start-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, patients }),
      });

      if (res.ok) {
        const result = await res.json();
        if (result.campaign) {
          const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
          campaigns.unshift(result.campaign);
          setLocalStorageData('h360_campaigns', campaigns);

          if (result.calls) {
            const calls = getLocalStorageData<Call[]>('h360_calls', []);
            setLocalStorageData('h360_calls', [...result.calls, ...calls]);
          }

          notifySubscribers('INSERT', 'campaigns', result.campaign);
          return result.campaign;
        }
      }
    } catch (e) {
      console.warn('[StartCampaign API] Cloud start error, fallback to local:', e);
    }

    // Local fallback creation if network fails completely
    const campaignId = `camp_${Date.now()}`;
    const total = patients.length;

    const newCamp: Campaign = {
      id: campaignId,
      name,
      total_patients: total,
      completed: 0,
      failed: 0,
      in_progress: total > 0 ? 1 : 0,
      created_at: new Date().toISOString()
    };

    const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
    campaigns.unshift(newCamp);
    setLocalStorageData('h360_campaigns', campaigns);

    const newCalls: Call[] = patients.map((p, idx) => ({
      id: `call_${Date.now()}_${idx}`,
      campaign_id: newCamp.id,
      patient_name: p.patient_name,
      contact: p.contact,
      age: p.age,
      patient_type: p.patient_type,
      context: p.context,
      language: p.language || LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)],
      status: idx === 0 ? 'in_progress' : 'pending',
      live_state: idx === 0 ? 'ringing' : 'queued',
      created_at: new Date().toISOString()
    }));

    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    setLocalStorageData('h360_calls', [...newCalls, ...calls]);

    notifySubscribers('INSERT', 'campaigns', newCamp);
    return newCamp;
  },

  async retryFailedCampaignCalls(campaignId: string): Promise<void> {
    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);

    const failedCount = calls.filter(c => c.campaign_id === campaignId && c.status === 'failed').length;
    if (failedCount > 0) {
      calls.forEach(c => {
        if (c.campaign_id === campaignId && c.status === 'failed') {
          c.status = 'pending';
        }
      });
      const camp = campaigns.find(c => c.id === campaignId);
      if (camp) {
        camp.failed = Math.max(0, camp.failed - failedCount);
      }
      setLocalStorageData('h360_calls', calls);
      setLocalStorageData('h360_campaigns', campaigns);
      notifySubscribers('REFRESH', 'all', null);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: failedCalls } = await supabase
          .from('calls')
          .select('id')
          .eq('campaign_id', campaignId)
          .eq('status', 'failed');

        if (failedCalls && failedCalls.length > 0) {
          const ids = failedCalls.map(c => c.id);
          await supabase.from('calls').update({ status: 'pending' }).in('id', ids);
          const { data: camp } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
          if (camp) {
            await supabase.from('campaigns').update({
              failed: Math.max(0, camp.failed - ids.length)
            }).eq('id', campaignId);
          }
        }
      } catch (e) {
        console.warn('[Supabase] Retry campaign error:', e);
      }
    }
  },

  async retryAllFailedCalls(): Promise<void> {
    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);

    let updated = false;
    campaigns.forEach(camp => {
      const count = calls.filter(c => c.campaign_id === camp.id && c.status === 'failed').length;
      if (count > 0) {
        camp.failed = Math.max(0, camp.failed - count);
        updated = true;
      }
    });

    calls.forEach(c => {
      if (c.status === 'failed') {
        c.status = 'pending';
        updated = true;
      }
    });

    if (updated) {
      setLocalStorageData('h360_calls', calls);
      setLocalStorageData('h360_campaigns', campaigns);
      notifySubscribers('REFRESH', 'all', null);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: failedCalls } = await supabase.from('calls').select('id, campaign_id').eq('status', 'failed');
        if (failedCalls && failedCalls.length > 0) {
          const ids = failedCalls.map(c => c.id);
          await supabase.from('calls').update({ status: 'pending' }).in('id', ids);
        }
      } catch (e) {
        console.warn('[Supabase] Retry all error:', e);
      }
    }
  },

  // Calls
  async getCalls(): Promise<Call[]> {
    return safeQuery(
      async () => {
        const { data, error } = await supabase!.from('calls').select('*').order('created_at', { ascending: false });
        return { data, error };
      },
      () => getLocalStorageData<Call[]>('h360_calls', []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      'h360_calls'
    );
  },

  async getCall(id: string): Promise<Call | null> {
    return safeQuery(
      async () => {
        const { data, error } = await supabase!.from('calls').select('*').eq('id', id).single();
        return { data, error };
      },
      () => {
        const calls = getLocalStorageData<Call[]>('h360_calls', []);
        return calls.find(c => c.id === id) || null;
      }
    );
  },

  async getCampaignCalls(campaignId: string): Promise<Call[]> {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.calls && data.calls.length > 0) {
          const allCalls = getLocalStorageData<Call[]>('h360_calls', []);
          const otherCalls = allCalls.filter(c => c.campaign_id !== campaignId);
          setLocalStorageData('h360_calls', [...data.calls, ...otherCalls]);
          return data.calls;
        }
      }
    } catch {
      // fallback
    }

    return safeQuery(
      async () => {
        const { data, error } = await supabase!.from('calls').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true });
        return { data, error };
      },
      () => {
        const calls = getLocalStorageData<Call[]>('h360_calls', []);
        return calls.filter(c => c.campaign_id === campaignId);
      }
    );
  },

  async triggerSingleCall(callId: string): Promise<void> {
    let callRecord: Call | null = null;

    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
    const call = calls.find(c => c.id === callId);
    if (call) {
      callRecord = call;
      if (call.campaign_id) {
        const camp = campaigns.find(c => c.id === call.campaign_id);
        if (camp) {
          if (call.status === 'completed') camp.completed = Math.max(0, camp.completed - 1);
          if (call.status === 'failed') camp.failed = Math.max(0, camp.failed - 1);
        }
      }
      call.status = 'pending';
      setLocalStorageData('h360_calls', calls);
      setLocalStorageData('h360_campaigns', campaigns);
      notifySubscribers('UPDATE', 'calls', call);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase.from('calls').select('*').eq('id', callId).single();
        if (data) {
          callRecord = data;
          await supabase.from('calls').update({ status: 'pending' }).eq('id', callId);
        }
      } catch (e) {
        console.warn('[Supabase] Trigger single call update error:', e);
      }
    }

    // Fire Retell outbound call
    if (callRecord) {
      fetch('/api/start-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Retry: ${callRecord.patient_name}`,
          patients: [{
            patient_name: callRecord.patient_name,
            contact: callRecord.contact,
            age: callRecord.age,
            patient_type: callRecord.patient_type,
            context: callRecord.context,
            language: callRecord.language,
          }]
        })
      }).catch(err => console.error('Failed to trigger single call via start-campaign:', err));
    }
  },

  async triggerNewSingleCallForPatient(patient: Omit<Call, 'id' | 'status' | 'created_at'>): Promise<Call> {
    const newCall: Call = {
      id: `call_${Date.now()}`,
      patient_name: patient.patient_name,
      contact: patient.contact,
      age: patient.age,
      patient_type: patient.patient_type,
      context: patient.context,
      language: patient.language || LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)],
      status: 'pending',
      created_at: new Date().toISOString()
    };
    
    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    calls.unshift(newCall);
    setLocalStorageData('h360_calls', calls);
    notifySubscribers('INSERT', 'calls', newCall);

    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = await supabase
          .from('calls')
          .insert([{ ...patient, status: 'pending' }])
          .select()
          .single();
        if (data) Object.assign(newCall, data);
      } catch (e) {
        console.warn('[Supabase] Trigger new call insert error:', e);
      }
    }

    // Trigger Retell outbound call
    fetch('/api/start-campaign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Single Call: ${newCall.patient_name}`,
        patients: [{
          patient_name: newCall.patient_name,
          contact: newCall.contact,
          age: newCall.age,
          patient_type: newCall.patient_type,
          context: newCall.context,
          language: newCall.language,
        }]
      })
    }).catch(err => console.error('Failed to trigger single patient call:', err));

    return newCall;
  }
};
