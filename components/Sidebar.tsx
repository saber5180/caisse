'use client';

import { useRouter } from 'next/navigation';
import NavLinks from './NavLinks';
import { useCaisseStore } from '@/lib/store';
import { IconCoins, IconLogout } from './Icons';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
        <IconCoins className="h-4 w-4" />
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-white">CaissePro</p>
          <p className="truncate text-[11px] text-slate-400">CRNU · CRSF · CRTN</p>
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
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[15.5rem] flex-col border-r border-slate-800 bg-slate-900 text-white lg:flex">
      <div className="flex h-14 items-center border-b border-slate-800 px-4">
        <BrandMark />
      </div>

      <NavLinks />

      <div className="space-y-2.5 border-t border-slate-800 p-3">
        <div className="rounded-lg bg-slate-800/80 p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-medium text-slate-400">Encaissement</span>
            <span className="font-mono font-bold text-emerald-400">{settledRate}%</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${settledRate}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>
              Flotte : <strong className="font-mono text-white">{drivers.length}</strong>
            </span>
            <span className={nonPayes > 0 ? 'font-semibold text-rose-400' : 'text-emerald-400'}>
              {nonPayes} impayé{nonPayes > 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-800/80 p-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-600 text-xs font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{currentUser.displayName}</p>
              <p className="flex items-center gap-1.5 truncate text-[10.5px] text-slate-400">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    isSyncing ? 'animate-pulse bg-sky-400' : 'bg-emerald-400'
                  }`}
                />
                {isSyncing ? 'Sync…' : lastSyncTime ? `Sync ${lastSyncTime}` : 'En ligne'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Se déconnecter"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-700 hover:text-rose-400"
            >
              <IconLogout className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
