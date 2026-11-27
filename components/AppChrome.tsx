'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar, { BrandMark } from './Sidebar';
import Topbar from './Topbar';
import NavLinks from './NavLinks';
import {
  IconAlert,
  IconCheck,
  IconClose,
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

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'superviseur') return;
    const restrictedPaths = ['/caisse', '/billetterie', '/chauffeurs', '/programme'];
    if (restrictedPaths.includes(pathname)) {
      router.replace('/');
    }
  }, [currentUser, pathname, router]);

  useEffect(() => {
    if (pathname === '/login' || !currentUser) return;
    const interval = setInterval(() => {
      void fetchAccountData();
    }, 4000);
    return () => clearInterval(interval);
  }, [pathname, currentUser, fetchAccountData]);

  useEffect(() => {
    const timer = setInterval(() => {
      refreshAlarms();
    }, 60000);
    return () => clearInterval(timer);
  }, [refreshAlarms]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => {
        clearFeedback();
      }, 4500);
      return () => clearTimeout(t);
    }
  }, [feedback, clearFeedback]);

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

      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-slate-950/60"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(17.5rem,85vw)] animate-slide-in-left flex-col border-r border-slate-800 bg-slate-900 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-800 px-4">
              <BrandMark />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Fermer"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {currentUser && (
              <div className="mx-3 mt-3 rounded-lg bg-slate-800/80 p-2.5">
                <p className="truncate text-xs font-bold text-white">{currentUser.displayName}</p>
                <p className="font-mono text-[11px] text-slate-400">@{currentUser.username}</p>
              </div>
            )}

            <NavLinks onNavigate={() => setMenuOpen(false)} />

            <div className="mt-auto space-y-2.5 border-t border-slate-800 p-3">
              <div className="flex items-center justify-between rounded-lg bg-slate-800/80 px-3 py-2 text-xs text-slate-400">
                <span>Chauffeurs</span>
                <span className="font-mono font-bold text-white">{totalDrivers}</span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/15 text-xs font-semibold text-rose-300 hover:bg-rose-500/25"
              >
                <IconLogout className="h-4 w-4" />
                Se déconnecter
              </button>
            </div>
          </aside>
        </div>
      )}

      <div id="app-chrome-content" className="min-h-screen lg:pl-[15.5rem]">
        <Topbar onOpenMenu={() => setMenuOpen(true)} />

        {feedback && (
          <div className="no-print mx-auto max-w-[1600px] px-3 pt-3 sm:px-5 lg:px-6">
            <div
              className={`animate-fade-in-up flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs sm:text-sm shadow-sm ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : feedback.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-900'
                  : 'border-sky-200 bg-sky-50 text-sky-900'
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-white ${
                    feedback.type === 'success'
                      ? 'bg-emerald-600'
                      : feedback.type === 'error'
                      ? 'bg-rose-600'
                      : 'bg-sky-600'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <IconCheck className="h-3.5 w-3.5" />
                  ) : (
                    <IconAlert className="h-3.5 w-3.5" />
                  )}
                </span>
                <span className="font-medium">{feedback.text}</span>
              </div>
              <button onClick={clearFeedback} className="btn-icon !h-7 !w-7 shrink-0">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1600px] px-3 py-4 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-5 lg:px-6">
          {children}
        </main>
      </div>
    </>
  );
}
