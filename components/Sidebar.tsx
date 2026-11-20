'use client';

import { useRouter } from 'next/navigation';
import NavLinks from './NavLinks';
import { useCaisseStore } from '@/lib/store';
import { IconCoins, IconLogout } from './Icons';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 via-indigo-600 to-violet-700 text-white shadow-[0_8px_24px_-6px_rgba(99,102,241,0.7)] ring-1 ring-white/20">
        <IconCoins className="h-5 w-5" />
        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-ink-900" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate font-display text-[15px] font-extrabold tracking-tight text-white">
            Caisse<span className="text-gradient-brand">Pro</span>
          </p>
          <p className="truncate text-[11px] font-medium text-slate-400">Trésorerie &amp; Flotte</p>
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
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
  const settledRate =
    activePool > 0 ? Math.round((payes / activePool) * 100) : drivers.length > 0 ? 100 : 0;

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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-white/[0.06] bg-obsidian-mesh text-white lg:flex">
      <div className="flex h-16 items-center px-5">
        <BrandMark />
      </div>

      <NavLinks />

      <div className="space-y-3 p-3">
        {/* Jauge d'encaissement */}
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.04] p-3.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold uppercase tracking-wider text-slate-400">Encaissement</span>
            <span className="font-mono text-sm font-bold text-emerald-400">{settledRate}%</span>
          </div>
          <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-all duration-700"
              style={{ width: `${settledRate}%` }}
            />
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Flotte <strong className="font-mono text-white">{drivers.length}</strong>
            </span>
            <span className={`font-semibold ${nonPayes > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {nonPayes} impayé{nonPayes > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* Compte actif */}
        {currentUser && (
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-extrabold text-white ring-1 ring-white/20">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-white">{currentUser.displayName}</p>
              <p className="flex items-center gap-1.5 truncate text-[10.5px] text-slate-400">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isSyncing ? 'animate-pulse bg-amber-400' : 'bg-emerald-400'
                  }`}
                />
                {isSyncing ? 'Synchronisation…' : lastSyncTime ? `Sync ${lastSyncTime}` : 'Connecté'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Se déconnecter"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <IconLogout className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
