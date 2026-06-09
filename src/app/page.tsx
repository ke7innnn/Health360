'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Phone, 
  PhoneCall, 
  ChevronRight,
  Sparkles,
  Inbox
} from 'lucide-react';
import { db, isSupabaseConfigured, subscribeToRealtime, Call, Campaign } from '@/lib/supabase';
import StatsGrid from '@/components/dashboard/StatsGrid';
import CallSuccessChart from '@/components/dashboard/CallSuccessChart';
import DailyTrendsChart from '@/components/dashboard/DailyTrendsChart';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const [calls, setCalls] = useState<Call[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [callingState, setCallingState] = useState<Record<string, boolean>>({});

  const fetchData = async () => {
    try {
      const allCalls = await db.getCalls();
      const allCamps = await db.getCampaigns();
      setCalls(allCalls);
      setCampaigns(allCamps);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Set up Realtime subscriptions (Mock or Supabase)
    let unsubscribe: () => void;
    if (isSupabaseConfigured && db) {
      const channel = (db as any).supabase?.channel('dashboard-changes')
        .on('postgres_changes', { event: '*', table: 'calls' }, () => {
          fetchData();
        })
        .on('postgres_changes', { event: '*', table: 'campaigns' }, () => {
          fetchData();
        })
        .subscribe();
      
      unsubscribe = () => {
        channel?.unsubscribe();
      };
    } else {
      unsubscribe = subscribeToRealtime((payload) => {
        if (payload.table === 'calls' || payload.table === 'campaigns' || payload.table === 'all') {
          fetchData();
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Inline single patient call trigger
  const handleCallPatient = async (callId: string, name: string) => {
    try {
      setCallingState(prev => ({ ...prev, [callId]: true }));
      await db.triggerSingleCall(callId);
      toast.info(`Single outbound call requested for ${name}`, {
        description: 'Outbound agent is connecting now.'
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to start outbound call.');
    } finally {
      setTimeout(() => {
        setCallingState(prev => ({ ...prev, [callId]: false }));
      }, 2000);
    }
  };

  // Compute metrics from call records
  const totalCalls = calls.length;
  const completedCalls = calls.filter(c => c.status === 'completed').length;
  const failedCalls = calls.filter(c => c.status === 'failed').length;
  const inProgressCalls = calls.filter(c => c.status === 'in_progress').length;
  const pendingCalls = calls.filter(c => c.status === 'pending').length;

  const completedCallRecords = calls.filter(c => c.status === 'completed' && c.duration_seconds);
  const avgDuration = completedCallRecords.length > 0
    ? Math.round(completedCallRecords.reduce((acc, c) => acc + Number(c.duration_seconds || 0), 0) / completedCallRecords.length)
    : 0;

  // Helper formatting for status badges
  const getStatusBadge = (status: Call['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Completed</Badge>;
      case 'in_progress':
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 gap-1 flex items-center w-fit">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
            In Progress
          </Badge>
        );
      case 'failed':
        return <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200">Failed</Badge>;
      default:
        return <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200">Pending</Badge>;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-28 bg-white rounded-3xl border border-slate-200" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-white rounded-3xl border border-slate-200" />
          <div className="h-96 bg-white rounded-3xl border border-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Hero / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Physiotherapy Calling Desk <Sparkles className="h-5 w-5 text-[#f97316]" />
          </h1>
          <p className="text-sm text-slate-500">
            Realtime campaign summaries and patient outbound response metrics.
          </p>
        </div>
        <div className="flex gap-3">
          <Button 
            className="bg-[#f97316] hover:bg-orange-600 text-white rounded-xl shadow-md gap-2"
            onClick={() => router.push('/campaigns/new')}
          >
            <PhoneCall className="h-4 w-4" />
            Launch Campaign
          </Button>
        </div>
      </div>

      {/* Hero Statistics Bar */}
      <StatsGrid 
        totalCalls={totalCalls}
        completedCalls={completedCalls}
        inProgressCalls={inProgressCalls}
        failedCalls={failedCalls}
        avgDuration={avgDuration}
      />

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Recent Calls Table */}
        <Card className="lg:col-span-2 rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden flex flex-col">
          <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-md font-bold text-slate-800">Recent Outbound Activity</CardTitle>
              <CardDescription className="text-xs text-slate-400">Click any patient row to review detailed AI logs & call audio.</CardDescription>
            </div>
            <Link href="/patients" className="text-xs font-semibold text-[#f97316] hover:text-orange-600 flex items-center gap-1">
              View All <ChevronRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 flex-grow">
            {totalCalls === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center h-72">
                <Inbox className="h-12 w-12 text-slate-300 mb-3" />
                <h4 className="font-semibold text-slate-700">No outbound calls yet</h4>
                <p className="text-xs text-slate-400 max-w-xs mt-1">Upload a patient CSV in Campaigns page to trigger outbound followups.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/50">
                    <TableRow>
                      <TableHead className="font-semibold text-xs text-slate-500">Patient</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Contact</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Type</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Language</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Status</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Duration</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {calls.slice(0, 6).map((call) => (
                      <TableRow 
                        key={call.id}
                        className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                        onClick={() => router.push(`/calls/${call.id}`)}
                      >
                        <TableCell>
                          <div className="font-semibold text-sm text-slate-800">{call.patient_name}</div>
                          <div className="text-[10px] text-slate-400">{formatTime(call.created_at)}</div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">{call.contact}</TableCell>
                        <TableCell className="text-xs text-slate-600">{call.patient_type}</TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {call.language || 'English'}
                        </TableCell>
                        <TableCell>{getStatusBadge(call.status)}</TableCell>
                        <TableCell className="text-xs text-slate-600 font-medium">{formatDuration(call.duration_seconds)}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[#f97316] hover:bg-orange-50 rounded-lg h-8 px-2 flex items-center gap-1.5"
                            disabled={callingState[call.id] || call.status === 'in_progress'}
                            onClick={() => handleCallPatient(call.id, call.patient_name)}
                          >
                            <Phone className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline text-xs font-semibold">Call Now</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Donut & Line charts */}
        <div className="space-y-6">
          <CallSuccessChart 
            completed={completedCalls}
            inProgress={inProgressCalls}
            failed={failedCalls}
            pending={pendingCalls}
          />
          <DailyTrendsChart calls={calls} />
        </div>
      </div>
    </div>
  );
}
