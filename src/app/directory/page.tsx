'use client';

import React, { useEffect, useState } from 'react';
import { 
  Search, 
  Plus, 
  Sparkles,
  Loader2,
  Users
} from 'lucide-react';
import { db, Patient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function PatientDirectoryPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Quick Patient Add Form state
  const [newPatient, setNewPatient] = useState({
    patient_name: '',
    contact: '',
    age: '',
    patient_type: ''
  });
  const [isAddingPatient, setIsAddingPatient] = useState(false);
  const [isAddingMode, setIsAddingMode] = useState(false);

  const fetchPatients = async () => {
    try {
      const data = await db.getPatients();
      setPatients(data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleAddPatient = async () => {
    if (!newPatient.patient_name.trim() || !newPatient.contact.trim()) {
      toast.warning('Name and contact number are required.');
      return;
    }
    
    setIsAddingPatient(true);
    try {
      await db.upsertPatients([{
        patient_name: newPatient.patient_name.trim(),
        contact: newPatient.contact.trim(),
        age: newPatient.age.trim(),
        patient_type: newPatient.patient_type.trim()
      }]);
      toast.success('Patient added to global directory!');
      setNewPatient({ patient_name: '', contact: '', age: '', patient_type: '' });
      setIsAddingMode(false);
      fetchPatients();
    } catch (err) {
      console.error(err);
      toast.error('Failed to add patient.');
    } finally {
      setIsAddingPatient(false);
    }
  };

  // Filter logic
  const filteredPatients = patients.filter(p => {
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      if (!p.patient_name.toLowerCase().includes(s) && !p.contact.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-sage-500" />
            Global Patient Directory
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage and search your master list of all patients.</p>
        </div>
        {!isAddingMode && (
          <Button onClick={() => setIsAddingMode(true)} className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-sm gap-2">
            <Plus className="h-4 w-4" /> Add Patient
          </Button>
        )}
      </div>

      {isAddingMode && (
        <Card className="rounded-3xl border-slate-200 shadow-sm border-2 border-sage-200 bg-sage-50/30">
          <CardHeader className="p-5 border-b border-sage-100">
            <CardTitle className="text-sm font-bold text-sage-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sage-500" /> Add New Patient
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Patient Name *</label>
                <Input placeholder="John Doe" value={newPatient.patient_name} onChange={e => setNewPatient({...newPatient, patient_name: e.target.value})} className="rounded-xl border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contact Number *</label>
                <Input placeholder="+91 98765 43210" value={newPatient.contact} onChange={e => setNewPatient({...newPatient, contact: e.target.value})} className="rounded-xl border-slate-200 font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Age</label>
                <Input placeholder="45" type="number" value={newPatient.age} onChange={e => setNewPatient({...newPatient, age: e.target.value})} className="rounded-xl border-slate-200" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Condition / Type</label>
                <Input placeholder="e.g. Knee Pain" value={newPatient.patient_type} onChange={e => setNewPatient({...newPatient, patient_type: e.target.value})} className="rounded-xl border-slate-200" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsAddingMode(false)} className="rounded-xl text-slate-500">Cancel</Button>
              <Button onClick={handleAddPatient} disabled={isAddingPatient || !newPatient.patient_name || !newPatient.contact} className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-sm min-w-[120px]">
                {isAddingPatient ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Patient'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl border-slate-200 shadow-sm overflow-hidden bg-white">
        <CardHeader className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by name or contact number..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 rounded-xl border-slate-200 bg-slate-50/50 focus-visible:bg-white transition-colors"
            />
          </div>
          <div className="text-sm font-medium text-slate-500">
            {filteredPatients.length} patient{filteredPatients.length !== 1 ? 's' : ''} found
          </div>
        </CardHeader>
        
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-sage-400" />
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-slate-500">No patients found in directory.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-xs text-slate-500">Patient Name</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Contact</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Age</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500">Condition</TableHead>
                    <TableHead className="font-semibold text-xs text-slate-500 text-right">Added On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map(p => (
                    <TableRow key={p.id} className="hover:bg-slate-50">
                      <TableCell className="font-medium text-slate-800">{p.patient_name}</TableCell>
                      <TableCell className="font-mono text-sm text-slate-600">{p.contact}</TableCell>
                      <TableCell className="text-slate-600">{p.age || '--'}</TableCell>
                      <TableCell className="text-slate-600">{p.patient_type || '--'}</TableCell>
                      <TableCell className="text-right text-slate-400 text-xs">
                        {new Date(p.created_at).toLocaleDateString()}
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
