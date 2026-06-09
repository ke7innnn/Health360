'use client';

import React from 'react';
import { 
  Smile, 
  Meh, 
  Frown, 
  Calendar, 
  Clock, 
  UserCheck 
} from 'lucide-react';
import { Call } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PatientInfoCardProps {
  call: Call;
}

export default function PatientInfoCard({ call }: PatientInfoCardProps) {
  // Helper formatting for status
  const getStatusBadge = (status: Call['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200">Completed</Badge>;
      case 'in_progress':
        return (
          <Badge className="bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 gap-1 animate-pulse">
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

  // Sentiment formatting
  const getSentimentBadge = (sentiment?: string) => {
    switch (sentiment) {
      case 'positive':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border border-emerald-200 gap-1 flex items-center w-fit">
            <Smile className="h-3.5 w-3.5" /> Positive Sentiment
          </Badge>
        );
      case 'neutral':
        return (
          <Badge className="bg-slate-50 text-slate-600 hover:bg-slate-50 border border-slate-200 gap-1 flex items-center w-fit">
            <Meh className="h-3.5 w-3.5" /> Neutral Sentiment
          </Badge>
        );
      case 'negative':
        return (
          <Badge className="bg-rose-50 text-rose-700 hover:bg-rose-50 border border-rose-200 gap-1 flex items-center w-fit">
            <Frown className="h-3.5 w-3.5" /> Negative Sentiment
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-100 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-xl mb-3 shadow-sm">
            {call.patient_name.substring(0, 2).toUpperCase()}
          </div>
          <CardTitle className="text-lg font-bold text-slate-800 leading-none">{call.patient_name}</CardTitle>
          <CardDescription className="text-xs text-slate-400 font-mono mt-1.5">{call.contact}</CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Age</span>
              <p className="text-sm font-semibold text-slate-700">{call.age || '--'} years</p>
            </div>
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Patient Type</span>
              <p className="text-sm font-semibold text-slate-700">{call.patient_type || 'General'}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Dialer Prompts / Context</span>
            <p className="text-xs text-slate-600 leading-relaxed font-medium bg-slate-50 border border-slate-100 p-3 rounded-xl">
              {call.context || 'No custom clinician instructions provided.'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Connection Summary */}
      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
        <CardHeader className="p-6 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800">Connection Summary</CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-400 font-semibold uppercase">Dialer Status</span>
            {getStatusBadge(call.status)}
          </div>

          <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
            <span className="text-slate-400 font-semibold uppercase">Call Language</span>
            <span className="font-semibold text-slate-700">{call.language || 'English'}</span>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
            <span className="text-slate-400 font-semibold uppercase">Duration</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              {call.duration_seconds ? `${call.duration_seconds} seconds` : '--'}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
            <span className="text-slate-400 font-semibold uppercase">Dial Date</span>
            <span className="font-semibold text-slate-700 flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              {new Date(call.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
            <span className="text-slate-400 font-semibold uppercase">Dial Time</span>
            <span className="font-semibold text-slate-700">
              {new Date(call.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {call.status === 'completed' && call.sentiment && (
            <div className="flex justify-between items-center text-xs border-t border-slate-100 pt-3">
              <span className="text-slate-400 font-semibold uppercase">Sentiment</span>
              {getSentimentBadge(call.sentiment)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
