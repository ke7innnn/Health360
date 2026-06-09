'use client';

import React from 'react';
import { 
  Phone, 
  PhoneCall, 
  PhoneOff, 
  Clock, 
  CheckCircle2 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedCounter from '@/components/AnimatedCounter';

interface StatsGridProps {
  totalCalls: number;
  completedCalls: number;
  inProgressCalls: number;
  failedCalls: number;
  avgDuration: number;
}

export default function StatsGrid({ 
  totalCalls, 
  completedCalls, 
  inProgressCalls, 
  failedCalls, 
  avgDuration 
}: StatsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Total Calls</span>
            <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Phone className="h-4 w-4" /></div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight leading-none">
              <AnimatedCounter value={totalCalls} />
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Outbound attempts</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Completed</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><CheckCircle2 className="h-4 w-4" /></div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-emerald-600 tracking-tight leading-none">
              <AnimatedCounter value={completedCalls} />
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Patient connected</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">In Progress</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><PhoneCall className="h-4 w-4 animate-bounce" /></div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-blue-600 tracking-tight leading-none">
              <AnimatedCounter value={inProgressCalls} />
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Currently dialing</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Failed</span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-lg"><PhoneOff className="h-4 w-4" /></div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-rose-600 tracking-tight leading-none">
              <AnimatedCounter value={failedCalls} />
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Unreachable/declined</p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden bg-white hover:shadow-md transition-shadow col-span-2 md:col-span-1">
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">Avg Duration</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Clock className="h-4 w-4" /></div>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-amber-600 tracking-tight leading-none">
              <AnimatedCounter value={avgDuration} suffix="s" />
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Connected calls</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
