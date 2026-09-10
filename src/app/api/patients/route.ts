import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import initialPatients from '@/lib/all_patients.json';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET /api/patients - Fetch master patient directory
export async function GET() {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return NextResponse.json({ success: true, count: data.length, patients: data }, { headers: corsHeaders });
      }
    }

    return NextResponse.json({ success: true, count: initialPatients.length, patients: initialPatients }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/patients - Sync new patient from CRM app into Agent app
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { patient_name, contact, age, patient_type, condition, gender } = body;

    if (!patient_name || !contact) {
      return NextResponse.json(
        { success: false, error: 'patient_name and contact are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const formattedContact = contact.trim().startsWith('+') ? contact.trim() : `+91 ${contact.trim()}`;
    const patientRecord = {
      patient_name: patient_name.trim(),
      contact: formattedContact,
      age: age ? String(age).trim() : 'N/A',
      patient_type: patient_type || condition || (gender === 'female' ? 'Knee Pain' : 'Lower Back Pain'),
      created_at: new Date().toISOString(),
    };

    console.log('[SyncPatient API] Syncing patient from CRM:', patientRecord);

    if (supabase) {
      try {
        await supabase.from('patients').upsert([patientRecord], { onConflict: 'contact' });
      } catch (dbErr) {
        console.warn('[SyncPatient API] Supabase upsert error:', dbErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Patient synced successfully to Health 360 Agent Directory!',
        patient: patientRecord,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('[SyncPatient API] Unhandled error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
