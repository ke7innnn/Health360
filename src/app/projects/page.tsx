'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ClipboardList, 
  Calendar, 
  Users, 
  Loader2, 
  Sparkles,
  Inbox,
  Trash2,
  Edit2
} from 'lucide-react';
import { db, isSupabaseConfigured, subscribeToRealtime, Project } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDeleteProject = async (projectId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the patient list "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setDeletingId(projectId);
      await db.deleteProject(projectId);
      toast.success(`Patient List "${name}" deleted successfully.`);
      fetchProjects();
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete patient list.');
    } finally {
      setDeletingId(null);
    }
  };

  const fetchProjects = async () => {
    try {
      const allProjects = await db.getProjects();
      setProjects(allProjects);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient lists.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();

    // Subscribe to realtime database changes (Mock or Supabase)
    let unsubscribe: () => void;
    if (isSupabaseConfigured && db) {
      const channel = (db as any).supabase?.channel('projects-list')
        .on('postgres_changes', { event: '*', table: 'projects' }, () => {
          fetchProjects();
        })
        .subscribe();

      unsubscribe = () => {
        channel?.unsubscribe();
      };
    } else {
      unsubscribe = subscribeToRealtime((payload) => {
        if (payload.table === 'projects' || payload.table === 'all') {
          fetchProjects();
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
        <div className="h-10 bg-slate-200 rounded-xl w-44" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-32 bg-white rounded-3xl border border-slate-200" />
          <div className="h-32 bg-white rounded-3xl border border-slate-200" />
          <div className="h-32 bg-white rounded-3xl border border-slate-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Patient Lists</h1>
          <p className="text-sm text-slate-500">Save patient groups as reusable lists to easily launch campaigns later.</p>
        </div>
        
        <div className="flex gap-3">
          <Button 
            className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl shadow-md gap-2"
            onClick={() => router.push('/projects/new')}
          >
            <Sparkles className="h-4 w-4" />
            Create New List
          </Button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh] bg-white border border-slate-200 rounded-3xl">
          <Inbox className="h-12 w-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-700">No patient lists saved yet</h4>
          <p className="text-xs text-slate-400 max-w-xs mt-1 mb-6">Create your first reusable patient list to quickly run campaigns in the future.</p>
          <Button 
            onClick={() => router.push('/projects/new')} 
            className="bg-sage-500 hover:bg-sage-600 text-white rounded-xl"
          >
            Create Patient List
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((proj) => {
            const total = proj.patients?.length || 0;
            
            return (
              <Card 
                key={proj.id}
                className="rounded-3xl border-slate-200 bg-white hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between overflow-hidden relative group"
                onClick={() => router.push('/campaigns/new')}
              >
                <div className="p-6 space-y-4">
                  {/* Card Header Info */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-sage-50 text-sage-600 rounded-xl shrink-0">
                        <ClipboardList className="h-5 w-5" />
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/projects/${proj.id}/edit`);
                          }}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Edit List"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteProject(proj.id, proj.name);
                          }}
                          disabled={deletingId === proj.id}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                          title="Delete List"
                        >
                          {deletingId === proj.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-800 tracking-tight leading-snug truncate group-hover:text-sage-600 transition-colors">
                      {proj.name}
                    </h3>
                    <div className="flex items-center gap-4 text-slate-400 text-xs mt-2 font-semibold">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span>{total} Patients</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{new Date(proj.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
