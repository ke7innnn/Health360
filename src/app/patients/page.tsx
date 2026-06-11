'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  Filter, 
  Download, 
  Phone, 
  Calendar, 
  Clock, 
  Plus, 
  Sparkles,
  Inbox,
  Loader2,
  X
} from 'lucide-react';
import { db, isSupabaseConfigured, subscribeToRealtime, Call } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function PatientsPage() {
  const router = useRouter();
  
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [callingState, setCallingState] = useState<Record<string, boolean>>({});

  // Quick Patient Add Form state
  const [newPatient, setNewPatient] = useState({
    patient_name: '',
    contact: '',
    age: '',
    patient_type: 'Knee Pain',
    context: '',
    language: 'English'
  });
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchCalls = async () => {
    try {
      const data = await db.getCalls();
      setCalls(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load call roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();

    // Subscribe to realtime changes
    let unsubscribe: () => void;
    if (isSupabaseConfigured && db) {
      const channel = (db as any).supabase?.channel('patients-list-updates')
        .on('postgres_changes', { event: '*', table: 'calls' }, () => {
          fetchCalls();
        })
        .subscribe();
      
      unsubscribe = () => {
        channel?.unsubscribe();
      };
    } else {
      unsubscribe = subscribeToRealtime((payload) => {
        if (payload.table === 'calls' || payload.table === 'all') {
          fetchCalls();
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Inline Outbound call trigger
  const handleCallPatient = async (callId: string, name: string) => {
    try {
      setCallingState(prev => ({ ...prev, [callId]: true }));
      await db.triggerSingleCall(callId);
      toast.info(`Single outbound call triggered for ${name}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to start outbound call.');
    } finally {
      setTimeout(() => {
        setCallingState(prev => ({ ...prev, [callId]: false }));
      }, 2000);
    }
  };

  // Add and call a new individual patient on the spot
  const handleCreateAndCallPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatient.patient_name.trim() || !newPatient.contact.trim()) {
      toast.warning('Patient Name and Contact Number are required.');
      return;
    }

    try {
      setIsAddingPatient(true);
      const createdCall = await db.triggerNewSingleCallForPatient(newPatient);
      toast.success(`Patient added & queued for check-in call!`, {
        description: `Name: ${createdCall.patient_name} | Language: ${createdCall.language}`
      });
      
      // Reset state and close dialog
      setNewPatient({
        patient_name: '',
        contact: '',
        age: '',
        patient_type: 'Knee Pain',
        context: '',
        language: 'English'
      });
      setDialogOpen(false);
      
      // Redirect to newly created call detail page
      router.push(`/calls/${createdCall.id}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create and dial patient.');
    } finally {
      setIsAddingPatient(false);
    }
  };

  // Extract unique patient types for filters
  const uniqueTypes = Array.from(new Set(calls.map(c => c.patient_type).filter(Boolean)));

  // Filter Logic
  const filteredCalls = calls.filter((call) => {
    // 1. Search filter
    const matchesSearch = 
      call.patient_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.contact.includes(searchTerm);

    // 2. Status filter
    const matchesStatus = statusFilter === 'all' || call.status === statusFilter;

    // 3. Patient Type filter
    const matchesType = typeFilter === 'all' || call.patient_type === typeFilter;

    // 4. Date filter (Today / 7d / 30d)
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const callDate = new Date(call.created_at);
      const diffTime = Math.abs(new Date().getTime() - callDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (dateFilter === 'today') {
        matchesDate = callDate.toDateString() === new Date().toDateString();
      } else if (dateFilter === '7d') {
        matchesDate = diffDays <= 7;
      } else if (dateFilter === '30d') {
        matchesDate = diffDays <= 30;
      }
    }

    return matchesSearch && matchesStatus && matchesType && matchesDate;
  });

  // Export Filtered Table to CSV
  const handleExportCSV = () => {
    if (filteredCalls.length === 0) {
      toast.warning('No patient logs found matching current filters to export.');
      return;
    }

    const headers = 'Name,Contact,Age,Patient Type,Language,Status,Duration(s),Dial Date,Context\n';
    const rows = filteredCalls.map(c => {
      const name = `"${c.patient_name.replace(/"/g, '""')}"`;
      const contact = `"${c.contact}"`;
      const age = c.age || '';
      const type = `"${c.patient_type}"`;
      const lang = c.language || 'English';
      const status = c.status;
      const duration = c.duration_seconds || '0';
      const date = new Date(c.created_at).toLocaleDateString();
      const ctx = `"${(c.context || '').replace(/"/g, '""')}"`;
      
      return `${name},${contact},${age},${type},${lang},${status},${duration},${date},${ctx}`;
    }).join('\n');

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `health360_patient_logs_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Patient Roster CSV Exported!');
  };

  // Helper formatting for status badges
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

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="space-y-6">
      
      {/* Top Console */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Logs & Directory</h1>
          <p className="text-sm text-slate-500">Manage patient directories, review calls, and launch quick check-ins.</p>
        </div>

        <div className="flex gap-3 shrink-0">
          <Button 
            variant="outline" 
            className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 gap-2 text-xs font-bold"
            onClick={handleExportCSV}
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>

          {/* Quick Add Patient Modal */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger 
            render={
              <Button className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-md gap-2 text-xs font-bold">
                <Plus className="h-4 w-4" /> Quick Call Patient
              </Button>
            }
          />
            <DialogContent className="rounded-3xl border-slate-200 max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-slate-800 font-bold flex items-center gap-1.5">
                  Single Check-in Dialer <Sparkles className="h-4 w-4 text-sage-500" />
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-xs">
                  Create a new patient entry and initiate a custom check-in call immediately.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateAndCallPatient} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Patient Name</label>
                    <Input 
                      placeholder="e.g. Ashok Kumar" 
                      value={newPatient.patient_name}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, patient_name: e.target.value }))}
                      className="rounded-xl border-slate-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500 text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Contact Number</label>
                    <Input 
                      placeholder="e.g. +91 99000 88000" 
                      value={newPatient.contact}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, contact: e.target.value }))}
                      className="rounded-xl border-slate-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500 text-xs h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Age</label>
                    <Input 
                      placeholder="e.g. 52" 
                      value={newPatient.age}
                      onChange={(e) => setNewPatient(prev => ({ ...prev, age: e.target.value }))}
                      className="rounded-xl border-slate-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500 text-xs h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Language</label>
                    <Select 
                      value={newPatient.language} 
                      onValueChange={(val) => setNewPatient(prev => ({ ...prev, language: val || 'English' }))}
                    >
                      <SelectTrigger className="rounded-xl border-slate-200 focus:border-sage-500 text-xs h-9">
                        <SelectValue placeholder="English" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200">
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Hindi">Hindi</SelectItem>
                        <SelectItem value="Marathi">Marathi</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Patient Type</label>
                  <Select 
                    value={newPatient.patient_type} 
                    onValueChange={(val) => setNewPatient(prev => ({ ...prev, patient_type: val || 'Knee Pain' }))}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 focus:border-sage-500 text-xs h-9">
                      <SelectValue placeholder="Knee Pain" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200">
                      <SelectItem value="Knee Pain">Knee Pain</SelectItem>
                      <SelectItem value="Lower Back Pain">Lower Back Pain</SelectItem>
                      <SelectItem value="Frozen Shoulder">Frozen Shoulder</SelectItem>
                      <SelectItem value="Post-Sprain Rehab">Post-Sprain Rehab</SelectItem>
                      <SelectItem value="Cervical Spondylosis">Cervical Spondylosis</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Context / Prompt Instructions</label>
                  <textarea 
                    rows={3}
                    placeholder="e.g. Ask if swelling in knee went down after using ice pack twice a day." 
                    value={newPatient.context}
                    onChange={(e) => setNewPatient(prev => ({ ...prev, context: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500 text-xs p-3 outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="rounded-xl text-xs font-semibold h-9"
                    onClick={() => setDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="btn-glow-green rounded-xl h-9 text-xs font-bold gap-1.5"
                    disabled={isAddingPatient}
                  >
                    {isAddingPatient ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" /> Dialing...
                      </>
                    ) : (
                      <>
                        <Phone className="h-3 w-3" /> Create & Call
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Search bar */}
          <div className="relative w-full md:w-80 shrink-0">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search patient name or phone..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl border-slate-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500 text-xs"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Selector filters */}
          <div className="flex flex-wrap md:flex-nowrap gap-3 items-center w-full justify-end">
            
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Status</span>
              <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val || 'all')}>
                <SelectTrigger className="w-32 rounded-xl border-slate-200 text-xs h-9 bg-white">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Patient Type Filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Condition</span>
              <Select value={typeFilter} onValueChange={(val) => setTypeFilter(val || 'all')}>
                <SelectTrigger className="w-40 rounded-xl border-slate-200 text-xs h-9 bg-white">
                  <SelectValue placeholder="All Conditions" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="all">All Conditions</SelectItem>
                  {uniqueTypes.map((type, idx) => (
                    <SelectItem key={idx} value={type || 'General'}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range filter */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Period</span>
              <Select value={dateFilter} onValueChange={(val) => setDateFilter(val || 'all')}>
                <SelectTrigger className="w-32 rounded-xl border-slate-200 text-xs h-9 bg-white">
                  <SelectValue placeholder="All Time" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Directory Table Grid */}
      <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {filteredCalls.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[40vh] text-slate-400">
              <Inbox className="h-10 w-10 text-slate-300 mb-3" />
              <h4 className="font-semibold text-slate-700">No matching patient records</h4>
              <p className="text-xs max-w-xs mt-1">Try adjusting your filters or search keywords.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/50">
                  <TableRow>
                    <TableHead className="font-semibold text-xs text-slate-500">Patient</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Contact</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Condition</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Language</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Dialed Date</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Status</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Duration</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCalls.map((call) => (
                    <TableRow 
                      key={call.id}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => router.push(`/calls/${call.id}`)}
                    >
                      <TableCell>
                        <div className="font-semibold text-sm text-slate-800">{call.patient_name}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">{call.age || '--'} Yrs</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-mono">{call.contact}</TableCell>
                      <TableCell className="text-xs text-slate-600">{call.patient_type}</TableCell>
                      <TableCell className="text-xs text-slate-600">{call.language || 'English'}</TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          {new Date(call.created_at).toLocaleDateString()}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(call.status)}</TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium">
                        {formatDuration(call.duration_seconds)}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button
                          size="sm"
                          className="btn-glow-green rounded-xl h-8 px-3 font-bold text-xs gap-1"
                          disabled={callingState[call.id] || call.status === 'in_progress'}
                          onClick={() => handleCallPatient(call.id, call.patient_name)}
                        >
                          <Phone className="h-3 w-3" />
                          {call.status === 'completed' || call.status === 'failed' ? 'Call Again' : 'Call Now'}
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
    </div>
  );
}
