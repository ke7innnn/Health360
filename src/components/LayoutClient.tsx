'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Megaphone, 
  Users, 
  BarChart3, 
  Activity, 
  Bell, 
  Database,
  Menu,
  X,
  User,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  LogOut
} from 'lucide-react';
import { db, isSupabaseConfigured, subscribeToRealtime } from '@/lib/supabase';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';

// Helper to hash string using SHA-256
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
  { name: 'Patients / Calls', href: '/patients', icon: Users },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 }
];

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [inProgressCount, setInProgressCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showBellBadge, setShowBellBadge] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Check auth on mount
  useEffect(() => {
    const auth = localStorage.getItem('health360_auth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setCheckingAuth(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('health360_auth');
    setIsAuthenticated(false);
    toast.success('Logged out successfully.');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      toast.warning('Please enter both ID and password.');
      return;
    }

    setIsValidating(true);
    try {
      const credentialsHash = await sha256(`${loginUsername}:${loginPassword}`);
      if (credentialsHash === '5239c6756fa8614fd544a776790a8d00f76607f6b58057dda96e8141ab320774') {
        localStorage.setItem('health360_auth', 'true');
        setIsAuthenticated(true);
        toast.success('Welcome back, Admin!', {
          description: 'Access granted to Health 360 Dashboard.',
        });
      } else {
        toast.error('Invalid credentials', {
          description: 'Please check your ID and Password.',
        });
      }
    } catch (err) {
      console.error(err);
      toast.error('Authentication error occurred.');
    } finally {
      setIsValidating(false);
    }
  };

  // Fetch active call count and subscribe to updates
  useEffect(() => {
    const fetchActiveCalls = async () => {
      try {
        const calls = await db.getCalls();
        const active = calls.filter(c => c.status === 'in_progress').length;
        setInProgressCount(active);
      } catch (err) {
        console.error(err);
      }
    };

    fetchActiveCalls();

    // Subscribe to realtime updates (works for mock/Supabase)
    let unsubscribe: () => void;
    if (isSupabaseConfigured && db) {
      // For Supabase
      const channel = (db as any).supabase?.channel('layout-active-calls')
        .on('postgres_changes', { event: '*', filter: 'status=eq.in_progress', table: 'calls' }, () => {
          fetchActiveCalls();
        })
        .subscribe();
      
      unsubscribe = () => {
        channel?.unsubscribe();
      };
    } else {
      // For Local Mock
      unsubscribe = subscribeToRealtime((payload) => {
        if (payload.table === 'calls' || payload.table === 'all') {
          fetchActiveCalls();
          if (payload.event === 'UPDATE' && payload.record) {
            const updatedCall = payload.record;
            if (updatedCall.status === 'completed') {
              toast.success(`Call completed: Patient ${updatedCall.patient_name}`, {
                description: `Duration: ${updatedCall.duration_seconds}s | Sentiment: ${updatedCall.sentiment}`
              });
              setNotifications(prev => [`Call completed for ${updatedCall.patient_name} (${updatedCall.sentiment})`, ...prev.slice(0, 4)]);
              setShowBellBadge(true);
            } else if (updatedCall.status === 'failed') {
              toast.error(`Call failed: Patient ${updatedCall.patient_name}`, {
                description: `Patient did not answer the outbound call.`
              });
              setNotifications(prev => [`Call failed for ${updatedCall.patient_name}`, ...prev.slice(0, 4)]);
              setShowBellBadge(true);
            } else if (updatedCall.status === 'in_progress') {
              toast.info(`Calling patient: ${updatedCall.patient_name}...`, {
                description: `Type: ${updatedCall.patient_type}`
              });
            }
          }
        }
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Update document title
  useEffect(() => {
    if (inProgressCount > 0) {
      document.title = `(${inProgressCount} calling) Health 360 Dashboard`;
    } else {
      document.title = 'Health 360 Dashboard';
    }
  }, [inProgressCount]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Activity className="h-10 w-10 text-sage-500 animate-pulse" />
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest animate-pulse">
            Verifying Session...
          </p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0f172a] to-emerald-950/40 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          {/* Decorative Background Glows */}
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-sage-500/10 rounded-full blur-3xl" />

          {/* Form Card */}
          <div className="backdrop-blur-xl bg-slate-900/60 border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
            <div className="flex flex-col items-center mb-8">
              <div className="p-3 bg-gradient-to-tr from-sage-500/10 to-emerald-500/20 border border-sage-500/20 rounded-2xl mb-4">
                <Activity className="h-8 w-8 text-sage-500 animate-pulse" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-wide">Welcome to Health 360</h2>
              <p className="text-xs text-slate-400 mt-1">Physiotherapy Clinic Management Portal</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Admin ID
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    required
                    placeholder="Enter admin ID"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 bg-slate-950/50 border border-slate-800 focus:border-sage-500 focus:ring-1 focus:ring-sage-500/20 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 bg-slate-950/50 border border-slate-800 focus:border-sage-500 focus:ring-1 focus:ring-sage-500/20 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isValidating}
                className="w-full mt-2 py-3 bg-gradient-to-r from-sage-500 to-emerald-600 hover:from-sage-600 hover:to-emerald-700 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-950/20 transition-all flex items-center justify-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>
        <Toaster position="top-right" richColors />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar for Mobile Layout */}
      <div className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="fixed inset-0 bg-slate-900/60" onClick={() => setSidebarOpen(false)} />
        <div className={`fixed top-0 bottom-0 left-0 w-64 bg-[#0f172a] text-white flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-6 border-b border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <Activity className="h-6 w-6 text-sage-500 animate-pulse" />
              <span className="font-bold text-lg tracking-wider">HEALTH 360</span>
            </div>
            <button className="text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X className="h-6 w-6" />
            </button>
          </div>
          <nav className="flex-1 px-4 py-6 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    isActive 
                      ? 'bg-gradient-to-r from-sage-500/10 to-sage-600/20 text-sage-600 border-l-4 border-sage-500' 
                      : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-[#0f172a] text-white shrink-0 fixed top-0 bottom-0 left-0 z-20">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-sage-500 to-sage-600 rounded-lg">
            <Activity className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="font-bold text-md tracking-wider leading-none text-white">HEALTH 360</h1>
            <span className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">Physiotherapy</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  isActive 
                    ? 'bg-gradient-to-r from-sage-500/10 to-sage-600/20 text-sage-600 border-l-4 border-sage-500' 
                    : 'text-slate-300 hover:bg-slate-800/30 hover:text-white'
                }`}
              >
                <item.icon className={`h-5 w-5 transition-transform duration-300 ${isActive ? 'scale-110 text-sage-500' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold ${
            isSupabaseConfigured ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
          }`}>
            <Database className="h-4 w-4 shrink-0" />
            <div className="overflow-hidden text-ellipsis whitespace-nowrap">
              {isSupabaseConfigured ? 'Live Database Active' : 'Sandbox Simulator Active'}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 shrink-0 sticky top-0 z-10 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-500 hover:text-slate-800" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-6 w-6" />
            </button>
            <h2 className="font-semibold text-lg text-slate-800">
              Health 360 Physiotherapy Clinic
            </h2>
          </div>

          <div className="flex items-center gap-4">
            {/* Notification Bell */}
            <div className="relative">
              <button 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
                onClick={() => {
                  setShowBellBadge(false);
                  if (notifications.length === 0) {
                    toast.info("No new notifications.", { description: "Realtime updates are listening." });
                  } else {
                    toast.info("Latest events log", {
                      description: (
                        <div className="flex flex-col gap-1 mt-1 font-mono text-xs">
                          {notifications.map((n, idx) => (
                            <div key={idx} className="border-b border-slate-100 pb-1">
                              • {n}
                            </div>
                          ))}
                        </div>
                      )
                    });
                  }
                }}
              >
                <Bell className="h-5 w-5" />
                {showBellBadge && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-sage-500 ring-2 ring-white animate-bounce" />
                )}
              </button>
            </div>

            {/* Profile Avatar / Placeholder */}
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                Dr
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-none">Dr. Kekre</p>
                <p className="text-[10px] text-slate-400 font-medium">Lead Physiotherapist</p>
              </div>
              <button
                title="Logout"
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all ml-1 cursor-pointer"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Content Wrapper */}
        <main className="flex-grow p-6">
          {children}
        </main>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
