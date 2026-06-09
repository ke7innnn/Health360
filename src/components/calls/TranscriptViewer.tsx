'use client';

import React from 'react';
import { Bot, User, Clock, Loader2, Frown, FileText } from 'lucide-react';
import { Call } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface ChatMessage {
  sender: 'agent' | 'user';
  text: string;
}

interface TranscriptViewerProps {
  status: Call['status'];
  transcript?: string;
}

export default function TranscriptViewer({ status, transcript }: TranscriptViewerProps) {
  // Helper to parse the raw transcript into structured messages
  const getParsedMessages = (rawText?: string): ChatMessage[] => {
    if (!rawText) return [];
    return rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        if (line.startsWith('Agent:')) {
          return { sender: 'agent', text: line.replace(/^Agent:\s*/i, '') };
        }
        if (line.startsWith('User:')) {
          return { sender: 'user', text: line.replace(/^User:\s*/i, '') };
        }
        if (line.startsWith('Bot:')) {
          return { sender: 'agent', text: line.replace(/^Bot:\s*/i, '') };
        }
        if (line.startsWith('Patient:')) {
          return { sender: 'user', text: line.replace(/^Patient:\s*/i, '') };
        }
        return { sender: 'agent', text: line };
      });
  };

  const messages = getParsedMessages(transcript);

  return (
    <Card className="rounded-3xl border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col flex-1 min-h-[400px]">
      <CardHeader className="p-6 border-b border-slate-100 shrink-0 flex flex-row items-center gap-3">
        <div className="p-2 bg-slate-50 text-slate-600 rounded-xl">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-sm font-bold text-slate-800">AI Call Transcript</CardTitle>
          <CardDescription className="text-xs text-slate-400">Verbatim log of therapist agent check-in.</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="p-6 bg-slate-50/50 flex-grow overflow-y-auto max-h-[500px] flex flex-col gap-4">
        {status === 'pending' || status === 'in_progress' ? (
          <div className="flex flex-col items-center justify-center p-12 text-center h-full my-auto text-slate-400">
            {status === 'in_progress' ? (
              <>
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-3" />
                <h4 className="font-semibold text-slate-700">Call is currently live...</h4>
                <p className="text-xs max-w-xs mt-1">Transcript will update live when the patient disconnects.</p>
              </>
            ) : (
              <>
                <Clock className="h-10 w-10 text-slate-300 mb-3 animate-pulse" />
                <h4 className="font-semibold text-slate-700">Call is queued</h4>
                <p className="text-xs max-w-xs mt-1">Transcript will appear when call ends.</p>
              </>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center h-full my-auto text-slate-400">
            <Frown className="h-10 w-10 text-slate-300 mb-3" />
            <h4 className="font-semibold text-slate-700">No transcript available</h4>
            <p className="text-xs max-w-xs mt-1">No conversational logs were recorded for this calling event (e.g. failed calls).</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 font-sans">
            {messages.map((msg, idx) => {
              const isAgent = msg.sender === 'agent';
              return (
                <div 
                  key={idx} 
                  className={`flex gap-3 max-w-[85%] ${
                    isAgent ? 'self-start' : 'self-end flex-row-reverse'
                  }`}
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 shadow-sm ${
                    isAgent 
                      ? 'bg-slate-900 border-slate-800 text-white' 
                      : 'bg-orange-100 border-orange-200 text-[#f97316]'
                  }`}>
                    {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>

                  {/* Bubble */}
                  <div className={`p-4 rounded-2xl text-xs font-semibold leading-relaxed shadow-sm ${
                    isAgent 
                      ? 'bg-white border border-slate-200 text-slate-800 rounded-tl-none' 
                      : 'bg-[#ffedd5] border border-orange-100 text-slate-800 rounded-tr-none'
                  }`}>
                    <p>{msg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
