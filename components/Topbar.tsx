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
    isSuperviseur && pathname === '/'
      ? 'Supervision'
      : PAGE_TITLES[pathname] ?? 'CaissePro';

  const nonPayeCount = drivers.filter((d) => d.statut === 'NON PAYE').length;
  const totalEncaisse = transactions.reduce((sum, t) => sum + t.tPayer, 0);

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
    <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-5 lg:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenMenu}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 lg:hidden"
            aria-label="Menu"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{title}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/journal"
            className="hidden h-8 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs hover:bg-slate-100 md:inline-flex"
          >
            <span className="text-[11px] font-medium text-slate-500">
              {isSuperviseur ? 'Total' : 'Encaissé'}
            </span>
            <span className="font-mono font-bold tabular-nums text-slate-900">
              {formatMoney(totalEncaisse)} TND
            </span>
          </Link>

          <Link
            href={isSuperviseur ? '/' : '/chauffeurs'}
            className={`hidden h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold sm:inline-flex ${
              nonPayeCount > 0
                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {nonPayeCount > 0 ? (
              <>
                <IconAlert className="h-3.5 w-3.5 text-rose-600" />
                <span>{nonPayeCount} impayé{nonPayeCount > 1 ? 's' : ''}</span>
              </>
            ) : (
              <>
                <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>À jour</span>
              </>
            )}
          </Link>

          {!isSuperviseur && pathname !== '/caisse' && (
            <Link href="/caisse" className="btn-primary hidden !h-8 !px-3 !text-xs xl:inline-flex">
              <IconCalculator className="h-3.5 w-3.5" />
              Guichet
            </Link>
          )}

          {currentUser && (
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white py-1 pl-2.5 pr-1">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  isSyncing ? 'animate-pulse bg-sky-500' : 'bg-emerald-500'
                }`}
              />
              <span className="max-w-[90px] truncate text-xs font-semibold text-slate-800 sm:max-w-[140px]">
                {currentUser.displayName}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                title="Se déconnecter"
              >
                <IconLogout className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
