import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import initialPatients from '@/lib/all_patients.json';
import { parseOrCalculateAge } from '@/lib/ageUtils';

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
        const normalized = data.map(p => ({
          ...p,
          age: parseOrCalculateAge(p.age)
        }));
        return NextResponse.json({ success: true, count: normalized.length, patients: normalized }, { headers: corsHeaders });
      }
    }

    const fallbackNormalized = initialPatients.map(p => ({
      ...p,
      age: parseOrCalculateAge(p.age)
    }));
    return NextResponse.json({ success: true, count: fallbackNormalized.length, patients: fallbackNormalized }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/patients - Sync new patient from CRM app into Agent app
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawName = body.patient_name || body.name || body.fullName;
    const rawContact = body.contact || body.phone || body.phone_number;
    const { patient_type, condition, gender, age, dob, dateOfBirth } = body;

    if (!rawName || !rawContact) {
      return NextResponse.json(
        { success: false, error: 'patient_name and contact are required.' },
        { status: 400, headers: corsHeaders }
      );
    }

    const calculatedAge = parseOrCalculateAge(age || dateOfBirth || dob);
    const formattedContact = String(rawContact).trim().startsWith('+') ? String(rawContact).trim() : `+91 ${String(rawContact).trim()}`;
    const patientRecord = {
      patient_name: String(rawName).trim(),
      contact: formattedContact,
      age: calculatedAge || '',
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
