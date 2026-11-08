'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaisseStore } from '@/lib/store';
import {
  IconAlert,
  IconArrowRight,
  IconBuilding,
  IconCoins,
  IconDatabase,
  IconPrinter,
  IconShield,
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
        setError(
          'Votre caisse a été temporairement bloquée à distance par le Superviseur. Veuillez contacter la supervision.'
        );
      } else if (reason === 'force_logout') {
        setError(
          'Votre session a été déconnectée à distance par le Superviseur.'
        );
      }
    }
  }, []);

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setError(null);
    setLoading(true);

    const u = customUser !== undefined ? customUser : username;
    const p = customPass !== undefined ? customPass : password;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: u, password: p }),
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
      setError(err.message || 'Erreur lors de la connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#090D16] text-white">
      {/* Left Enterprise Showcase Panel (Desktop) */}
      <div className="bg-obsidian-mesh bg-grid-pattern relative hidden w-1/2 flex-col justify-between border-r border-white/10 p-12 lg:flex xl:p-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_0_24px_rgba(99,102,241,0.5)] ring-1 ring-white/20">
            <IconCoins className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight text-white">CaissePro</span>
              <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-indigo-300 ring-1 ring-indigo-400/30">
                Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400">Pilotage Centralisé CRNU · CRSF · CRTN</p>
          </div>
        </div>

        {/* Center Hero Value Prop */}
        <div className="my-auto max-w-lg py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3.5 py-1 text-xs font-bold text-indigo-300">
            <IconShield className="h-3.5 w-3.5" />
            5 Comptes Officiels Synchronisés en Temps Réel
          </div>

          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-white xl:text-4xl">
            Supervision en direct & liaison automatique des caisses.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Synchronisation instantanée entre le Programme Chauffeur, le Mouvement Chauffeur et les 3 caisses régionales (<strong>CRNU</strong>, <strong>CRSF</strong>, <strong>CRTN</strong>) sous le contrôle en temps réel du profil <strong>Superviseur</strong> et <strong>Admin</strong>.
          </p>

          {/* Feature Pillars */}
          <div className="mt-8 space-y-3.5">
            <div className="flex items-start gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
                <IconDatabase className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-white">
                  Liaison Automatique Inter-Modules
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Dès qu&apos;un chauffeur règle sa recette dans l&apos;une des caisses (CRNU, CRSF ou CRTN), son statut bascule instantanément sur « Chauffeur Payé » sur tous les écrans.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                <IconPrinter className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-white">
                  Supervision & Contrôle à Distance
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Suivi en direct du MT Espèce et des Versements par caisse, journal consolidé, archives de clôture et blocage / déconnexion à distance.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>CaissePro Financial Suite · 5 Comptes Officiels</span>
          <span className="font-mono">CRNU · CRSF · CRTN</span>
        </div>
      </div>

      {/* Right Authentication Panel */}
      <div className="flex flex-1 items-center justify-center bg-[#F3F5FA] px-4 py-10 text-slate-900 sm:px-8">
        <div className="w-full max-w-md">
          {/* Mobile Brand Header */}
          <div className="mb-7 text-center lg:hidden">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg">
              <IconCoins className="h-6 w-6" />
            </div>
            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
              CaissePro
            </h1>
            <p className="text-xs text-slate-500">
              Supervision & Trésorerie · CRNU · CRSF · CRTN
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-pro-lg sm:p-8">
            <div className="mb-5">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 ring-1 ring-indigo-200/60">
                <IconShield className="h-3 w-3" />
                Accès Restreint · 5 Comptes Officiels
              </div>
              <h2 className="mt-2.5 text-xl font-extrabold tracking-tight text-slate-900">
                Connexion au Système
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                Sélectionnez votre profil officiel ou saisissez vos identifiants.
              </p>
            </div>

            {/* Alerts */}
            {error && (
              <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
              <div>
                <label className="label">Identifiant Officiel</label>
                <div className="relative">
                  <IconUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="superviseur, admin, crnu, crsf ou crtn"
                    className="input !pl-10"
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
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input !pl-10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary mt-2 w-full !py-3 !text-sm"
              >
                <span>{loading ? 'Authentification...' : 'Se Connecter'}</span>
                {!loading && <IconArrowRight className="h-4 w-4" />}
              </button>

              {/* 5 Official Accounts Selector */}
              <div className="border-t border-slate-100 pt-5">
                <p className="mb-3 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                  Les 5 Comptes Officiels Configurés
                </p>

                {/* Row 1: Superviseur & Admin */}
                <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleLogin(undefined, 'superviseur', 'sup123')}
                    className="flex flex-col items-start rounded-2xl border border-violet-200 bg-violet-50/60 p-3 text-left transition-all hover:border-violet-400 hover:bg-violet-50"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="rounded-md bg-violet-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                        Superviseur
                      </span>
                      <IconShield className="h-4 w-4 text-violet-600" />
                    </div>
                    <span className="mt-1.5 text-xs font-extrabold text-slate-900">
                      Compte Superviseur
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      Consultation & Contrôle
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleLogin(undefined, 'admin', 'admin123')}
                    className="flex flex-col items-start rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 text-left transition-all hover:border-indigo-400 hover:bg-indigo-50"
                  >
                    <div className="flex w-full items-center justify-between">
                      <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">
                        Admin
                      </span>
                      <IconUser className="h-4 w-4 text-indigo-600" />
                    </div>
                    <span className="mt-1.5 text-xs font-extrabold text-slate-900">
                      Compte Admin
                    </span>
                    <span className="text-[10px] font-medium text-slate-500">
                      Accès Complet Système
                    </span>
                  </button>
                </div>

                {/* Row 2: The 3 Normal Caisses CRNU, CRSF, CRTN */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { user: 'crnu', pass: 'crnu123', code: 'CRNU', sub: 'Caisse Normale' },
                    { user: 'crsf', pass: 'crsf123', code: 'CRSF', sub: 'Caisse Normale' },
                    { user: 'crtn', pass: 'crtn123', code: 'CRTN', sub: 'Caisse Normale' },
                  ].map((acc) => (
                    <button
                      key={acc.user}
                      type="button"
                      disabled={loading}
                      onClick={() => handleLogin(undefined, acc.user, acc.pass)}
                      className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center transition-all hover:border-emerald-400 hover:bg-emerald-50/50"
                    >
                      <IconBuilding className="h-4 w-4 text-emerald-600" />
                      <span className="mt-1 font-mono text-xs font-black text-slate-900">
                        {acc.code}
                      </span>
                      <span className="text-[10px] text-slate-400">{acc.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
