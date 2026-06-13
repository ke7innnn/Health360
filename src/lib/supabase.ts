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
  const stored = localStorage.getItem(key);
  return stored ? JSON.parse(stored) : defaultValue;
};

const setLocalStorageData = <T>(key: string, data: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
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

// INITIAL SEED MOCK DATA
const seedMockData = () => {
  if (typeof window === 'undefined') return;
  
  const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
  const calls = getLocalStorageData<Call[]>('h360_calls', []);

  if (campaigns.length === 0) {
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
      // c1 Calls
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
      // Seed remaining completed calls
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
      
      // c2 Calls
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

// Mock Simulation Logic: Periodically runs in background to progress any active/pending calls in active campaigns
if (typeof window !== 'undefined') {
  setInterval(() => {
    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);

    let updated = false;

    // 1. Process "in_progress" calls to make them complete or fail
    const callsInProgress = calls.filter(c => c.status === 'in_progress');
    callsInProgress.forEach(call => {
      // 20% chance to finish this tick
      if (Math.random() < 0.3) {
        const isSuccess = Math.random() > 0.15; // 85% success rate
        call.status = isSuccess ? 'completed' : 'failed';
        call.duration_seconds = isSuccess ? Math.floor(Math.random() * 80) + 30 : 0;
        call.recording_url = isSuccess ? MOCK_RECORDINGS[Math.floor(Math.random() * MOCK_RECORDINGS.length)] : '';
        call.language = call.language || LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
        call.transcript = isSuccess ? (MOCK_TRANSCRIPTS as any)[call.language] : '';
        call.sentiment = isSuccess ? SENTIMENTS[Math.floor(Math.random() * SENTIMENTS.length)] : undefined;
        
        // Update campaign counts
        if (call.campaign_id) {
          const camp = campaigns.find(c => c.id === call.campaign_id);
          if (camp) {
            camp.in_progress = Math.max(0, camp.in_progress - 1);
            if (isSuccess) {
              camp.completed += 1;
            } else {
              camp.failed += 1;
            }
          }
        }
        updated = true;
        notifySubscribers('UPDATE', 'calls', call);
      }
    });

    // 2. Process "pending" calls to initiate call (make in_progress)
    // Only process if total in_progress calls in workspace is < 3 (simulating limited dialer channels)
    const currentTotalInProgress = calls.filter(c => c.status === 'in_progress').length;
    if (currentTotalInProgress < 3) {
      const pendingCall = calls.find(c => c.status === 'pending');
      if (pendingCall) {
        pendingCall.status = 'in_progress';
        pendingCall.duration_seconds = 1; // starts counting
        pendingCall.language = pendingCall.language || LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];
        
        // Update campaign counts
        if (pendingCall.campaign_id) {
          const camp = campaigns.find(c => c.id === pendingCall.campaign_id);
          if (camp) {
            camp.in_progress += 1;
          }
        }
        updated = true;
        notifySubscribers('UPDATE', 'calls', pendingCall);
      }
    }

    if (updated) {
      setLocalStorageData('h360_calls', calls);
      setLocalStorageData('h360_campaigns', campaigns);
      
      // Also notify full tables updated
      notifySubscribers('REFRESH', 'all', null);
    }
  }, 4000); // Check every 4 seconds
}

// Database API Wrapper
export const db = {
  // Projects (Patient Lists)
  async getProjects(): Promise<Project[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('projects').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
      // If table doesn't exist, error will be populated. Fall back to local storage silently.
    }
    return getLocalStorageData<Project[]>('h360_projects', []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getProject(id: string): Promise<Project | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('projects').select('*').eq('id', id).single();
      if (!error && data) return data;
    }
    const projects = getLocalStorageData<Project[]>('h360_projects', []);
    return projects.find(p => p.id === id) || null;
  },

  async createProject(name: string, patients: ProjectPatient[]): Promise<Project> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('projects').insert([{ name, patients }]).select().single();
      if (!error && data) return data;
    }
    
    // Fallback Local Storage
    const newProject: Project = {
      id: `proj_${Date.now()}`,
      name,
      patients,
      created_at: new Date().toISOString()
    };
    const projects = getLocalStorageData<Project[]>('h360_projects', []);
    projects.push(newProject);
    setLocalStorageData('h360_projects', projects);
    notifySubscribers('INSERT', 'projects', newProject);
    return newProject;
  },

  async updateProject(id: string, name: string, patients: ProjectPatient[]): Promise<Project> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('projects').update({ name, patients }).eq('id', id).select().single();
      if (!error && data) return data;
    }
    
    // Fallback Local Storage
    const projects = getLocalStorageData<Project[]>('h360_projects', []);
    const idx = projects.findIndex(p => p.id === id);
    if (idx !== -1) {
      projects[idx] = { ...projects[idx], name, patients };
      setLocalStorageData('h360_projects', projects);
      notifySubscribers('UPDATE', 'projects', projects[idx]);
      return projects[idx];
    }
    throw new Error('Project not found');
  },

  async deleteProject(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (!error) return;
    }
    
    const projects = getLocalStorageData<Project[]>('h360_projects', []);
    setLocalStorageData('h360_projects', projects.filter(p => p.id !== id));
    notifySubscribers('REFRESH', 'all', null);
  },

  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return getLocalStorageData<Campaign[]>('h360_campaigns', []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getCampaign(id: string): Promise<Campaign | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('campaigns').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
    return campaigns.find(c => c.id === id) || null;
  },

  async deleteCampaign(id: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      // Delete calls related to this campaign first to avoid FK constraint issues
      const { error: callsError } = await supabase.from('calls').delete().eq('campaign_id', id);
      if (callsError) throw callsError;

      // Delete the campaign itself
      const { error: campError } = await supabase.from('campaigns').delete().eq('id', id);
      if (campError) throw campError;
    } else {
      const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
      const calls = getLocalStorageData<Call[]>('h360_calls', []);

      const updatedCampaigns = campaigns.filter(c => c.id !== id);
      const updatedCalls = calls.filter(c => c.campaign_id !== id);

      setLocalStorageData('h360_campaigns', updatedCampaigns);
      setLocalStorageData('h360_calls', updatedCalls);
      notifySubscribers('REFRESH', 'all', null);
    }
  },


  async createCampaign(name: string, patients: Omit<Call, 'id' | 'status' | 'created_at'>[]): Promise<Campaign> {
    if (isSupabaseConfigured && supabase) {
      // Delegate everything to /api/start-campaign which:
      //   1. Creates the campaign in Supabase
      //   2. Inserts all call records as 'pending'
      //   3. Fires first Retell call & saves retell_call_id immediately
      const res = await fetch('/api/start-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, patients }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start campaign');
      }

      const result = await res.json();

      // Return the newly created campaign from Supabase
      const { data: campData, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('id', result.campaign_id)
        .single();

      if (error || !campData) throw new Error('Campaign created but could not fetch it.');
      return campData;

    } else {
      // ── Local mock mode (no Supabase) ─────────────────────────────────────
      const campaignId = `camp_${Date.now()}`;
      const total = patients.length;

      const newCamp: Campaign = {
        id: campaignId,
        name,
        total_patients: total,
        completed: 0,
        failed: 0,
        in_progress: 0,
        created_at: new Date().toISOString()
      };

      const campaigns = getLocalStorageData<Campaign[]>('h360_campaigns', []);
      campaigns.push(newCamp);
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
        status: 'pending',
        created_at: new Date().toISOString()
      }));

      const calls = getLocalStorageData<Call[]>('h360_calls', []);
      setLocalStorageData('h360_calls', [...calls, ...newCalls]);

      notifySubscribers('INSERT', 'campaigns', newCamp);
      return newCamp;
    }
  },

  async retryFailedCampaignCalls(campaignId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      // 1. Get failed calls
      const { data: failedCalls } = await supabase
        .from('calls')
        .select('id')
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');

      if (failedCalls && failedCalls.length > 0) {
        const ids = failedCalls.map(c => c.id);
        
        // 2. Set back to pending
        await supabase.from('calls').update({ status: 'pending' }).in('id', ids);

        // 3. Decrement campaign failed count and update in_progress if needed
        const { data: camp } = await supabase.from('campaigns').select('*').eq('id', campaignId).single();
        if (camp) {
          await supabase.from('campaigns').update({
            failed: Math.max(0, camp.failed - ids.length)
          }).eq('id', campaignId);
        }
      }
    } else {
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
    }
  },

  async retryAllFailedCalls(): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      const { data: failedCalls } = await supabase.from('calls').select('id, campaign_id').eq('status', 'failed');
      if (failedCalls && failedCalls.length > 0) {
        const ids = failedCalls.map(c => c.id);
        await supabase.from('calls').update({ status: 'pending' }).in('id', ids);

        // Group by campaign to reset stats
        const campaignMap: Record<string, number> = {};
        failedCalls.forEach(c => {
          if (c.campaign_id) {
            campaignMap[c.campaign_id] = (campaignMap[c.campaign_id] || 0) + 1;
          }
        });

        for (const [campId, count] of Object.entries(campaignMap)) {
          const { data: camp } = await supabase.from('campaigns').select('failed').eq('id', campId).single();
          if (camp) {
            await supabase.from('campaigns').update({ failed: Math.max(0, camp.failed - count) }).eq('id', campId);
          }
        }
      }
    } else {
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
    }
  },

  // Calls
  async getCalls(): Promise<Call[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('calls').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
    return getLocalStorageData<Call[]>('h360_calls', []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async getCall(id: string): Promise<Call | null> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('calls').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    }
    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    return calls.find(c => c.id === id) || null;
  },

  async getCampaignCalls(campaignId: string): Promise<Call[]> {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.from('calls').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    }
    const calls = getLocalStorageData<Call[]>('h360_calls', []);
    return calls.filter(c => c.campaign_id === campaignId);
  },

  async triggerSingleCall(callId: string): Promise<void> {
    let callRecord: Call | null = null;
    
    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase.from('calls').select('*').eq('id', callId).single();
      if (data) {
        callRecord = data;
        await supabase.from('calls').update({ status: 'pending' }).eq('id', callId);
        
        // If part of campaign, decrement failed/completed if we're calling again
        if (data.campaign_id) {
          const { data: camp } = await supabase.from('campaigns').select('*').eq('id', data.campaign_id).single();
          if (camp) {
            const updateObj: any = {};
            if (data.status === 'completed') updateObj.completed = Math.max(0, camp.completed - 1);
            if (data.status === 'failed') updateObj.failed = Math.max(0, camp.failed - 1);
            if (Object.keys(updateObj).length > 0) {
              await supabase.from('campaigns').update(updateObj).eq('id', data.campaign_id);
            }
          }
        }
      }
    } else {
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
        call.duration_seconds = 0;
        call.recording_url = '';
        call.transcript = '';
        call.sentiment = undefined;
        
        setLocalStorageData('h360_calls', calls);
        setLocalStorageData('h360_campaigns', campaigns);
        notifySubscribers('UPDATE', 'calls', call);
      }
    }

    // Trigger via our direct Retell API (no n8n)
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
    let newCall: Call;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('calls')
        .insert([{ ...patient, status: 'pending' }])
        .select()
        .single();
      if (error) throw error;
      newCall = data;
    } else {
      newCall = {
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
      calls.push(newCall);
      setLocalStorageData('h360_calls', calls);
      notifySubscribers('INSERT', 'calls', newCall);
    }

    // Trigger via our direct Retell API (no n8n)
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
