'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import { read, utils } from 'xlsx';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Download, 
  Trash2, 
  Play, 
  AlertTriangle, 
  ArrowLeft,
  Sparkles,
  PenLine,
  Plus,
  X,
  FileSpreadsheet,
  Info,
  ClipboardList
} from 'lucide-react';
import { db, Project } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ParsedPatient {
  patient_name: string;
  contact: string;
  age: string;
  patient_type: string;
  context: string;
  isValid: boolean;
}

// ─── Blank row factory (matches Retell prompt variables) ──────────────────────
const blankRow = (): ParsedPatient => ({
  patient_name: '',   // → {{ patient_name }}
  contact: '',
  age: '',
  patient_type: '',   // → {{ patient_type }}
  context: '',        // → {{ patient_context }}
  isValid: false,
});

// ─── Auto-fix phone numbers ───────────────────────────────────────────────────
function sanitizePhone(raw: string): string {
  if (!raw) return '';
  let num = raw.toString().trim();
  // detect scientific notation from Excel (e.g. 9.19E+9)
  if (/\d+\.?\d*[eE][+\-]?\d+/.test(num)) {
    num = Math.round(parseFloat(num)).toString();
  }
  num = num.replace(/[^\d+]/g, '');
  if (num.startsWith('0')) num = '+91' + num.slice(1);
  if (/^\d{10}$/.test(num)) num = '+91' + num;
  if (/^91\d{10}$/.test(num)) num = '+' + num;
  if (!num.startsWith('+') && num.length > 0) num = '+' + num;
  if (num === '+') return '';
  return num;
}


