'use client';

import { usePathname, useRouter } from 'next/navigation';
import { PAGE_TITLES } from '@/lib/nav';
import { IconMenu } from './Icons';
import { useCaisseStore } from '@/lib/store';

export default function Topbar({
  onOpenMenu,
  onOpenDbModal,
}: {
  onOpenMenu: () => void;
  onOpenDbModal?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const title = PAGE_TITLES[pathname] ?? 'Caisse Chauffeurs';
  const currentUser = useCaisseStore((state) => state.currentUser);
  const setCurrentUser = useCaisseStore((state) => state.setCurrentUser);
  const resetStoreForAccount = useCaisseStore((state) => state.resetStoreForAccount);
  const isSyncing = useCaisseStore((state) => state.isSyncing);

  const today = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
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
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:h-16 sm:px-5 lg:px-8">
      {/* Left: Hamburger & Dynamic Title */}
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Ouvrir le menu"
        >
          <IconMenu className="h-5 w-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <span className="hidden sm:inline">Caisse</span>
            <span className="hidden sm:inline">/</span>
            <h1 className="truncate text-sm font-bold text-slate-900 sm:text-base">{title}</h1>
          </div>
        </div>
      </div>

      {/* Right: Account & Status */}
      <div className="flex items-center gap-2">
        {/* Date pill (Desktop) */}
        <span className="hidden items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200 xl:inline-flex capitalize">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {today}
        </span>

        {/* Sync indicator */}
        {isSyncing && (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="hidden sm:inline">Sync DB...</span>
          </span>
        )}

        {/* Current user badge & actions */}
        {currentUser && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenDbModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              title="Paramètres de la base de données"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="max-w-[120px] truncate sm:max-w-[180px]">
                {currentUser.displayName}
              </span>
              <span className="text-[10px] text-slate-400">⚙️</span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
              title="Se déconnecter"
            >
              Quitter
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
