'use client';

import React from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import { Call } from '@/lib/supabase';

interface DailyTrendsChartProps {
  calls: Call[];
}

export default function DailyTrendsChart({ calls }: DailyTrendsChartProps) {
  // Chart Data: Last 7 Days Volume
  const get7DaysData = () => {
    const dates: Record<string, { label: string; count: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
      dates[dateStr] = { label: dayLabel, count: 0 };
    }

    calls.forEach(call => {
      const callDateStr = call.created_at.split('T')[0];
      if (dates[callDateStr]) {
        dates[callDateStr].count += 1;
      }
    });

    return Object.values(dates);
  };

  const lineChartData = get7DaysData();

  return (
    <Card className="rounded-3xl border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardHeader className="p-6 border-b border-slate-100 pb-3">
        <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
          7-Day Call Volume
          <TrendingUp className="h-4 w-4 text-[#f97316]" />
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <div className="w-full h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }} 
              />
              <ChartTooltip 
                contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
              />
              <Line 
                type="monotone" 
                dataKey="count" 
                name="Calls Made"
                stroke="#f97316" 
                strokeWidth={3} 
                activeDot={{ r: 6 }} 
                dot={{ r: 3, strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
