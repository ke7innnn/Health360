# Health 360 Physiotherapy - AI Outbound Calling Dashboard

A production-level, full-stack Next.js 14+ web application for managing and tracking automated AI-powered patient outbound call follow-ups.

This project features:
- **Rich Aesthetic Design**: Deep navy (`#0f172a`) sidebar navigation, white main interface, and modern coral/orange (`#f97316`) accent CTAs.
- **Realtime Dashboard**: Dynamic statistics cards with counters that update live when patient calls progress.
- **CSV Campaigns**: Drag-and-drop parser that validates patient contacts/names instantly, launches calling batches, and POSTs patient profiles to n8n workflow triggers.
- **Live Campaign Tracking**: Realtime progress tracking showing active calling progress and individual patient status cards (Queued, In Progress, Completed, Failed).
- **Conversational Logs**: WhatsApp-style bubble transcript viewer supporting multi-lingual Hindi, Marathi, and English dialogues, coupled with a custom HTML5 audio recording player.
- **Analytics Desk**: Rich charts tracking response rates, patient conditions, language distributions, and optimal hourly call response times using Recharts.
- **Sandbox Simulation**: Operates fully out-of-the-box using local storage mock databases and background timers if Supabase keys are not configured, providing a complete preview of calling flows and live charts.

---

## 🛠 Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS & Framer Motion (Transitions/Animations)
- **Database / Realtime**: Supabase Client
- **Chart UI**: Recharts
- **CSV Handling**: PapaParse
- **Confetti**: Canvas Confetti

---

## 💾 Database Schema

Initialize the tables in your Supabase database using the following SQL script:

```sql
-- Create campaigns table
create table campaigns (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  total_patients integer not null,
  completed integer default 0,
  failed integer default 0,
  in_progress integer default 0,
  created_at timestamptz default now()
);

-- Create calls table linked to campaigns and including languages
create table calls (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references campaigns(id) on delete cascade,
  patient_name text,
  contact text,
  age text,
  patient_type text,
  context text,
  status text default 'pending', -- 'pending' | 'in_progress' | 'completed' | 'failed'
  retell_call_id text,
  transcript text,
  duration_seconds numeric,
  recording_url text,
  sentiment text, -- 'positive' | 'neutral' | 'negative'
  language text default 'English', -- 'English' | 'Hindi' | 'Marathi'
  created_at timestamptz default now()
);

-- Enable Realtime for live dashboard updates
alter publication supabase_realtime add table calls;
alter publication supabase_realtime add table campaigns;
```

---

## 🚀 Getting Started

### 1. Installation

Clone the repository and install packages:
```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env.local` and add your project configurations:
```bash
cp .env.example .env.local
```

### 3. Run Dev Server

Launch Next.js locally:
```bash
npm run dev
```

*Note: If `NEXT_PUBLIC_SUPABASE_URL` is left empty, the application will automatically enter **Sandbox Simulator Mode**. This allows you to launch campaigns, preview parsed CSV items, view live tracking updates, and review parsed patient transcripts locally without database configurations.*

---

## 🔌 API Endpoint: Retell Call Callback

### Route: `/api/retell-callback` (POST)
Used by Retell to sync conversation metadata, recordings, and transcripts once an outbound call disconnects.

#### Sample Request Format:
```json
{
  "event": "call_ended",
  "data": {
    "call_id": "your_retell_call_id_here",
    "transcript": "Agent: नमस्ते, मैं हेल्थ 360 फिजियोथेरेपी से बात कर रही हूँ। क्या मैं अमित जी से बात कर सकती हूँ?\nUser: हाँ, मैं अमित बोल रहा हूँ। बोलिए।\nAgent: अमित जी, आपकी घुटने के दर्द की फिजियोथेरेपी कैसी चल रही है? क्या आपको आराम मिला?\nUser: हाँ, फिजियोथेरेपी से दर्द में बहुत आराम है।\nAgent: बहुत बढ़िया। धन्यवाद!",
    "duration_ms": 68000,
    "recording_url": "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  }
}
```
The route automatically:
1. Finds the pending call matching the `retell_call_id`.
2. Computes the sentiment (Positive / Neutral / Negative) using keyword matches in English, Hindi, and Marathi.
3. Finalizes call status (`completed` if answered, otherwise `failed`).
4. Updates parent campaign progress scores in real-time.
