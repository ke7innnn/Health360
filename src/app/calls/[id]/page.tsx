'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  RotateCcw,
  Loader2,
  Volume2
} from 'lucide-react';
import { db, isSupabaseConfigured, subscribeToRealtime, Call } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import PatientInfoCard from '@/components/calls/PatientInfoCard';
import TranscriptViewer from '@/components/calls/TranscriptViewer';

export default function CallDetailPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [call, setCall] = useState<Call | null>(null);
  const [loading, setLoading] = useState(true);
  const [callingAgain, setCallingAgain] = useState(false);

  const fetchCall = async () => {
    try {
      const data = await db.getCall(id);
      setCall(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load call details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCall();

    // Subscribe to realtime updates
    let unsubscribe: () => void;
    if (isSupabaseConfigured && db) {
      const channel = (db as any).supabase?.channel(`call-detail-${id}`)
        .on('postgres_changes', { event: '*', table: 'calls', filter: `id=eq.${id}` }, () => {
          fetchCall();
        })
        .subscribe();
      
      unsubscribe = () => {
        channel?.unsubscribe();
      };
    } else {
      unsubscribe = subscribeToRealtime((payload) => {
        if (payload.table === 'all' || (payload.table === 'calls' && payload.record?.id === id)) {
          fetchCall();
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [id]);

  const handleCallAgain = async () => {
    if (!call) return;
    try {
      setCallingAgain(true);
      await db.triggerSingleCall(call.id);
      toast.info(`Triggered new call check for ${call.patient_name}`, {
        description: 'AI is dialing the patient now.'
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to start outbound call.');
    } finally {
      setTimeout(() => {
        setCallingAgain(false);
      }, 2000);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-6 w-20 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-white rounded-3xl border border-slate-200" />
          <div className="lg:col-span-2 h-96 bg-white rounded-3xl border border-slate-200" />
        </div>
      </div>
    );
  }

  if (!call) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
        <h3 className="font-bold text-slate-700 text-lg">Call Log Not Found</h3>
        <p className="text-xs text-slate-400 mt-1 mb-6">The patient call check-in record does not exist.</p>
        <Button onClick={() => router.push('/')} className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl">
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-500 hover:text-slate-800 rounded-xl"
          onClick={() => {
            if (call.campaign_id) {
              router.push(`/campaigns/${call.campaign_id}`);
            } else {
              router.push('/patients');
            }
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>

        <Button
          className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-md gap-2"
          disabled={callingAgain || call.status === 'in_progress'}
          onClick={handleCallAgain}
        >
          {callingAgain ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Call Again
        </Button>
      </div>

      {/* Split Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Patient Profile & Details */}
        <PatientInfoCard call={call} />

        {/* Right Column: Transcript bubble viewer & Call Audio */}
        <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
          
          {/* Audio recording player */}
          {call.recording_url && (
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden shrink-0">
              <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4 bg-gradient-to-tr from-slate-50 to-sage-50/10">
                <div className="p-3 bg-sage-100 text-sage-700 rounded-full shrink-0">
                  <Volume2 className="h-6 w-6" />
                </div>
                <div className="flex-1 w-full text-center sm:text-left">
                  <h4 className="font-bold text-sm text-slate-800">Call Audio Recording</h4>
                  <p className="text-[10px] text-slate-400 font-semibold">Listen to the conversation recording.</p>
                </div>
                <div className="w-full sm:w-auto">
                  <audio 
                    src={call.recording_url} 
                    controls 
                    className="w-full h-9 rounded-xl outline-none focus:ring-2 focus:ring-sage-500 custom-audio"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transcript bubble viewer */}
          <TranscriptViewer status={call.status} transcript={call.transcript} />
        </div>
      </div>
    </div>
  );
}
