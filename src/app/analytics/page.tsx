'use client';

import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as ChartTooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { 
  TrendingUp, 
  Clock, 
  Percent, 
  Phone, 
  Activity, 
  Calendar,
  Award
} from 'lucide-react';
import { db, isSupabaseConfigured, subscribeToRealtime, Call } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';

export default function AnalyticsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCallsData = async () => {
    try {
      const data = await db.getCalls();
      setCalls(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCallsData();

    // Subscribe to updates
    let unsubscribe: () => void;
    if (isSupabaseConfigured && db) {
      const channel = (db as any).supabase?.channel('analytics-updates')
        .on('postgres_changes', { event: '*', table: 'calls' }, () => {
          fetchCallsData();
        })
        .subscribe();
      
      unsubscribe = () => {
        channel?.unsubscribe();
      };
    } else {
      unsubscribe = subscribeToRealtime((payload) => {
        if (payload.table === 'calls' || payload.table === 'all') {
          fetchCallsData();
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-28 bg-white rounded-3xl border border-slate-200" />
          <div className="h-28 bg-white rounded-3xl border border-slate-200" />
          <div className="h-28 bg-white rounded-3xl border border-slate-200" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-white rounded-3xl border border-slate-200" />
          <div className="h-96 bg-white rounded-3xl border border-slate-200" />
        </div>
      </div>
    );
  }

  // Calculate Metrics
  const totalCallsCount = calls.length;
  const completedCalls = calls.filter(c => c.status === 'completed');
  const failedCallsCount = calls.filter(c => c.status === 'failed').length;
  const completedCallsCount = completedCalls.length;

  // Monthly calls comparison (mock or dynamic date filter)
  const getMonthlyStats = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const thisMonthCalls = calls.filter(c => {
      const d = new Date(c.created_at);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).length;

    // Last month comparison
    const lastMonthCalls = calls.filter(c => {
      const d = new Date(c.created_at);
      const targetMonth = currentMonth === 0 ? 11 : currentMonth - 1;
      const targetYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    }).length;

    // Avoid division by zero
    const pctChange = lastMonthCalls > 0 
      ? Math.round(((thisMonthCalls - lastMonthCalls) / lastMonthCalls) * 100) 
      : thisMonthCalls * 100; // if no calls last month, show 100% per current call count

    return { thisMonthCalls, lastMonthCalls, pctChange };
  };

  const monthlyStats = getMonthlyStats();

  // Avg duration
  const totalDuration = completedCalls.reduce((acc, c) => acc + Number(c.duration_seconds || 0), 0);
  const avgDuration = completedCallsCount > 0 ? Math.round(totalDuration / completedCallsCount) : 0;

  // Success rate percentage
  const processedCallsCount = completedCallsCount + failedCallsCount;
  const successRate = processedCallsCount > 0 
    ? Math.round((completedCallsCount / processedCallsCount) * 100) 
    : 0;

  // 1. Language pie chart data
  const getLanguageData = () => {
    const langs: Record<string, number> = {};
    calls.forEach(c => {
      if (c.status === 'completed') {
        const l = c.language || 'English';
        langs[l] = (langs[l] || 0) + 1;
      }
    });

    const colors = ['#f97316', '#3b82f6', '#10b981'];
    return Object.entries(langs).map(([name, value], idx) => ({
      name,
      value,
      color: colors[idx % colors.length]
    }));
  };

  const languageChartData = getLanguageData();

  // 2. Patient Type horizontal bar chart
  const getPatientTypeData = () => {
    const types: Record<string, number> = {};
    calls.forEach(c => {
      const t = c.patient_type || 'General';
      types[t] = (types[t] || 0) + 1;
    });

    return Object.entries(types).map(([name, count]) => ({
      name,
      count
    })).sort((a, b) => b.count - a.count);
  };

  const patientTypeChartData = getPatientTypeData();

  // 3. Best time of day to call (based on answered calls count by hour)
  const getHourlyPerformance = () => {
    // We group call hours (e.g. 9 AM - 6 PM)
    const hoursData: Record<number, { hourLabel: string; answered: number; total: number }> = {};
    
    // Seed standard clinical hours
    for (let h = 9; h <= 18; h++) {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const displayHour = h > 12 ? h - 12 : h;
      hoursData[h] = { 
        hourLabel: `${displayHour} ${ampm}`, 
        answered: 0, 
        total: 0 
      };
    }

    calls.forEach(c => {
      const hour = new Date(c.created_at).getHours();
      if (hoursData[hour]) {
        hoursData[hour].total += 1;
        if (c.status === 'completed') {
          hoursData[hour].answered += 1;
        }
      }
    });

    return Object.values(hoursData);
  };

  const hourlyChartData = getHourlyPerformance();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Analytics Desk</h1>
        <p className="text-sm text-slate-500">Review clinical follow-up answer ratios, average times, and patient statistics.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* KPI 1: Month comparison */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outbound Check-ins</span>
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{monthlyStats.thisMonthCalls}</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Made this calendar month</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="p-2.5 bg-orange-50 text-[#f97316] rounded-xl"><Phone className="h-5 w-5" /></div>
              {monthlyStats.pctChange !== 0 && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 ${
                  monthlyStats.pctChange > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}>
                  <TrendingUp className="h-3 w-3" />
                  {monthlyStats.pctChange > 0 ? '+' : ''}{monthlyStats.pctChange}% MoM
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Avg Duration */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Check-in Duration</span>
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{avgDuration}s</h3>
              <p className="text-[10px] text-slate-400 font-semibold">For successfully answered check-ins</p>
            </div>
            <div className="p-2.5 bg-amber-50 text-amber-500 rounded-xl"><Clock className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        {/* KPI 3: Success Rate */}
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
          <CardContent className="p-5 flex justify-between items-center">
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient Answer Rate</span>
              <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">{successRate}%</h3>
              <p className="text-[10px] text-slate-400 font-semibold">Completed vs total dialed connections</p>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-500 rounded-xl"><Percent className="h-5 w-5" /></div>
          </CardContent>
        </Card>

      </div>

      {/* Main Charts Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Language Breakdown Pie */}
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-6 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
              Answered Languages
              <Award className="h-4 w-4 text-[#f97316]" />
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">Distribution of successful patient check-ins by call language.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 flex flex-col items-center justify-center">
            {languageChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                No answered call data to graph language details.
              </div>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={languageChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {languageChartData.map((entry, index) => (
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

        {/* Chart 2: Patient Condition breakdown */}
        <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
          <CardHeader className="p-6 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
              Condition Call Volume
              <Activity className="h-4 w-4 text-[#f97316]" />
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">Total check-in call volume categorized by physical injury type.</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            {patientTypeChartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-xs text-slate-400">
                No patient data.
              </div>
            ) : (
              <div className="w-full h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={patientTypeChartData} 
                    layout="vertical"
                    margin={{ top: 10, right: 10, left: 30, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis 
                      type="number" 
                      axisLine={false} 
                      tickLine={false} 
                      style={{ fontSize: '10px', fill: '#94a3b8', fontWeight: 500 }} 
                    />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      style={{ fontSize: '10px', fill: '#64748b', fontWeight: 600 }}
                    />
                    <ChartTooltip 
                      contentStyle={{ borderRadius: '12px', fontSize: '12px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar 
                      dataKey="count" 
                      name="Patient Calls"
                      fill="#f97316" 
                      radius={[0, 6, 6, 0]} 
                      maxBarSize={25}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Full Width Chart: Hour effectiveness */}
      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardHeader className="p-6 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
            Hourly Response Effectiveness
            <Calendar className="h-4 w-4 text-[#f97316]" />
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">Review patient connection answers by the hour of outbound dialing.</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart 
                data={hourlyChartData} 
                margin={{ top: 10, right: 20, left: -20, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="hourLabel" 
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
                  dataKey="answered" 
                  name="Calls Answered"
                  stroke="#10b981" 
                  strokeWidth={3} 
                  activeDot={{ r: 6 }} 
                  dot={{ r: 3, strokeWidth: 2 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  name="Total Calls Dialed"
                  stroke="#3b82f6" 
                  strokeWidth={2} 
                  strokeDasharray="4 4" 
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
