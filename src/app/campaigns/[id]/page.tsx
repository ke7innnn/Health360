'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  PhoneCall, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCcw,
  Sparkles,
  Loader2,
  Trash2
} from 'lucide-react';
import { db, supabase, isSupabaseConfigured, subscribeToRealtime, Call, Campaign } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CampaignTrackingPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    if (!window.confirm(`Are you sure you want to delete the campaign "${campaign.name}" and all associated patient calls? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeleting(true);
      await db.deleteCampaign(id);
      toast.success(`Campaign "${campaign.name}" deleted successfully.`);
      router.push('/campaigns');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete campaign.');
      setDeleting(false);
    }
  };

  const fetchCampaignAndCalls = async () => {
    try {
      const camp = await db.getCampaign(id);
      const campCalls = await db.getCampaignCalls(id);
      setCampaign(camp);
      setCalls(campCalls);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaign data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaignAndCalls();

    let unsubscribe: (() => void) | undefined;

    if (isSupabaseConfigured && supabase) {
      // Use the actual supabase client for realtime — NOT (db as any).supabase which is undefined
      const channel = supabase
        .channel(`campaign-track-${id}`)
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'calls', filter: `campaign_id=eq.${id}` },
          () => { fetchCampaignAndCalls(); }
        )
        .on(
          'postgres_changes' as any,
          { event: '*', schema: 'public', table: 'campaigns', filter: `id=eq.${id}` },
          () => { fetchCampaignAndCalls(); }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            console.log(`[Realtime] Subscribed to campaign-track-${id}`);
          }
        });

      unsubscribe = () => { channel.unsubscribe(); };
    } else {
      // Mock/local storage realtime
      unsubscribe = subscribeToRealtime((payload) => {
        if (
          payload.table === 'all' ||
          (payload.table === 'calls' && payload.record?.campaign_id === id) ||
          (payload.table === 'campaigns' && payload.record?.id === id)
        ) {
          fetchCampaignAndCalls();
        }
      });
    }

    // Polling fallback: refresh every 8 seconds in case realtime misses an event
    const pollInterval = setInterval(() => {
      fetchCampaignAndCalls();
    }, 8000);

    return () => {
      if (unsubscribe) unsubscribe();
      clearInterval(pollInterval);
    };
  }, [id]);

  // Bulk Retry Failed Calls
  const handleRetryFailed = async () => {
    try {
      setRetryingFailed(true);
      await db.retryFailedCampaignCalls(id);
      toast.success('Retrying all failed calls in this campaign!', {
        description: 'Failed calls have been put back into queue.'
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to retry calls.');
    } finally {
      setRetryingFailed(false);
    }
  };

  // Single patient Call Now/Call Again trigger
  const handleSingleCall = async (callId: string, name: string) => {
    try {
      await db.triggerSingleCall(callId);
      toast.info(`Single call triggered for ${name}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to start call.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-6 w-20 bg-slate-200 rounded-xl" />
        <div className="h-44 bg-white rounded-3xl border border-slate-200" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="h-28 bg-white rounded-2xl border border-slate-200" />
          <div className="h-28 bg-white rounded-2xl border border-slate-200" />
          <div className="h-28 bg-white rounded-2xl border border-slate-200" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
        <h3 className="font-bold text-slate-700 text-lg">Campaign not found</h3>
        <p className="text-xs text-slate-400 mt-1 mb-6">The campaign id you are trying to track doesn't exist.</p>
        <Button onClick={() => router.push('/campaigns')} className="bg-[#f97316] text-white rounded-xl">
          View All Campaigns
        </Button>
      </div>
    );
  }

  // Progress Calculations
  const total = campaign.total_patients || 0;
  const completed = campaign.completed || 0;
  const failed = campaign.failed || 0;
  const inProgress = campaign.in_progress || 0;
  const processed = completed + failed;
  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-500 hover:text-slate-800 rounded-xl"
          onClick={() => router.push('/campaigns')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Campaigns
        </Button>

        <div className="flex gap-2">
          {failed > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors gap-2"
              disabled={retryingFailed}
              onClick={handleRetryFailed}
            >
              <RotateCcw className="h-4 w-4" />
              {retryingFailed ? 'Retrying...' : 'Retry Failed Calls'}
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors gap-2"
            disabled={deleting}
            onClick={handleDeleteCampaign}
          >
            {deleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            {deleting ? 'Deleting...' : 'Delete Campaign'}
          </Button>
        </div>
      </div>

      {/* Campaign Status Master Card */}
      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#f97316] uppercase tracking-widest bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">Live Campaign</span>
                <span className="text-xs text-slate-400 font-medium">Launched {new Date(campaign.created_at).toLocaleDateString()}</span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight mt-1">{campaign.name}</h1>
            </div>
            
            <div className="text-left md:text-right">
              <span className="text-3xl font-extrabold text-[#f97316] tracking-tight">{progressPercent}%</span>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Progress Rate</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500 font-semibold">
              <span>Patients Called: {processed} / {total}</span>
              {inProgress > 0 && (
                <span className="text-blue-500 animate-pulse flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> {inProgress} active lines dialing
                </span>
              )}
            </div>
            <Progress value={progressPercent} className="h-3 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-orange-500 [&>div]:to-orange-600 rounded-full" />
          </div>
        </CardContent>
      </Card>

      {/* Counters Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Completed</span>
              <h4 className="text-xl font-bold text-emerald-600 leading-none mt-1">{completed}</h4>
            </div>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="h-4 w-4" /></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Failed</span>
              <h4 className="text-xl font-bold text-rose-600 leading-none mt-1">{failed}</h4>
            </div>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><XCircle className="h-4 w-4" /></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">In Progress</span>
              <h4 className="text-xl font-bold text-blue-600 leading-none mt-1">{inProgress}</h4>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><PhoneCall className="h-4 w-4 animate-bounce" /></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pending Queue</span>
              <h4 className="text-xl font-bold text-slate-600 leading-none mt-1">
                {total - processed - inProgress}
              </h4>
            </div>
            <div className="p-2 bg-slate-50 text-slate-500 rounded-lg"><Clock className="h-4 w-4" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Live Cards Container */}
      <div>
        <h2 className="text-md font-bold text-slate-800 mb-4 flex items-center gap-1.5">
          Patient Call Roster
          <Sparkles className="h-4 w-4 text-[#f97316]" />
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {calls.map((call) => {
              // Custom design for each status state
              let statusBorder = 'border-slate-200';
              let statusIcon = <Clock className="h-5 w-5 text-slate-400" />;
              let statusBg = 'bg-white';
              
              if (call.status === 'in_progress') {
                statusBorder = 'border-blue-500 ring-2 ring-blue-500/10';
                statusIcon = <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
                statusBg = 'bg-blue-50/5';
              } else if (call.status === 'completed') {
                statusBorder = 'border-emerald-200';
                statusIcon = <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
              } else if (call.status === 'failed') {
                statusBorder = 'border-rose-200';
                statusIcon = <XCircle className="h-5 w-5 text-rose-500" />;
              }

              return (
                <motion.div
                  key={call.id}
                  layoutId={call.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`border rounded-2xl p-5 shadow-sm transition-all relative cursor-pointer ${statusBorder} ${statusBg} hover:shadow-md flex flex-col justify-between h-40`}
                  onClick={() => router.push(`/calls/${call.id}`)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="overflow-hidden">
                      <h4 className="font-bold text-sm text-slate-800 truncate">{call.patient_name}</h4>
                      <p className="text-[10px] text-slate-400 font-semibold">{call.patient_type}</p>
                      <p className="text-xs text-slate-500 font-mono mt-1">{call.contact}</p>
                    </div>
                    <div>
                      {statusIcon}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between mt-auto">
                    <div>
                      {call.status === 'completed' && (
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-semibold">
                          <Clock className="h-3 w-3 text-slate-400" />
                          <span>{call.duration_seconds}s</span>
                        </div>
                      )}
                      {call.status === 'in_progress' && (
                        <span className="text-[10px] font-bold text-blue-500 animate-pulse">CALLING...</span>
                      )}
                      {call.status === 'pending' && (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">QUEUED</span>
                      )}
                      {call.status === 'failed' && (
                        <span className="text-[10px] font-bold text-rose-500 uppercase">NO ANSWER</span>
                      )}
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-[#f97316] hover:bg-orange-50 rounded-xl h-8 px-2 font-bold text-xs"
                        disabled={call.status === 'in_progress'}
                        onClick={() => handleSingleCall(call.id, call.patient_name)}
                      >
                        {call.status === 'completed' || call.status === 'failed' ? 'Call Again' : 'Call Now'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
