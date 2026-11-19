'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PAGE_TITLES } from '@/lib/nav';
import { formatMoney } from '@/lib/utils';
import {
  IconAlert,
  IconCalculator,
  IconCheck,
  IconLogout,
  IconMenu,
} from './Icons';
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
    isSuperviseur && pathname === '/'
      ? 'Pilotage'
      : PAGE_TITLES[pathname] ?? 'CaissePro';

  const nonPayeCount = drivers.filter((d) => d.statut === 'NON PAYE').length;
  const totalEncaisse = transactions.reduce((sum, t) => sum + t.tPayer, 0);

  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 pt-[env(safe-area-inset-top)] sm:px-5 lg:px-6">
      {/* Left: Hamburger & Breadcrumb Title */}
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <IconMenu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <p className="truncate text-[11px] text-slate-400">CaissePro</p>
          <h1 className="truncate text-sm font-semibold leading-5 text-slate-900">
            {title}
          </h1>
        </div>
      </div>

      {/* Right: Live Financial Status Strip & Account */}
      <div className="flex items-center gap-2">
        {/* Live Treasury Pill */}
        <Link
          href="/journal"
          className="hidden h-8 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs hover:bg-white md:inline-flex"
          title="Total encaissé enregistré dans le journal"
        >
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            {isSuperviseur ? 'Global Caisses' : 'Encaissé'}
          </span>
          <span className="font-mono text-xs font-extrabold text-slate-900 tabular-nums">
            {formatMoney(totalEncaisse)} <span className="text-[10px] font-semibold text-slate-400">TND</span>
          </span>
        </Link>

        {/* Unpaid Alerts Pill */}
        <Link
          href={isSuperviseur ? '/' : '/chauffeurs'}
          className={`hidden h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium sm:inline-flex ${
            nonPayeCount > 0
              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
          }`}
        >
          {nonPayeCount > 0 ? (
            <>
              <IconAlert className="h-3.5 w-3.5 text-rose-500" />
              <span>{nonPayeCount} impayé{nonPayeCount > 1 ? 's' : ''}</span>
            </>
          ) : (
            <>
              <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Flotte à jour</span>
            </>
          )}
        </Link>

        {/* Date pill (XL Desktop) */}
        <span className="hidden items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-semibold capitalize text-slate-500 2xl:inline-flex">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          {today}
        </span>

        {/* Quick Guichet Button if not on /caisse and NOT superviseur */}
        {!isSuperviseur && pathname !== '/caisse' && (
          <Link
            href="/caisse"
            className="btn-primary hidden !px-3 !py-1.5 !text-xs xl:inline-flex"
          >
            <IconCalculator className="h-3.5 w-3.5" />
            Guichet
          </Link>
        )}

        {currentUser && (
          <div className="flex items-center gap-1.5">
            <span
              className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-800"
              title={currentUser.displayName}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isSyncing ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'
                }`}
              />
              <span className="max-w-[110px] truncate sm:max-w-[150px]">
                {currentUser.displayName}
              </span>
            </span>

            <button
              type="button"
              onClick={handleLogout}
              className="hidden h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-800 sm:inline-flex"
              title="Se déconnecter"
            >
              <IconLogout className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
