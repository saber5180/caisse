'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NavLinks from './NavLinks';
import {
  IconAlert,
  IconCheck,
  IconClose,
  IconCoins,
  IconLogout,
} from './Icons';
import { useCaisseStore } from '@/lib/store';

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);

  const totalDrivers = useCaisseStore((state) => state.drivers.length);
  const feedback = useCaisseStore((state) => state.feedbackMessage);
  const clearFeedback = useCaisseStore((state) => state.clearFeedback);
  const refreshAlarms = useCaisseStore((state) => state.refreshAlarms);

  const currentUser = useCaisseStore((state) => state.currentUser);
  const setCurrentUser = useCaisseStore((state) => state.setCurrentUser);
  const resetStoreForAccount = useCaisseStore((state) => state.resetStoreForAccount);
  const fetchAccountData = useCaisseStore((state) => state.fetchAccountData);

  const authCheckedForUserRef = useRef<string | null>(null);

  // Authenticate once per session so navigating between pages never overwrites in-memory mutations
  useEffect(() => {
    if (pathname === '/login') {
      authCheckedForUserRef.current = null;
      return;
    }

    if (currentUser && authCheckedForUserRef.current === currentUser.id) {
      return;
    }

    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (data.reason === 'blocked' || data.reason === 'force_logout') {
            router.push(`/login?reason=${data.reason}`);
          } else {
            router.push('/login');
          }
          return;
        }
        if (data.authenticated && data.user) {
          if (isMounted) {
            const alreadyLoaded =
              currentUser?.id === data.user.id &&
              authCheckedForUserRef.current === data.user.id;
            authCheckedForUserRef.current = data.user.id;
            setCurrentUser(data.user);
            if (!alreadyLoaded) {
              await fetchAccountData();
            }
          }
        } else {
          router.push('/login');
        }
      } catch {
        router.push('/login');
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [pathname, currentUser, router, setCurrentUser, fetchAccountData]);

  // Route guard for Superviseur restricted pages (Spécification 4)
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'superviseur') return;
    const restrictedPaths = ['/caisse', '/billetterie', '/chauffeurs', '/programme'];
    if (restrictedPaths.includes(pathname)) {
      router.replace('/');
    }
  }, [currentUser, pathname, router]);

  // Real-time synchronization polling (every 4 seconds) across all accounts and windows
  useEffect(() => {
    if (pathname === '/login' || !currentUser) return;
    const interval = setInterval(() => {
      void fetchAccountData();
    }, 4000);
    return () => clearInterval(interval);
  }, [pathname, currentUser, fetchAccountData]);

  // Auto-refresh alarms every minute
  useEffect(() => {
    const timer = setInterval(() => {
      refreshAlarms();
    }, 60000);
    return () => clearInterval(timer);
  }, [refreshAlarms]);

  // Lock scroll on mobile menu
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  // Auto dismiss feedback after 4.5 seconds
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => {
        clearFeedback();
      }, 4500);
      return () => clearTimeout(t);
    }
  }, [feedback, clearFeedback]);

  // If on login page, render full screen without chrome
  if (pathname === '/login') {
    return <>{children}</>;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      authCheckedForUserRef.current = null;
      resetStoreForAccount();
      setCurrentUser(null);
      setMenuOpen(false);
      router.push('/login');
    }
  };

  return (
    <>
      <Sidebar />

      {/* Mobile Obsidian Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20.5rem,88vw)] flex-col border-r border-white/10 bg-obsidian-mesh text-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md">
                  <IconCoins className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">CaissePro</p>
                  <p className="text-[11px] text-slate-400">Trésorerie & Flotte</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                aria-label="Fermer"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {/* Mobile Account Summary */}
            {currentUser && (
              <div className="border-b border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">
                      {currentUser.displayName}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">
                      @{currentUser.username}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <NavLinks onNavigate={() => setMenuOpen(false)} />

            <div className="mt-auto space-y-3 border-t border-white/10 bg-slate-950/60 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold">Total Chauffeurs</span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-mono font-bold tabular-nums text-white">
                  {totalDrivers}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 py-2.5 text-xs font-bold text-rose-300 hover:bg-rose-500/25"
              >
                <IconLogout className="h-3.5 w-3.5" />
                Se Déconnecter
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div id="app-chrome-content" className="lg:pl-[17.5rem]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />

        {/* Global Floating Toast Feedback */}
        {feedback && (
          <div className="no-print mx-auto max-w-[1440px] px-3 pt-3 sm:px-5 sm:pt-4 lg:px-8">
            <div
              className={`animate-fade-in-up flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm shadow-pro transition-all ${
                feedback.type === 'success'
                  ? 'border-emerald-200/90 bg-emerald-50/95 text-emerald-900'
                  : feedback.type === 'error'
                  ? 'border-rose-200/90 bg-rose-50/95 text-rose-900'
                  : 'border-indigo-200/90 bg-indigo-50/95 text-indigo-900'
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    feedback.type === 'success'
                      ? 'bg-emerald-600 text-white'
                      : feedback.type === 'error'
                      ? 'bg-rose-600 text-white'
                      : 'bg-indigo-600 text-white'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    <IconAlert className="h-4 w-4" />
                  )}
                </span>
                <span className="truncate text-xs font-bold sm:whitespace-normal sm:text-sm">
                  {feedback.text}
                </span>
              </div>
              <button onClick={clearFeedback} className="btn-icon !h-7 !w-7 shrink-0">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1440px] px-3 py-5 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-8 lg:py-7">
          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>

    </>
  );
}
