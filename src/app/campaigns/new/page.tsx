'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Papa from 'papaparse';
import confetti from 'canvas-confetti';
import { 
  Upload, 
  Download, 
  Trash2, 
  Play, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import { db } from '@/lib/supabase';
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
  language: string;
  isValid: boolean;
}

// ─── Auto-fix phone numbers (handles Excel scientific notation like 9.187E+11) ──
function sanitizePhone(raw: string): string {
  if (!raw) return '';

  let num = raw.toString().trim();

  // Handle scientific notation from Excel: e.g. "9.187E+11" → "918700000000"
  if (/\d+\.?\d*[eE][+\-]?\d+/.test(num)) {
    num = Math.round(parseFloat(num)).toString();
  }

  // Strip everything except digits and leading +
  num = num.replace(/[^\d+]/g, '');

  // If it starts with 0, replace with +91
  if (num.startsWith('0')) {
    num = '+91' + num.slice(1);
  }

  // If it's 10 digits (Indian mobile without country code), add +91
  if (/^\d{10}$/.test(num)) {
    num = '+91' + num;
  }

  // If it's 12 digits starting with 91 (no +), add +
  if (/^91\d{10}$/.test(num)) {
    num = '+' + num;
  }

  // Ensure it starts with + for E.164 format
  if (!num.startsWith('+') && num.length > 0) {
    num = '+' + num;
  }

  return num;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [campaignName, setCampaignName] = useState('');
  const [patients, setPatients] = useState<ParsedPatient[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // CSV Template download
  const handleDownloadTemplate = () => {
    const csvContent = 
      "Name,Contact,Age,Patient Type,Context,Language\n" +
      "Rahul Sharma,+91 98765 43210,45,Knee Pain,Post-surgery checkup after 3 weeks,Hindi\n" +
      "Sunita Patil,+91 98234 56789,62,Knee Pain,Routine check for osteoarthritis treatment,Marathi\n" +
      "David Miller,+91 99112 23344,38,Frozen Shoulder,Post-sprain shoulder stiffness rehab check,English\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'health360_patients_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Template downloaded!');
  };

  // CSV Parsing and validation
  const parseCSV = (file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: ParsedPatient[] = results.data.map((row: any) => {
          // Normalize keys (case insensitive / whitespace trimming)
          const name = row.Name || row.name || row['Patient Name'] || '';
          const rawContact = row.Contact || row.contact || row.Phone || row.phone || '';
          const contact = sanitizePhone(rawContact); // auto-fix scientific notation, missing +91, etc.
          const age = row.Age || row.age || '';
          const patientType = row['Patient Type'] || row.patient_type || row.Type || row.type || 'General';
          const context = row.Context || row.context || '';
          const language = row.Language || row.language || 'English';

          const isValid = !!(name.trim() && contact.trim());

          return {
            patient_name: name.trim(),
            contact: contact.trim(),
            age: age.toString().trim(),
            patient_type: patientType.trim(),
            context: context.trim(),
            language: language.trim(),
            isValid
          };
        });

        setPatients(parsed);
        if (parsed.length > 0) {
          toast.success(`Parsed ${parsed.length} patients successfully!`);
          
          // Generate auto campaign name if empty
          if (!campaignName) {
            const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            setCampaignName(`Campaign ${dateStr} - ${parsed.length} Patients`);
          }
        } else {
          toast.error('No patient rows found in the CSV.');
        }
      },
      error: (error) => {
        console.error(error);
        toast.error('Failed to parse CSV file. Ensure it is formatted correctly.');
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseCSV(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseCSV(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setPatients([]);
    setCampaignName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Launch Campaign
  const handleLaunchCampaign = async () => {
    if (!campaignName.trim()) {
      toast.warning('Please enter a campaign name.');
      return;
    }

    const invalidCount = patients.filter(p => !p.isValid).length;
    if (invalidCount > 0) {
      toast.warning(`Cannot launch campaign with ${invalidCount} invalid patient record(s). Fix or remove them from the CSV.`);
      return;
    }

    try {
      setIsLaunching(true);

      // Create campaign and calls in Database
      const camp = await db.createCampaign(campaignName, patients);

      // Trigger Confetti!
      const end = Date.now() + (2.5 * 1000);
      const colors = ['#879882', '#0f172a', '#10b981'];

      (function frame() {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      }());

      toast.success('Campaign launched successfully!', {
        description: 'Initiating AI outbound dialer...'
      });

      // Redirect after animation
      setTimeout(() => {
        router.push(`/campaigns/${camp.id}`);
      }, 1500);

    } catch (err) {
      console.error(err);
      toast.error('Failed to create campaign. Please try again.');
      setIsLaunching(false);
    }
  };

  const hasInvalidRows = patients.some(p => !p.isValid);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header breadcrumb */}
      <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-500 hover:text-slate-800 rounded-xl"
          onClick={() => router.push('/campaigns')}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload & Launch Campaign</h1>
          <p className="text-sm text-slate-500">Upload a patient CSV roster to begin automated outbound feedback calls.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          className="rounded-xl gap-2 text-slate-600 hover:bg-slate-50"
          onClick={handleDownloadTemplate}
        >
          <Download className="h-4 w-4" /> Download CSV Template
        </Button>
      </div>

      {patients.length === 0 ? (
        /* CSV Drop Zone */
        <Card className="rounded-3xl border-2 border-dashed border-slate-200 bg-white hover:border-sage-500/50 transition-colors shadow-sm">
          <CardContent 
            className={`p-12 flex flex-col items-center justify-center text-center cursor-pointer ${
              isDragOver ? 'bg-sage-50/20' : ''
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".csv"
              onChange={handleFileChange}
            />
            <div className="p-4 bg-sage-50 text-sage-600 rounded-full mb-4 animate-pulse">
              <Upload className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg">Drop your patient CSV here</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1 mb-6">
              Or click to search your files. Make sure columns contain Name and Contact number.
            </p>
            <Button className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-md">
              Choose CSV File
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Preview Table and Form */
        <div className="space-y-6">
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-md font-bold text-slate-800">Roster Details</CardTitle>
                <CardDescription className="text-xs text-slate-400">Review patients found before dialer launch.</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-sage-100 text-sage-700 hover:bg-sage-100 border border-sage-200">
                  {patients.length} patients found
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                  onClick={handleClear}
                >
                  <Trash2 className="h-4 w-4 mr-1" /> Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[300px]">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0">
                    <TableRow>
                      <TableHead className="font-semibold text-xs text-slate-500">Name</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Contact</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Age</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Patient Type</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Language</TableHead>
                      <TableHead className="font-semibold text-xs text-slate-500">Context</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {patients.map((pat, idx) => (
                      <TableRow 
                        key={idx} 
                        className={!pat.isValid ? 'bg-red-50/50 hover:bg-red-50/70 border-l-4 border-l-red-500' : 'hover:bg-slate-50'}
                      >
                        <TableCell className="font-medium text-xs text-slate-800">
                          {pat.patient_name || <span className="text-red-500 italic font-normal">Missing Name</span>}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 font-mono">
                          {pat.contact || <span className="text-red-500 italic font-normal">Missing Contact</span>}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{pat.age || '--'}</TableCell>
                        <TableCell className="text-xs text-slate-600">{pat.patient_type || 'General'}</TableCell>
                        <TableCell className="text-xs text-slate-600">{pat.language}</TableCell>
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

          {/* Validation Alert Banner */}
          {hasInvalidRows && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-sm text-red-800">Roster validation failed</h4>
                <p className="text-xs text-red-600 mt-0.5">
                  One or more rows have missing Name or Contact fields (highlighted in red). Correct your file and re-upload to launch.
                </p>
              </div>
            </div>
          )}

          {/* Launch Controls */}
          <Card className="rounded-3xl border-slate-200 bg-white shadow-sm">
            <CardHeader className="p-6 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-800 font-sans">Campaign Settings</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Campaign Name</label>
                <Input 
                  placeholder="e.g. Back Pain Call Check - Week 2" 
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
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
        </div>
      )}
    </div>
  );
}