// ─── Title-case helper ────────────────────────────────────────────────────────
function toTitleCase(str: string): string {
  if (!str) return '';
  return str.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

// ─── Case-insensitive column lookup ──────────────────────────────────────────
function getRowValue(row: any, keys: string[], defaultValue = ''): string {
  if (!row) return defaultValue;
  const normalizedRow: Record<string, any> = {};
  for (const k of Object.keys(row)) {
    normalizedRow[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = row[k];
  }
  for (const key of keys) {
    const nk = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normalizedRow[nk] !== undefined && normalizedRow[nk] !== null) {
      return String(normalizedRow[nk]).trim();
    }
  }
  return defaultValue;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function NewCampaignPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // "upload" | "manual" | "project"
  const [inputMode, setInputMode] = useState<'upload' | 'manual' | 'project'>('upload');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  useEffect(() => {
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const data = await db.getProjects();
        setProjects(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingProjects(false);
      }
    };
    loadProjects();
  }, []);

  const [campaignName, setCampaignName] = useState('');
  const [patients, setPatients] = useState<ParsedPatient[]>([]);
  const [manualRows, setManualRows] = useState<ParsedPatient[]>([blankRow(), blankRow(), blankRow()]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // ── CSV template download ────────────────────────────────────────────────
  const handleDownloadTemplate = () => {
    const csv =
      'Name,Contact,Age,Patient Type,Context\n' +
      'Rahul Sharma,+91 98765 43210,45,Knee Pain,Post-surgery checkup after 3 weeks\n' +
      'Sunita Patil,+91 98234 56789,62,Knee Pain,Routine check for osteoarthritis treatment\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'health360_template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast.success('CSV Template downloaded!');
  };

  // ── Parsed data processing (shared by upload & manual) ──────────────────
  const processParsedData = (data: any[]) => {
    const parsed: ParsedPatient[] = data.map((row: any) => {
      let name = getRowValue(row, ['name', 'patient_name', 'patient name']);
      name = toTitleCase(name);
      const rawContact = getRowValue(row, ['contact', 'phone', 'phone_number', 'contact_number', 'contact number']);
      const contact = sanitizePhone(rawContact);
      const age = getRowValue(row, ['age']);
      const patientType = getRowValue(row, ['patient_type', 'patienttype', 'patient type', 'type', 'condition'], 'General');
      const context = getRowValue(row, ['context', 'notes', 'prompt', 'patient_context']);
      return { patient_name: name, contact, age, patient_type: patientType, context, isValid: !!(name && contact) };
    });
    setPatients(parsed);
    if (parsed.length > 0) {
      toast.success(`Parsed ${parsed.length} patients successfully!`);
      if (!campaignName) {
        const d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        setCampaignName(`Campaign ${d} - ${parsed.length} Patients`);
      }
    } else {
      toast.error('No patient rows found in the uploaded file.');
    }
  };

  // ── File parsing ─────────────────────────────────────────────────────────
  const parseRosterFile = (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    if (isExcel) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          processParsedData(utils.sheet_to_json(sheet));
        } catch { toast.error('Failed to parse Excel file.'); }
      };
      reader.readAsArrayBuffer(file);
    } else {
      Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: (r) => processParsedData(r.data),
        error: () => toast.error('Failed to parse CSV file.'),
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) parseRosterFile(e.target.files[0]);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragOver(false);
    if (e.dataTransfer.files?.[0]) parseRosterFile(e.dataTransfer.files[0]);
  };
  const handleClear = () => {
    setPatients([]);
    setCampaignName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Manual row helpers ───────────────────────────────────────────────────
  const updateManualRow = (idx: number, field: keyof ParsedPatient, value: string) => {
    setManualRows(prev => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };
      // auto-format name & sanitize phone on the fly
      if (field === 'patient_name') row.patient_name = value; // keep raw while typing
      if (field === 'contact') row.contact = value;           // keep raw while typing
      row.isValid = !!((row.patient_name || '').trim() && (row.contact || '').trim());
      next[idx] = row;
      return next;
    });
  };

  const addManualRow = () => setManualRows(prev => [...prev, blankRow()]);
  const removeManualRow = (idx: number) => {
    if (manualRows.length === 1) return;
    setManualRows(prev => prev.filter((_, i) => i !== idx));
  };

  // Convert manual rows → proper parsed patients and load into patients state
  const confirmManualRows = () => {
    const valid = manualRows.filter(r => (r.patient_name || '').trim() || (r.contact || '').trim());
    if (valid.length === 0) { toast.warning('Please fill in at least one patient row.'); return; }
    const processed = valid.map(r => ({
      patient_name: toTitleCase((r.patient_name || '').trim()),
      contact: sanitizePhone(r.contact || ''),
      age: (r.age || '').trim(),
      patient_type: (r.patient_type || '').trim() || 'General',
      context: (r.context || '').trim(),
      isValid: !!((r.patient_name || '').trim() && sanitizePhone(r.contact || '')),
    }));
    setPatients(processed);
    if (!campaignName) {
      const d = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setCampaignName(`Campaign ${d} - ${processed.length} Patients`);
    }
    toast.success(`${processed.length} patients added to campaign roster!`);
  };

  // ── Launch campaign ──────────────────────────────────────────────────────
  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) { toast.warning('Please enter a campaign name.'); return; }
    const invalid = patients.filter(p => !p.isValid).length;
    if (invalid > 0) { toast.warning(`Cannot launch with ${invalid} invalid record(s).`); return; }
    try {
      setIsLaunching(true);
      const camp = await db.createCampaign(campaignName, patients);
      const end = Date.now() + 2500;
      const colors = ['#879882', '#0f172a', '#10b981'];
      (function frame() {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors });
        if (Date.now() < end) requestAnimationFrame(frame);
      }());
      toast.success('Campaign launched!', { description: 'Initiating AI outbound dialer...' });
      setTimeout(() => router.push(`/campaigns/${camp.id}`), 1500);
    } catch (err) {
      console.error(err);
      toast.error('Failed to create campaign. Please try again.');
      setIsLaunching(false);
    }
  };

  const hasInvalidRows = patients.some(p => !p.isValid);
  const filledManualRows = manualRows.filter(r => r.patient_name.trim() || r.contact.trim()).length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800 rounded-xl" onClick={() => router.push('/campaigns')}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="flex justify-between items-end flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create & Launch Campaign</h1>
          <p className="text-sm text-slate-500">Add patients via file upload or enter them directly in the app.</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl gap-2 text-slate-600 hover:bg-slate-50" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4" /> Download CSV Template
        </Button>
      </div>

      {/* ── Mode toggle tabs ───────────────────────────────────────────── */}
      {patients.length === 0 && (
        <div className="flex gap-2 bg-slate-100 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setInputMode('upload')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              inputMode === 'upload'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            Upload File
          </button>
          <button
            onClick={() => setInputMode('manual')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              inputMode === 'manual'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <PenLine className="h-4 w-4" />
            Enter Manually
          </button>
          <button
            onClick={() => setInputMode('project')}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
              inputMode === 'project'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Select from List
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {patients.length === 0 ? (

          inputMode === 'project' ? (
            /* ── Select from List ─────────────────────────────────────────── */
            <motion.div key="project" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden min-h-[300px]">
                <CardHeader className="p-5 border-b border-slate-100">
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-sage-500" /> Choose a Patient List
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-0.5">
                    Select a previously saved patient list to use for this campaign.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {loadingProjects ? (
                    <div className="flex justify-center items-center h-32">
                      <div className="animate-pulse flex flex-col items-center gap-2">
                        <div className="h-6 w-6 rounded-full border-2 border-sage-500 border-t-transparent animate-spin" />
                        <span className="text-xs text-slate-400">Loading lists...</span>
                      </div>
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-sm text-slate-500 mb-4">You don't have any saved patient lists yet.</p>
                      <Button variant="outline" onClick={() => router.push('/projects/new')} className="rounded-xl border-sage-200 text-sage-600 hover:bg-sage-50">
                        Create a List
                      </Button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {projects.map(proj => (
                        <div 
                          key={proj.id} 
                          onClick={() => {
                            const parsed = proj.patients.map(p => ({
                              ...p,
                              isValid: !!(p.patient_name?.trim() && p.contact?.trim())
                            }));
                            setPatients(parsed);
                            setCampaignName(`Campaign: ${proj.name}`);
                            toast.success(`Loaded ${parsed.length} patients from list.`);
                          }}
                          className="border border-slate-200 hover:border-sage-400 hover:shadow-sm rounded-2xl p-4 cursor-pointer transition-all hover:bg-sage-50/10 group"
                        >
                          <h4 className="font-bold text-slate-800 text-sm group-hover:text-sage-600 transition-colors">{proj.name}</h4>
                          <p className="text-xs text-slate-500 mt-1">{proj.patients.length} patients</p>
                          <p className="text-[10px] text-slate-400 mt-2">
                            Created {new Date(proj.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ) : inputMode === 'upload' ? (
            /* ── Upload Drop Zone ─────────────────────────────────────────── */
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <Card className="rounded-3xl border-2 border-dashed border-slate-200 bg-white hover:border-sage-500/50 transition-colors shadow-sm">
                <CardContent
                  className={`p-12 flex flex-col items-center justify-center text-center cursor-pointer ${isDragOver ? 'bg-sage-50/20' : ''}`}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input type="file" ref={fileInputRef} className="hidden"
                    accept=".csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                    onChange={handleFileChange} />
                  <div className="p-4 bg-sage-50 text-sage-600 rounded-full mb-4 animate-pulse">
                    <Upload className="h-8 w-8" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg">Drop your patient CSV or Excel here</h3>
                  <p className="text-xs text-slate-400 max-w-xs mt-1 mb-6">
                    Supports CSV, XLSX and XLS. Columns: Name, Contact, Age, Patient Type, Context.
                  </p>
                  <Button className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-md">Choose File</Button>
                </CardContent>
              </Card>
            </motion.div>

          ) : (
            /* ── Manual Entry Sheet ────────────────────────────────────────── */
            <motion.div key="manual" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">

              {/* Retell prompt variable legend */}
              <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 font-medium leading-relaxed">
                  These fields map directly to your Retell AI prompt:<br />
                  <span className="font-mono bg-blue-100 px-1 rounded">Name</span> → <span className="font-mono">{'{{patient_name}}'}</span> &nbsp;·&nbsp;
                  <span className="font-mono bg-blue-100 px-1 rounded">Treatment / Condition</span> → <span className="font-mono">{'{{patient_type}}'}</span> &nbsp;·&nbsp;
                  <span className="font-mono bg-blue-100 px-1 rounded">Call Context</span> → <span className="font-mono">{'{{patient_context}}'}</span>
                </p>
              </div>

              <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
                <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-sage-500" /> Patient Entry Sheet
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-400 mt-0.5">
                      Fill in patient details below. Each row = one outbound AI call.
                    </CardDescription>
                  </div>
                  {filledManualRows > 0 && (
                    <Badge className="bg-sage-100 text-sage-700 border border-sage-200">
                      {filledManualRows} patient{filledManualRows > 1 ? 's' : ''} entered
                    </Badge>
                  )}
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide w-8 text-center">#</th>
                          <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide min-w-[180px]">
                            Patient Name
                            <span className="ml-1 text-[10px] font-mono text-blue-400 normal-case">{'{{patient_name}}'}</span>
                          </th>
                          <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide min-w-[150px]">
                            Contact Number
                          </th>
                          <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide min-w-[60px]">Age</th>
                          <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide min-w-[180px]">
                            Treatment / Condition
                            <span className="ml-1 text-[10px] font-mono text-blue-400 normal-case">{'{{patient_type}}'}</span>
                          </th>
                          <th className="text-left px-4 py-3 font-bold text-slate-500 uppercase tracking-wide min-w-[280px]">
                            Call Context / Notes
                            <span className="ml-1 text-[10px] font-mono text-blue-400 normal-case">{'{{patient_context}}'}</span>
                          </th>
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {manualRows.map((row, idx) => (
                          <tr key={idx} className={`border-b border-slate-100 transition-colors ${
                            (row.patient_name || '').trim() && !sanitizePhone(row.contact || '') ? 'bg-red-50/30' :
                            (row.patient_name || '').trim() && (row.contact || '').trim() ? 'bg-emerald-50/20' : 'hover:bg-slate-50/50'
                          }`}>
                            <td className="px-4 py-2 text-center text-slate-400 font-mono font-bold">{idx + 1}</td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={row.patient_name}
                                onChange={e => updateManualRow(idx, 'patient_name', e.target.value)}
                                placeholder="e.g. Priya Sharma"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-sage-400 focus:ring-1 focus:ring-sage-400 bg-white"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={row.contact}
                                onChange={e => updateManualRow(idx, 'contact', e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs font-mono text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-sage-400 focus:ring-1 focus:ring-sage-400 bg-white"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="number"
                                value={row.age}
                                onChange={e => updateManualRow(idx, 'age', e.target.value)}
                                placeholder="45"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-sage-400 focus:ring-1 focus:ring-sage-400 bg-white"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={row.patient_type}
                                onChange={e => updateManualRow(idx, 'patient_type', e.target.value)}
                                placeholder="e.g. Back Pain, Knee Pain"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-sage-400 focus:ring-1 focus:ring-sage-400 bg-white"
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <input
                                type="text"
                                value={row.context}
                                onChange={e => updateManualRow(idx, 'context', e.target.value)}
                                placeholder="e.g. Post-surgery follow-up, missed last session, next appt Monday 4pm"
                                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-sage-400 focus:ring-1 focus:ring-sage-400 bg-white"
                              />
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <button
                                onClick={() => removeManualRow(idx)}
                                disabled={manualRows.length === 1}
                                className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-0 transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <button
                      onClick={addManualRow}
                      className="flex items-center gap-1.5 text-xs font-bold text-sage-600 hover:text-sage-700 px-3 py-1.5 rounded-lg hover:bg-sage-50 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Row
                    </button>
                    <Button
                      size="sm"
                      className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl gap-2 font-bold"
                      onClick={confirmManualRows}
                      disabled={filledManualRows === 0}
                    >
                      <Sparkles className="h-3.5 w-3.5" />
                      Confirm {filledManualRows > 0 ? `${filledManualRows} Patient${filledManualRows > 1 ? 's' : ''}` : 'Patients'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )

        ) : (
          /* ── Preview Table + Launch ──────────────────────────────────────── */
          <motion.div key="preview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
              <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-md font-bold text-slate-800">Roster Preview</CardTitle>
                  <CardDescription className="text-xs text-slate-400">Review all patients before launching the dialer.</CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className="bg-sage-100 text-sage-700 hover:bg-sage-100 border border-sage-200">
                    {patients.length} patients found
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl" onClick={handleClear}>
                    <Trash2 className="h-4 w-4 mr-1" /> Clear
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto max-h-[350px]">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                      <TableRow className="bg-slate-50 border-b border-slate-100 hover:bg-slate-50">
                        <TableHead className="font-semibold text-xs text-slate-500 w-[180px]">
                          Name <span className="font-mono text-[10px] text-blue-400">{'{{patient_name}}'}</span>
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-slate-500 w-[140px]">Contact</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-500 w-[60px]">Age</TableHead>
                        <TableHead className="font-semibold text-xs text-slate-500 w-[160px]">
                          Treatment <span className="font-mono text-[10px] text-blue-400">{'{{patient_type}}'}</span>
                        </TableHead>
                        <TableHead className="font-semibold text-xs text-slate-500">
                          Context <span className="font-mono text-[10px] text-blue-400">{'{{patient_context}}'}</span>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patients.map((pat, idx) => (
                        <TableRow key={idx} className={!pat.isValid ? 'bg-red-50/50 hover:bg-red-50/70 border-l-4 border-l-red-500' : 'hover:bg-slate-50'}>
                          <TableCell className="font-medium text-xs text-slate-800">
                            {pat.patient_name || <span className="text-red-500 italic font-normal">Missing Name</span>}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 font-mono">
                            {pat.contact || <span className="text-red-500 italic font-normal">Missing Contact</span>}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600">{pat.age || '--'}</TableCell>
                          <TableCell className="text-xs text-slate-600">{pat.patient_type || 'General'}</TableCell>
                          <TableCell className="text-xs text-slate-400 max-w-xs overflow-hidden text-ellipsis whitespace-nowrap">
                            {pat.context || '--'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {hasInvalidRows && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-red-800">Roster validation failed</h4>
                  <p className="text-xs text-red-600 mt-0.5">
                    One or more rows have missing Name or Contact (highlighted in red). Fix them before launching.
                  </p>
                </div>
              </div>
            )}

            <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
              <CardHeader className="p-6 border-b border-slate-100">
                <CardTitle className="text-sm font-bold text-slate-800">Campaign Settings</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Campaign Name</label>
                  <Input
                    placeholder="e.g. Back Pain Follow-up – Week 2"
                    value={campaignName}
                    onChange={e => setCampaignName(e.target.value)}
                    className="rounded-xl border-slate-200 focus:border-sage-500 focus:ring-1 focus:ring-sage-500"
                  />
                </div>
                <div className="pt-2 flex justify-end">
                  <Button
                    className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-md px-6 gap-2"
                    onClick={handleLaunchCampaign}
                    disabled={isLaunching || hasInvalidRows || !campaignName.trim()}
                  >
                    <Play className="h-4 w-4" />
                    {isLaunching ? 'Launching...' : 'Start Calling'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
