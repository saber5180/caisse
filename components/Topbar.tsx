'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PAGE_TITLES } from '@/lib/nav';
import { formatMoney } from '@/lib/utils';
import { IconAlert, IconCalculator, IconCheck, IconLogout, IconMenu } from './Icons';
import { useCaisseStore } from '@/lib/store';

export default function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const currentUser = useCaisseStore((state) => state.currentUser);
  const setCurrentUser = useCaisseStore((state) => state.setCurrentUser);
  const resetStoreForAccount = useCaisseStore((state) => state.resetStoreForAccount);
  const isSyncing = useCaisseStore((state) => state.isSyncing);
  const drivers = useCaisseStore((state) => state.drivers);
  const transactions = useCaisseStore((state) => state.transactions);

  const isSuperviseur = currentUser?.role === 'superviseur';
  const title =
    isSuperviseur && pathname === '/' ? 'Pilotage' : PAGE_TITLES[pathname] ?? 'CaissePro';

  const nonPayeCount = drivers.filter((d) => d.statut === 'NON PAYE').length;
  const totalEncaisse = transactions.reduce((sum, t) => sum + t.tPayer, 0);

  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

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
    <header className="no-print sticky top-0 z-20 border-b border-slate-200/70 bg-white/75 pt-[env(safe-area-inset-top)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex h-16 max-w-[1480px] items-center justify-between gap-3 px-3 sm:px-5 lg:px-8">
        {/* Gauche */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMenu}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="hidden truncate text-[11px] font-medium capitalize text-slate-400 sm:block">
              {today}
            </p>
            <h1 className="truncate font-display text-[15px] font-bold leading-5 text-slate-900 sm:text-base">
              {title}
            </h1>
          </div>
        </div>

        {/* Droite */}
        <div className="flex items-center gap-2">
          <Link
            href="/journal"
            className="hidden h-10 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 shadow-sm transition hover:border-slate-300 md:inline-flex"
            title="Total encaissé enregistré dans le journal"
          >
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
              {isSuperviseur ? 'Global' : 'Encaissé'}
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
              {formatMoney(totalEncaisse)}
              <span className="ml-1 text-[10px] font-semibold text-slate-400">TND</span>
            </span>
          </Link>

          <Link
            href={isSuperviseur ? '/' : '/chauffeurs'}
            className={`hidden h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-semibold shadow-sm transition sm:inline-flex ${
              nonPayeCount > 0
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {nonPayeCount > 0 ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-rose-500" />
                </span>
                {nonPayeCount} impayé{nonPayeCount > 1 ? 's' : ''}
              </>
            ) : (
              <>
                <IconCheck className="h-3.5 w-3.5" />
                Flotte à jour
              </>
            )}
          </Link>

          {!isSuperviseur && pathname !== '/caisse' && (
            <Link href="/caisse" className="btn-primary hidden xl:inline-flex">
              <IconCalculator className="h-4 w-4" />
              Guichet
            </Link>
          )}

          {currentUser && (
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 pl-2.5 shadow-sm">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isSyncing ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'
                }`}
              />
              <span
                className="max-w-[96px] truncate text-xs font-semibold text-slate-800 sm:max-w-[150px]"
                title={currentUser.displayName}
              >
                {currentUser.displayName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                title="Se déconnecter"
              >
                <IconLogout className="h-4 w-4" />
              </button>
            </div>
          )}
          {nonPayeCount > 0 && (
            <Link
              href={isSuperviseur ? '/' : '/chauffeurs'}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 sm:hidden"
              aria-label={`${nonPayeCount} impayés`}
            >
              <IconAlert className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
