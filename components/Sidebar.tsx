'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NavLinks from './NavLinks';
import { useCaisseStore } from '@/lib/store';
import { IconCheck } from './Icons';

export default function Sidebar({ onOpenDbModal }: { onOpenDbModal?: () => void }) {
  const router = useRouter();
  const drivers = useCaisseStore((state) => state.drivers);
  const currentUser = useCaisseStore((state) => state.currentUser);
  const setCurrentUser = useCaisseStore((state) => state.setCurrentUser);
  const isSyncing = useCaisseStore((state) => state.isSyncing);
  const lastSyncTime = useCaisseStore((state) => state.lastSyncTime);

  const nonPayes = drivers.filter((d) => d.statut === 'NON PAYE').length;

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      router.push('/login');
    } catch (e) {
      router.push('/login');
    }
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[17rem] flex-col border-r border-slate-200 bg-slate-100/70 lg:flex">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-sm shadow-indigo-600/30">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight text-slate-900">Caisse Chauffeurs</p>
          <p className="truncate text-[11px] text-slate-500">Gestion & Recettes</p>
        </div>
      </div>

      {/* Navigation */}
      <NavLinks />

      {/* Account & Database Status Footer */}
      <div className="border-t border-slate-200 p-4 space-y-3 bg-white/50">
        {/* Active Account Pill */}
        {currentUser && (
          <div className="rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {currentUser.displayName}
                </p>
                <p className="text-[10px] text-slate-400 font-mono truncate">
                  @{currentUser.username} · {currentUser.customDbUrl ? 'DB Dédiée' : 'Neon Partition'}
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenDbModal}
                className="btn-icon !h-6 !w-6 text-slate-400 hover:text-indigo-600"
                title="Paramètres de base de données"
              >
                ⚙️
              </button>
            </div>

            {/* Sync status */}
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-100">
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'
                  }`}
                />
                {isSyncing ? 'Synchronisation...' : 'Synchronisé Neon'}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-rose-600 hover:underline font-semibold"
              >
                Déconnexion
              </button>
            </div>
          </div>
        )}

        {/* Counter Pills */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="font-semibold text-slate-600">Total Chauffeurs</span>
          <span className="rounded-full bg-white px-2 py-0.5 font-bold tabular-nums text-slate-700 shadow-sm border border-slate-200/60">
            {drivers.length}
          </span>
        </div>
        {nonPayes > 0 && (
          <div className="flex items-center justify-between text-[11px] text-rose-600 font-semibold px-1">
            <span>Non Réglés (En alerte)</span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-bold tabular-nums text-rose-700 ring-1 ring-rose-200">
              {nonPayes}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
