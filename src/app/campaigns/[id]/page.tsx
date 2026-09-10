'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  PhoneCall, 
  PhoneForwarded,
  CheckCircle2, 
  XCircle, 
  Clock, 
  RotateCcw,
  Sparkles,
  Loader2,
  Trash2,
  Radio,
  RefreshCw
} from 'lucide-react';
import { db, Call, Campaign } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CampaignTrackingPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingFailed, setRetryingFailed] = useState(false);
  const [advancingQueue, setAdvancingQueue] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Retry launch state — tracks the "queuing" phase after Retry is clicked
  // before Retell confirms the first in_progress call
  const [retryLaunch, setRetryLaunch] = useState<{
    active: boolean;
    retriedCount: number;
    elapsedSecs: number;
  }>({ active: false, retriedCount: 0, elapsedSecs: 0 });
  const retryLaunchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep track of active live timer
  const [liveSeconds, setLiveSeconds] = useState(0);
  const activeCallRef = useRef<Call | null>(null);

  // ─── Fetch Campaign & Calls from Live Server Endpoint ───────────────────────
  const fetchCampaignAndCalls = useCallback(async () => {
    try {
      const res = await fetch(`/api/campaigns/${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.campaign) {
          setCampaign(data.campaign);
          setCalls(data.calls || []);

          // Track active call for live timer
          const active = (data.calls || []).find((c: Call) => c.status === 'in_progress');
          activeCallRef.current = active || null;
          if (active && active.duration_seconds !== undefined) {
            setLiveSeconds(active.duration_seconds);
          }

          // Once an in_progress call exists, clear the retry launch banner
          if (active) {
            setRetryLaunch(prev => {
              if (prev.active) {
                if (retryLaunchTimerRef.current) clearInterval(retryLaunchTimerRef.current);
                return { active: false, retriedCount: 0, elapsedSecs: 0 };
              }
              return prev;
            });
          }
          return;
        }
      }
      // Fallback to local DB if API not reachable
      const camp = await db.getCampaign(id);
      const campCalls = await db.getCampaignCalls(id);
      setCampaign(camp);
      setCalls(campCalls);
    } catch (err) {
      console.error('[CampaignTracking] Error fetching:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ─── Real-time Fast Polling (1.5 seconds) ───────────────────────────────────
  useEffect(() => {
    fetchCampaignAndCalls();

    const pollInterval = setInterval(() => {
      fetchCampaignAndCalls();
    }, 1500);

    return () => {
      clearInterval(pollInterval);
    };
  }, [fetchCampaignAndCalls]);

  // ─── Live Second Tick for In-Progress Speaking Call ─────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      if (activeCallRef.current && (activeCallRef.current as any).live_state === 'speaking') {
        setLiveSeconds(prev => prev + 1);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ─── Retry Launch Elapsed Timer ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (retryLaunchTimerRef.current) clearInterval(retryLaunchTimerRef.current);
    };
  }, []);

  // ─── Advance to Next Patient in Queue ───────────────────────────────────────
  const handleTriggerNext = async () => {
    try {
      setAdvancingQueue(true);
      const res = await fetch(`/api/campaigns/${id}/next`, { method: 'POST' });
      const data = await res.json();
      if (data.next_call) {
        toast.success(`Dialing next patient: ${data.next_call.patient_name}`);
        fetchCampaignAndCalls();
      } else if (data.queue_finished) {
        toast.info('All patients in this campaign have been dialed!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to trigger next call.');
    } finally {
      setAdvancingQueue(false);
    }
  };

  // ─── Bulk Retry Failed Calls — now calls the API directly & shows launch bar ─
  const handleRetryFailed = async () => {
    const failedCount = calls.filter(c => c.status === 'failed').length;
    if (failedCount === 0) return;

    try {
      setRetryingFailed(true);

      // Call the campaign manager API (not just supabase client)
      const res = await fetch(`/api/campaigns/${id}/retry`, { method: 'POST' });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Retry failed');

      const retriedCount = data.retried_count || failedCount;
      toast.success(`Re-launching ${retriedCount} failed call${retriedCount !== 1 ? 's' : ''}!`, {
        description: 'Queuing all retried patients now...',
      });

      // Activate the retry launch banner
      if (retryLaunchTimerRef.current) clearInterval(retryLaunchTimerRef.current);
      setRetryLaunch({ active: true, retriedCount, elapsedSecs: 0 });

      // Tick the elapsed seconds counter for the launch banner
      retryLaunchTimerRef.current = setInterval(() => {
        setRetryLaunch(prev => {
          if (!prev.active) return prev;
          // Auto-dismiss after 60 seconds as a failsafe
          if (prev.elapsedSecs >= 60) {
            if (retryLaunchTimerRef.current) clearInterval(retryLaunchTimerRef.current);
            return { active: false, retriedCount: 0, elapsedSecs: 0 };
          }
          return { ...prev, elapsedSecs: prev.elapsedSecs + 1 };
        });
      }, 1000);

      // Force immediate data refresh
      fetchCampaignAndCalls();
    } catch (err) {
      console.error(err);
      toast.error('Failed to retry calls.');
    } finally {
      setRetryingFailed(false);
    }
  };

  // ─── Delete Campaign ────────────────────────────────────────────────────────
  const handleDeleteCampaign = async () => {
    if (!campaign) return;
    if (!window.confirm(`Delete campaign "${campaign.name}" and all records?`)) return;

    try {
      setDeleting(true);
      await db.deleteCampaign(id);
      toast.success(`Campaign "${campaign.name}" deleted.`);
      router.push('/campaigns');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete campaign.');
      setDeleting(false);
    }
  };

  // ─── Single Call Now / Call Again ───────────────────────────────────────────
  const handleSingleCall = async (callId: string, name: string) => {
    try {
      await db.triggerSingleCall(callId);
      toast.info(`Triggered call for ${name}`);
      fetchCampaignAndCalls();
    } catch (err) {
      console.error(err);
      toast.error('Failed to start call.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse p-4">
        <div className="h-10 bg-slate-200 rounded-xl w-44" />
        <div className="h-44 bg-white rounded-3xl border border-slate-200" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="h-28 bg-white rounded-2xl border border-slate-200" />
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
        <p className="text-xs text-slate-400 mt-1 mb-6">The campaign you are looking for doesn't exist.</p>
        <Button onClick={() => router.push('/campaigns')} className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl">
          View All Campaigns
        </Button>
      </div>
    );
  }

  // Active in-progress call
  const activeCall = calls.find(c => c.status === 'in_progress');
  const activeLiveState = (activeCall as any)?.live_state || (activeCall ? 'speaking' : 'idle');

  // Next up call
  const pendingCalls = calls.filter(c => c.status === 'pending');
  const nextUpCall = pendingCalls[0];

  // Counts
  const total = calls.length || campaign.total_patients || 0;
  const completed = calls.filter(c => c.status === 'completed').length;
  const failed = calls.filter(c => c.status === 'failed').length;
  const inProgress = activeCall ? 1 : 0;
  const processed = completed + failed;
  const progressPercent = total > 0 ? Math.round((processed / total) * 100) : 0;

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header breadcrumb & actions */}
      <div className="flex items-center justify-between">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-500 hover:text-slate-800 rounded-xl"
          onClick={() => router.push('/campaigns')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> All Campaigns
        </Button>

        <div className="flex items-center gap-2">
          {pendingCalls.length > 0 && !activeCall && (
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl gap-1.5 shadow-sm"
              disabled={advancingQueue}
              onClick={handleTriggerNext}
            >
              <PhoneForwarded className="h-3.5 w-3.5" />
              {advancingQueue ? 'Dialing Next...' : 'Dial Next Patient'}
            </Button>
          )}

          {failed > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 gap-1.5"
              disabled={retryingFailed}
              onClick={handleRetryFailed}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {retryingFailed ? 'Launching...' : `Retry Failed (${failed})`}
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            className="rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
            disabled={deleting}
            onClick={handleDeleteCampaign}
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* ── REAL-TIME HERO LIVE CALL BANNER / RETRY LAUNCH BANNER ───────────── */}
      <AnimatePresence mode="wait">
        {activeCall ? (
          <motion.div
            key={activeCall.id + activeLiveState}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <div className={`rounded-3xl p-6 border shadow-md relative overflow-hidden transition-all ${
              activeLiveState === 'speaking'
                ? 'bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-950 text-white border-emerald-500/30'
                : 'bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white border-amber-500/30'
            }`}>
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  {/* Glowing Animated Icon */}
                  <div className={`p-4 rounded-2xl flex items-center justify-center ${
                    activeLiveState === 'speaking'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {activeLiveState === 'speaking' ? (
                      <Radio className="h-8 w-8 animate-bounce" />
                    ) : (
                      <PhoneCall className="h-8 w-8 animate-pulse" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={activeLiveState === 'speaking'
                        ? 'bg-emerald-500 text-slate-950 font-extrabold uppercase text-[10px] tracking-widest'
                        : 'bg-amber-500 text-slate-950 font-extrabold uppercase text-[10px] tracking-widest'
                      }>
                        {activeLiveState === 'speaking'
                          ? '🗣️ CALL CONNECTED · SPEAKING'
                          : (liveSeconds < 12 ? '📡 CONNECTING TO CARRIER...' : '🔔 RINGING PATIENT HANDSET...')}
                      </Badge>

                      <span className="text-xs text-slate-400 font-mono">
                        Line: {activeCall.contact}
                      </span>
                    </div>

                    <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white mt-1">
                      {activeCall.patient_name}
                      <span className="text-sm font-normal text-slate-300 ml-2">
                        ({activeCall.patient_type || 'General Patient'})
                      </span>
                    </h2>

                    <p className="text-xs text-slate-300 mt-0.5 line-clamp-1">
                      Context: {activeCall.context || 'General physiotherapy checkup & consultation follow-up'}
                    </p>
                  </div>
                </div>

                {/* Right side: Live Timer & Queue Status */}
                <div className="flex items-center gap-6 self-end md:self-center">
                  <div className="text-right">
                    <div className="text-2xl md:text-3xl font-mono font-bold text-white tracking-wider">
                      {formatTime(liveSeconds)}
                    </div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {activeLiveState === 'speaking' ? 'Call Duration' : 'Dialing Time'}
                    </p>
                  </div>

                  {nextUpCall && (
                    <div className="hidden lg:block border-l border-white/10 pl-6 text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Up Next in Queue:
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {nextUpCall.patient_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {nextUpCall.contact}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

        ) : retryLaunch.active ? (
          /* ── RETRY LAUNCH BANNER (shows immediately after clicking Retry Failed) ── */
          <motion.div
            key="retry-launch-banner"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="rounded-3xl p-6 border shadow-lg relative overflow-hidden bg-gradient-to-r from-slate-950 via-rose-950 to-slate-950 text-white border-rose-500/30">
              {/* Animated background sweep */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/5 to-transparent animate-pulse" />
              
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  {/* Spinning retry icon */}
                  <div className="p-4 rounded-2xl flex items-center justify-center bg-rose-500/20 text-rose-400 border border-rose-500/30">
                    <RefreshCw className="h-8 w-8 animate-spin" style={{ animationDuration: '1.5s' }} />
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-rose-500 text-white font-extrabold uppercase text-[10px] tracking-widest animate-pulse">
                        🔁 RETRY CAMPAIGN LAUNCHED
                      </Badge>
                      <span className="text-xs text-slate-400 font-mono">
                        {retryLaunch.retriedCount} call{retryLaunch.retriedCount !== 1 ? 's' : ''} queued
                      </span>
                    </div>

                    <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-white mt-1">
                      Re-dialing Failed Patients
                      <span className="text-sm font-normal text-slate-300 ml-2">
                        (Auto-queuing all {retryLaunch.retriedCount})
                      </span>
                    </h2>

                    <p className="text-xs text-slate-300 mt-0.5">
                      📡 Connecting to carrier... First call will connect shortly
                    </p>
                  </div>
                </div>

                {/* Right side: elapsed timer */}
                <div className="flex items-center gap-6 self-end md:self-center">
                  <div className="text-right">
                    <div className="text-2xl md:text-3xl font-mono font-bold text-white tracking-wider">
                      {formatTime(retryLaunch.elapsedSecs)}
                    </div>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Queue Time
                    </p>
                  </div>

                  {pendingCalls.length > 0 && (
                    <div className="hidden lg:block border-l border-white/10 pl-6 text-left">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        First Up:
                      </span>
                      <span className="text-xs font-semibold text-slate-200">
                        {pendingCalls[0].patient_name}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 block">
                        {pendingCalls[0].contact}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Queue progress mini-bar */}
              <div className="mt-4 relative z-10">
                <div className="flex justify-between text-[10px] text-slate-400 font-semibold mb-1">
                  <span>Queuing {retryLaunch.retriedCount} retried calls...</span>
                  <span className="animate-pulse text-rose-400">Waiting for first connection</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-rose-400 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (retryLaunch.elapsedSecs / 20) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

        ) : pendingCalls.length === 0 && processed > 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-3xl p-6 bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500 text-white rounded-2xl">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-base">Campaign Finished Successfully!</h3>
                <p className="text-xs text-emerald-700">All {total} patients in the roster have been processed.</p>
              </div>
            </div>
            <Badge className="bg-emerald-600 text-white px-3 py-1">100% Completed</Badge>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Campaign Status Master Card */}
      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-sage-600 uppercase tracking-widest bg-sage-50 px-2.5 py-0.5 rounded-full border border-sage-200">
                  {inProgress > 0 ? 'Live In-Progress' : retryLaunch.active ? 'Retry Launching' : pendingCalls.length > 0 ? 'Ready / In Queue' : 'Completed'}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Created {new Date(campaign.created_at).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mt-1">
                {campaign.name}
              </h1>
            </div>
            
            <div className="text-left md:text-right">
              <span className="text-3xl font-extrabold text-sage-600 tracking-tight">{progressPercent}%</span>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Progress Rate</p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-slate-500 font-semibold">
              <span>Patients Called: {processed} / {total}</span>
              {(inProgress > 0 || retryLaunch.active) && (
                <span className="text-blue-600 animate-pulse flex items-center gap-1 font-bold">
                  <Loader2 className="h-3 w-3 animate-spin" /> {retryLaunch.active ? 'Retrying calls...' : 'Calling 1 line at a time'}
                </span>
              )}
            </div>
            <Progress value={progressPercent} className="h-3 bg-slate-100 [&>div]:bg-gradient-to-r [&>div]:from-sage-500 [&>div]:to-sage-600 rounded-full" />
          </div>

        </CardContent>
      </Card>

      {/* Stats Grid */}
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
              <span className="text-[10px] font-bold text-slate-400 uppercase">Failed / Busy</span>
              <h4 className="text-xl font-bold text-rose-600 leading-none mt-1">{failed}</h4>
            </div>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><XCircle className="h-4 w-4" /></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Calling Now</span>
              <h4 className="text-xl font-bold text-blue-600 leading-none mt-1">{inProgress}</h4>
            </div>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><PhoneCall className="h-4 w-4 animate-bounce" /></div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase">Pending Queue</span>
              <h4 className="text-xl font-bold text-slate-700 leading-none mt-1">
                {pendingCalls.length}
              </h4>
            </div>
            <div className="p-2 bg-slate-50 text-slate-500 rounded-lg"><Clock className="h-4 w-4" /></div>
          </CardContent>
        </Card>
      </div>

      {/* Patient Live Cards Container */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-sage-500" />
            Patient Calling Queue ({calls.length})
          </h2>
          <span className="text-xs text-slate-400">Updates live every 1.5s</span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {calls.map((call, idx) => {
              const liveState = (call as any).live_state;
              const isFirstPending = call.status === 'pending' && pendingCalls[0]?.id === call.id;

              let statusBorder = 'border-slate-200';
              let statusBadge = (
                <span className="text-[10px] font-bold text-slate-400 uppercase">QUEUED #{idx + 1}</span>
              );
              const statusBg = 'bg-white';
              
              if (call.status === 'in_progress') {
                if (liveState === 'speaking') {
                  statusBorder = 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20';
                  statusBadge = (
                    <span className="text-[10px] font-extrabold text-emerald-600 animate-pulse flex items-center gap-1">
                      🗣️ SPEAKING ({call.duration_seconds || liveSeconds}s)
                    </span>
                  );
                } else {
                  statusBorder = 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20';
                  statusBadge = (
                    <span className="text-[10px] font-extrabold text-amber-600 animate-pulse flex items-center gap-1">
                      {liveSeconds < 12 ? '📡 CONNECTING...' : '🔔 RINGING HANDSET...'}
                    </span>
                  );
                }
              } else if (call.status === 'completed') {
                statusBorder = 'border-emerald-200 bg-emerald-50/5';
                statusBadge = (
                  <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    COMPLETED ({call.duration_seconds || 0}s)
                  </span>
                );
              } else if (call.status === 'failed') {
                statusBorder = 'border-rose-200 bg-rose-50/10';
                statusBadge = (
                  <span className="text-[10px] font-bold text-rose-600 flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-rose-500" />
                    NO ANSWER / FAILED
                  </span>
                );
              } else if (isFirstPending) {
                statusBorder = 'border-blue-300 bg-blue-50/10';
                statusBadge = (
                  <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1">
                    <PhoneForwarded className="h-3 w-3 text-blue-500" />
                    NEXT UP TO CALL
                  </span>
                );
              }

              return (
                <motion.div
                  key={call.id}
                  layoutId={call.id}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  className={`border rounded-2xl p-5 shadow-sm transition-all relative cursor-pointer ${statusBorder} ${statusBg} hover:shadow-md flex flex-col justify-between min-h-[160px]`}
                  onClick={() => router.push(`/calls/${call.id}`)}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-bold text-slate-400">#{idx + 1}</span>
                        <h4 className="font-bold text-sm text-slate-900 truncate">{call.patient_name}</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">{call.patient_type}</p>
                      <p className="text-xs text-slate-600 font-mono mt-1 font-semibold">{call.contact}</p>
                      {call.context && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">
                          "{call.context}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between mt-3">
                    <div>
                      {statusBadge}
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant={call.status === 'completed' ? 'outline' : 'default'}
                        className={`rounded-xl h-7 px-3 text-xs font-bold ${
                          call.status === 'in_progress' 
                            ? 'bg-blue-600 text-white hover:bg-blue-700' 
                            : call.status === 'completed'
                            ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            : 'bg-sage-600 text-white hover:bg-sage-700'
                        }`}
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
