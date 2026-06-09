'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Megaphone, 
  Calendar, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  PhoneCall, 
  RotateCcw,
  Sparkles,
  Inbox
} from 'lucide-react';
import { db, isSupabaseConfigured, subscribeToRealtime, Campaign } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingFailed, setRetryingFailed] = useState(false);

  const fetchCampaigns = async () => {
    try {
      const allCamps = await db.getCampaigns();
      setCampaigns(allCamps);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();

    // Subscribe to realtime database changes (Mock or Supabase)
    let unsubscribe: () => void;
    if (isSupabaseConfigured && db) {
      const channel = (db as any).supabase?.channel('campaigns-list')
        .on('postgres_changes', { event: '*', table: 'campaigns' }, () => {
          fetchCampaigns();
        })
        .subscribe();

      unsubscribe = () => {
        channel?.unsubscribe();
      };
    } else {
      unsubscribe = subscribeToRealtime((payload) => {
        if (payload.table === 'campaigns' || payload.table === 'all') {
          fetchCampaigns();
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleRetryAllFailed = async () => {
    try {
      setRetryingFailed(true);
      await db.retryAllFailedCalls();
      toast.success('Retrying all failed calls across all campaigns!', {
        description: 'Outbound queue is processing retries.'
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to retry calls.');
    } finally {
      setRetryingFailed(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-10 bg-slate-200 rounded-xl w-44" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-44 bg-white rounded-3xl border border-slate-200" />
          <div className="h-44 bg-white rounded-3xl border border-slate-200" />
          <div className="h-44 bg-white rounded-3xl border border-slate-200" />
        </div>
      </div>
    );
  }

  // Helper status determination
  const getCampaignStatus = (camp: Campaign) => {
    const processed = (camp.completed || 0) + (camp.failed || 0);
    const inProgress = camp.in_progress || 0;
    
    if (inProgress > 0) {
      return <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200">Active</Badge>;
    }
    if (processed >= camp.total_patients) {
      return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Completed</Badge>;
    }
    if (processed > 0) {
      return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200">Partial</Badge>;
    }
    return <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">Queued</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Campaign Console</h1>
          <p className="text-sm text-slate-500">Manage, trigger, and review historical and live outbound dialers.</p>
        </div>
        
        <div className="flex gap-3">
          {campaigns.some(c => (c.failed || 0) > 0) && (
            <Button
              variant="outline"
              className="rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors gap-2"
              onClick={handleRetryAllFailed}
              disabled={retryingFailed}
            >
              <RotateCcw className="h-4 w-4" />
              {retryingFailed ? 'Retrying...' : 'Retry All Failed'}
            </Button>
          )}
          <Button 
            className="bg-[#f97316] hover:bg-orange-600 text-white rounded-xl shadow-md gap-2"
            onClick={() => router.push('/campaigns/new')}
          >
            <Sparkles className="h-4 w-4" />
            New Campaign
          </Button>
        </div>
      </div>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh] bg-white border border-slate-200 rounded-3xl">
          <Inbox className="h-12 w-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-700">No campaigns created yet</h4>
          <p className="text-xs text-slate-400 max-w-xs mt-1 mb-6">Create your first automated roster campaign to begin.</p>
          <Button 
            onClick={() => router.push('/campaigns/new')} 
            className="bg-[#f97316] hover:bg-orange-600 text-white rounded-xl"
          >
            Create New Campaign
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const processed = (camp.completed || 0) + (camp.failed || 0);
            const total = camp.total_patients || 0;
            const progress = total > 0 ? Math.round((processed / total) * 100) : 0;
            
            return (
              <Card 
                key={camp.id}
                className="rounded-3xl border-slate-200 bg-white hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between overflow-hidden relative group"
                onClick={() => router.push(`/campaigns/${camp.id}`)}
              >
                <div className="p-6 space-y-4">
                  {/* Card Header Info */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="p-2 bg-orange-50 text-[#f97316] rounded-xl shrink-0">
                      <Megaphone className="h-5 w-5" />
                    </div>
                    <div className="text-right">
                      {getCampaignStatus(camp)}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 tracking-tight leading-snug truncate group-hover:text-[#f97316] transition-colors">
                      {camp.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-slate-400 text-xs mt-1 font-semibold">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{new Date(camp.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>

                  {/* Summary of Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center border-y border-slate-100 py-3 mt-2">
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase block tracking-wider">Completed</span>
                      <span className="text-sm font-bold text-emerald-600">{camp.completed || 0}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase block tracking-wider">Failed</span>
                      <span className="text-sm font-bold text-rose-600">{camp.failed || 0}</span>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold uppercase block tracking-wider">Active</span>
                      <span className="text-sm font-bold text-blue-600">{camp.in_progress || 0}</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar footer */}
                <div className="px-6 pb-6 pt-2 space-y-2 mt-auto">
                  <div className="flex justify-between items-center text-xs text-slate-500 font-semibold">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-slate-400" />
                      {processed} / {total} Called
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-slate-100 [&>div]:bg-[#f97316] rounded-full" />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
