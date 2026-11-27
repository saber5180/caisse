'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaisseStore } from '@/lib/store';
import {
  IconAlert,
  IconArrowRight,
  IconCoins,
  IconDatabase,
  IconPrinter,
  IconShield,
  IconTruck,
  IconUser,
} from '@/components/Icons';

export default function LoginPage() {
  const router = useRouter();
  const setCurrentUser = useCaisseStore((state) => state.setCurrentUser);
  const resetStoreForAccount = useCaisseStore((state) => state.resetStoreForAccount);
  const fetchAccountData = useCaisseStore((state) => state.fetchAccountData);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const reason = params.get('reason');
      if (reason === 'blocked') {
        setError('Votre compte a été suspendu. Veuillez contacter l’administrateur.');
      } else if (reason === 'force_logout') {
        setError('Votre session a été fermée par l’administrateur.');
      }
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Identifiants incorrects');
      }

      resetStoreForAccount();
      setCurrentUser(data.user);
      await fetchAccountData();
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Impossible d’ouvrir la session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-[#F4F6F9]">
      {/* Volet gauche : Présentation claire & professionnelle */}
      <div className="hidden lg:flex lg:w-[46%] flex-col justify-between bg-slate-900 p-10 xl:p-14 text-white border-r border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <IconCoins className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-extrabold tracking-tight text-white">
                CaissePro
              </span>
              <p className="text-[11px] font-medium text-slate-400">
                Gestion de caisse &amp; flotte
              </p>
            </div>
          </div>
          <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-1 font-mono text-[11px] font-semibold text-slate-300">
            CRNU · CRSF · CRTN
          </span>
        </div>

        <div className="my-auto max-w-md py-8">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white xl:text-4xl">
            Suivi des encaissements chauffeurs et arrêtés de caisse.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Connectez-vous à votre espace caissier ou superviseur pour gérer les reçus, le programme journalier et les clôtures.
          </p>

          <div className="mt-8 space-y-3">
            <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-500/15 text-sky-400">
                <IconDatabase className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Comptes de caisse séparés</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Chaque guichet (CRNU, CRSF, CRTN) conserve ses propres cumuls, séries et mouvements.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                <IconTruck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Programme 12:30 &amp; impayés</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Suivi clair des tournées par journée et pointage rapide par code TR.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-3.5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-700/60 text-slate-200">
                <IconPrinter className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Billetterie &amp; états A4</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Comptage des billets et pièces, calcul des écarts et impression des reçus et PV.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-500">
          <span>CaissePro · Portail Opérateur</span>
          <span className="font-mono text-[11px] text-slate-400">PostgreSQL Sync</span>
        </div>
      </div>

      {/* Volet droit : Formulaire de connexion */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          {/* En-tête mobile */}
          <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              <IconCoins className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">
                CaissePro
              </h1>
              <p className="text-[11px] font-medium text-slate-500">
                CRNU · CRSF · CRTN
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                Connexion
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Saisissez votre identifiant et votre mot de passe pour accéder à votre session.
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Identifiant</label>
                <div className="relative">
                  <IconUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Ex. crnu, crsf, superviseur..."
                    className="input !h-11 !pl-10 font-semibold"
                  />
                </div>
              </div>
              <div>
                <label className="label">Mot de passe</label>
                <div className="relative">
                  <IconShield className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input !h-11 !pl-10"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-2 !h-11 w-full text-sm font-bold"
              >
                <span>{loading ? 'Connexion en cours…' : 'Se connecter'}</span>
                {!loading && <IconArrowRight className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
