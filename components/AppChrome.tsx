'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import NavLinks from './NavLinks';
import { IconClose, IconCheck, IconAlert } from './Icons';
import { useCaisseStore } from '@/lib/store';

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [menuOpen, setMenuOpen] = useState(false);
  const [showDbModal, setShowDbModal] = useState(false);
  const [customDbUrlInput, setCustomDbUrlInput] = useState('');
  const [dbModalLoading, setDbModalLoading] = useState(false);
  const [dbModalMsg, setDbModalMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const totalDrivers = useCaisseStore((state) => state.drivers.length);
  const feedback = useCaisseStore((state) => state.feedbackMessage);
  const clearFeedback = useCaisseStore((state) => state.clearFeedback);
  const refreshAlarms = useCaisseStore((state) => state.refreshAlarms);

  const currentUser = useCaisseStore((state) => state.currentUser);
  const setCurrentUser = useCaisseStore((state) => state.setCurrentUser);
  const fetchAccountData = useCaisseStore((state) => state.fetchAccountData);

  // Authenticate on initial mount
  useEffect(() => {
    let isMounted = true;
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          if (pathname !== '/login') {
            router.push('/login');
          }
          return;
        }
        const data = await res.json();
        if (data.authenticated && data.user) {
          if (isMounted) {
            setCurrentUser(data.user);
            setCustomDbUrlInput(data.user.customDbUrl || '');
            fetchAccountData();
          }
        } else if (pathname !== '/login') {
          router.push('/login');
        }
      } catch {
        if (pathname !== '/login') {
          router.push('/login');
        }
      }
    }

    checkAuth();
    return () => {
      isMounted = false;
    };
  }, [pathname, router, setCurrentUser, fetchAccountData]);

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

  // Auto dismiss feedback after 5 seconds
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => {
        clearFeedback();
      }, 5000);
      return () => clearTimeout(t);
    }
  }, [feedback, clearFeedback]);

  // If on login page, render full screen without chrome
  if (pathname === '/login') {
    return <>{children}</>;
  }

  const handleSaveDbUrl = async (testOnly = false) => {
    setDbModalLoading(true);
    setDbModalMsg(null);
    try {
      const res = await fetch('/api/account/db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customDbUrl: customDbUrlInput, testOnly }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur base de données');
      }

      setDbModalMsg({
        type: 'success',
        text: data.message || 'Configuration enregistrée avec succès !',
      });

      if (!testOnly) {
        if (currentUser) {
          setCurrentUser({ ...currentUser, customDbUrl: data.customDbUrl });
        }
        await fetchAccountData();
        setTimeout(() => setShowDbModal(false), 1200);
      }
    } catch (e: any) {
      setDbModalMsg({ type: 'error', text: e.message || 'Erreur de connexion' });
    } finally {
      setDbModalLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      router.push('/login');
    } catch {
      router.push('/login');
    }
  };

  return (
    <>
      <Sidebar onOpenDbModal={() => setShowDbModal(true)} />

      {/* Mobile Drawer */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[min(20rem,86vw)] flex-col bg-slate-50 shadow-card-lg">
            <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4">
              <div>
                <p className="text-sm font-bold text-slate-900">Caisse Chauffeurs</p>
                <p className="text-[11px] text-slate-500">Gestion & Recettes</p>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="btn-icon h-10 w-10"
                aria-label="Fermer"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Account Summary */}
            {currentUser && (
              <div className="border-b border-slate-200 bg-white p-3.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {currentUser.displayName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      @{currentUser.username}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setShowDbModal(true);
                    }}
                    className="rounded-lg border border-slate-200 p-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    ⚙️ BD
                  </button>
                </div>
              </div>
            )}

            <NavLinks onNavigate={() => setMenuOpen(false)} />

            <div className="mt-auto border-t border-slate-200 p-4 space-y-3 bg-white/60">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-semibold text-slate-600">Total Chauffeurs</span>
                <span className="rounded-full bg-white px-2 py-0.5 font-bold tabular-nums text-slate-700 shadow-sm border border-slate-200">
                  {totalDrivers}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-xl border border-rose-200 bg-rose-50 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Se Déconnecter
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="lg:pl-[17rem]">
        <Topbar
          onOpenMenu={() => setMenuOpen(true)}
          onOpenDbModal={() => setShowDbModal(true)}
        />

        {/* Global Toast Feedback */}
        {feedback && (
          <div className="mx-auto max-w-[1400px] px-3 pt-3 sm:px-5 sm:pt-4 lg:px-8">
            <div
              className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 text-sm shadow-sm transition-all sm:p-4 ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : feedback.type === 'error'
                  ? 'border-rose-200 bg-rose-50 text-rose-800'
                  : 'border-indigo-200 bg-indigo-50 text-indigo-800'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {feedback.type === 'success' ? (
                  <IconCheck className="h-5 w-5 shrink-0 text-emerald-600" />
                ) : (
                  <IconAlert className="h-5 w-5 shrink-0 text-rose-600" />
                )}
                <span className="font-medium text-xs sm:text-sm truncate sm:whitespace-normal">
                  {feedback.text}
                </span>
              </div>
              <button onClick={clearFeedback} className="btn-icon !h-7 !w-7 shrink-0">
                <IconClose className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1400px] px-3 py-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-5 sm:py-6 lg:px-8 lg:py-8">
          <div className="animate-fade-in-up">{children}</div>
        </main>
      </div>

      {/* Account & Database Isolation Modal */}
      {showDbModal && currentUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowDbModal(false)}
          />
          <div className="relative w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  ⚙️ Paramètres de Base de Données
                </h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Compte : <strong>{currentUser.displayName}</strong> (@{currentUser.username})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowDbModal(false)}
                className="btn-icon"
              >
                <IconClose className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4">
                <p className="text-xs font-bold text-indigo-950">
                  Mode d&apos;isolation actuel :
                </p>
                <p className="mt-1 text-xs text-indigo-800 leading-relaxed">
                  {currentUser.customDbUrl ? (
                    <span className="font-semibold text-emerald-700">
                      🟢 Base de données Neon / PostgreSQL dédiée personnalisée
                    </span>
                  ) : (
                    <span className="font-semibold text-indigo-700">
                      🛡️ Partition Neon PostgreSQL isolée étanche (ID Compte: {currentUser.id})
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Vos chauffeurs, encaissements et billetterie sont strictement isolés des autres comptes.
                </p>
              </div>

              <div>
                <label className="label">
                  Base de données dédiée propre (URL PostgreSQL / Neon)
                </label>
                <input
                  type="text"
                  value={customDbUrlInput}
                  onChange={(e) => setCustomDbUrlInput(e.target.value)}
                  placeholder="postgresql://user:pass@ep-custom.neon.tech/neondb"
                  className="input font-mono !text-xs"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Laissez vide pour utiliser la partition isolée Neon par défaut. Entrez une URL Neon ou Postgres pour héberger vos données sur un serveur ou une branche indépendante.
                </p>
              </div>

              {dbModalMsg && (
                <div
                  className={`rounded-xl border p-3 text-xs ${
                    dbModalMsg.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {dbModalMsg.text}
                </div>
              )}

              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={dbModalLoading}
                  onClick={() => handleSaveDbUrl(true)}
                  className="btn-ghost !text-xs !py-2"
                >
                  Tester la Connexion
                </button>
                <button
                  type="button"
                  disabled={dbModalLoading}
                  onClick={() => handleSaveDbUrl(false)}
                  className="btn-primary !text-xs !py-2"
                >
                  {dbModalLoading ? 'Enregistrement...' : 'Enregistrer les Modifications'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
