'use client';

import React from 'react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as ChartTooltip, 
  Legend 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface CallSuccessChartProps {
  completed: number;
  inProgress: number;
  failed: number;
  pending: number;
}

export default function CallSuccessChart({ completed, inProgress, failed, pending }: CallSuccessChartProps) {
  const donutData = [
    { name: 'Completed', value: completed, color: '#10b981' },
    { name: 'In Progress', value: inProgress, color: '#3b82f6' },
    { name: 'Failed', value: failed, color: '#f43f5e' },
    { name: 'Pending', value: pending, color: '#94a3b8' }
  ].filter(d => d.value > 0);

  return (
    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
      <CardHeader className="p-6 border-b border-slate-100 pb-3">
        <CardTitle className="text-sm font-bold text-slate-800">Call Success Ratio</CardTitle>
      </CardHeader>
      <CardContent className="p-4 flex flex-col items-center">
        {donutData.length === 0 ? (
          <div className="h-44 flex items-center justify-center text-xs text-slate-400">
            No data to display.
          </div>
        ) : (
          <div className="w-full h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip 
                  contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                />
                <Legend 
                  iconType="circle" 
                  layout="horizontal" 
                  verticalAlign="bottom" 
                  align="center"
                  wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
