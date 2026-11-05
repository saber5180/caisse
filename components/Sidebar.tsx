'use client';

import { useRouter } from 'next/navigation';
import NavLinks from './NavLinks';
import { useCaisseStore } from '@/lib/store';
import { IconCoins, IconDatabase, IconLogout } from './Icons';

export default function Sidebar({ onOpenDbModal }: { onOpenDbModal?: () => void }) {
  const router = useRouter();
  const drivers = useCaisseStore((state) => state.drivers);
  const currentUser = useCaisseStore((state) => state.currentUser);
  const setCurrentUser = useCaisseStore((state) => state.setCurrentUser);
  const resetStoreForAccount = useCaisseStore((state) => state.resetStoreForAccount);
  const isSyncing = useCaisseStore((state) => state.isSyncing);
  const lastSyncTime = useCaisseStore((state) => state.lastSyncTime);

  const nonPayes = drivers.filter((d) => d.statut === 'NON PAYE').length;
  const payes = drivers.filter((d) => d.statut === 'PAYE').length;
  const activePool = nonPayes + payes;
  const settledRate = activePool > 0 ? Math.round((payes / activePool) * 100) : drivers.length > 0 ? 100 : 0;

  const initials = (currentUser?.displayName || 'CP')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      resetStoreForAccount();
      setCurrentUser(null);
      router.push('/login');
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17.5rem] flex-col border-r border-slate-800/80 bg-obsidian-mesh text-white lg:flex">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] ring-1 ring-white/20">
            <IconCoins className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-sm font-extrabold tracking-tight text-white">
                CaissePro
              </p>
              <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-indigo-300 ring-1 ring-indigo-400/30">
                PRO
              </span>
            </div>
            <p className="truncate text-[11px] font-medium text-slate-400">
              Trésorerie & Flotte
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <NavLinks />

      {/* Live Fleet Settlement Meter & Account Pod */}
      <div className="space-y-3 border-t border-white/[0.08] bg-slate-950/50 p-4">
        {/* Mini Fleet Progress Widget */}
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-slate-400">Taux d&apos;encaissement</span>
            <span className="font-mono font-bold text-emerald-400">{settledRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400 transition-all duration-500"
              style={{ width: `${settledRate}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-slate-400">
            <span>
              Flotte : <strong className="font-mono text-white">{drivers.length}</strong>
            </span>
            {nonPayes > 0 ? (
              <span className="font-semibold text-rose-400">
                {nonPayes} impayé{nonPayes > 1 ? 's' : ''}
              </span>
            ) : (
              <span className="font-semibold text-emerald-400">0 impayé</span>
            )}
          </div>
        </div>

        {/* Active Account Pod */}
        {currentUser && (
          <div className="rounded-xl border border-white/[0.09] bg-white/[0.04] p-3 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-extrabold text-white ring-1 ring-white/20">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {currentUser.displayName}
                </p>
                <p className="truncate font-mono text-[10px] text-slate-400">
                  @{currentUser.username} · {currentUser.customDbUrl ? 'DB Dédiée' : 'Neon Cloud'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenDbModal}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:border-indigo-400/40 hover:bg-indigo-500/20 hover:text-white"
                title="Configuration Base de Données"
              >
                <IconDatabase className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.07] pt-2 text-[10px]">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isSyncing
                      ? 'animate-pulse bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                      : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                  }`}
                />
                {isSyncing ? 'Sync en cours...' : lastSyncTime ? `Sync ${lastSyncTime}` : 'Connecté Neon'}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 font-semibold text-rose-400 transition-colors hover:text-rose-300"
              >
                <IconLogout className="h-3 w-3" />
                Quitter
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
