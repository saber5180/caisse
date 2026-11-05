'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaisseStore } from '@/lib/store';
import {
  IconAlert,
  IconArrowRight,
  IconBuilding,
  IconCheck,
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

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [customDbUrl, setCustomDbUrl] = useState('');
  const [showDbUrl, setShowDbUrl] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          displayName,
          customDbUrl: customDbUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erreur lors de la création du compte');
      }

      setSuccess('Espace caisse initialisé avec succès ! Redirection...');
      resetStoreForAccount();
      setCurrentUser(data.user);
      await fetchAccountData();
      setTimeout(() => {
        router.push('/');
      }, 700);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
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
            <p className="text-xs text-slate-400">Système de Trésorerie & Flotte Multi-Caisses</p>
          </div>
        </div>

        {/* Center Hero Value Prop */}
        <div className="my-auto max-w-lg py-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/25 bg-indigo-500/10 px-3.5 py-1 text-xs font-bold text-indigo-300">
            <IconShield className="h-3.5 w-3.5" />
            Architecture Multi-Comptes Isolée sur PostgreSQL
          </div>

          <h1 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight text-white xl:text-4xl">
            Gérez vos encaissements chauffeurs avec une précision bancaire.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            Chaque agence ou caissier dispose de sa propre base de données étanche : flotte chauffeurs, terminal POS par coupure, comptage billetterie et édition de factures officielles Haute Définition.
          </p>

          {/* Feature Pillars */}
          <div className="mt-8 space-y-3.5">
            <div className="flex items-start gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-400/30">
                <IconDatabase className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-white">
                  Base de Données Propre par Compte
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Isolation complète des chauffeurs et transactions sur Neon PostgreSQL ou URL dédiée.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                <IconPrinter className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-white">
                  Facturation & Décharges Haute Définition
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Impression vectorielle nette au format A4 officiel signé ou Ticket Thermique 80mm.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>CaissePro Financial Suite</span>
          <span className="font-mono">PostgreSQL · SSL Chiffré</span>
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
              Trésorerie, Encaissement & Billetterie Multi-Comptes
            </p>
          </div>

          <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-pro-lg sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">
                {mode === 'login' ? 'Connexion à votre Caisse' : 'Créer un Espace Caisse'}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-500">
                {mode === 'login'
                  ? 'Accédez à votre environnement sécurisé et vos données dédiées.'
                  : 'Déployez une nouvelle caisse vierge avec sa propre base isolée.'}
              </p>
            </div>

            {/* Segmented Mode Switcher */}
            <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`rounded-lg py-2.5 transition-all ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Se Connecter
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`rounded-lg py-2.5 transition-all ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Créer un Compte
              </button>
            </div>

            {/* Alerts */}
            {error && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
                <IconAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{success}</span>
              </div>
            )}

            {mode === 'login' ? (
              <form onSubmit={(e) => handleLogin(e)} className="mt-5 space-y-4">
                <div>
                  <label className="label">Identifiant Caisse / Utilisateur</label>
                  <div className="relative">
                    <IconUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ex: admin, sfax, tunis..."
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
                  <span>{loading ? 'Authentification...' : 'Accéder à ma Caisse'}</span>
                  {!loading && <IconArrowRight className="h-4 w-4" />}
                </button>

                {/* Quick 1-Click Demo Workspaces */}
                <div className="border-t border-slate-100 pt-5">
                  <p className="mb-2.5 text-center text-[10.5px] font-extrabold uppercase tracking-wider text-slate-400">
                    Accès Rapide Espaces Démo (Bases Isolées)
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { user: 'admin', pass: 'admin123', label: 'Admin', sub: '70 Chauff.' },
                      { user: 'sfax', pass: 'sfax123', label: 'Agence Sfax', sub: 'Base dédiée' },
                      { user: 'tunis', pass: 'tunis123', label: 'Agence Tunis', sub: 'Base dédiée' },
                    ].map((acc) => (
                      <button
                        key={acc.user}
                        type="button"
                        disabled={loading}
                        onClick={() => handleLogin(undefined, acc.user, acc.pass)}
                        className="flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-center transition-all hover:border-indigo-300 hover:bg-indigo-50/50"
                      >
                        <IconBuilding className="h-4 w-4 text-indigo-600" />
                        <span className="mt-1 text-xs font-extrabold text-slate-800">
                          {acc.label}
                        </span>
                        <span className="text-[10px] text-slate-400">{acc.sub}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="mt-5 space-y-4">
                <div>
                  <label className="label">Nom de l&apos;Agence ou Caisse</label>
                  <div className="relative">
                    <IconBuilding className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex: Caisse Régionale Djerba"
                      className="input !pl-10"
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Identifiant de Connexion</label>
                  <div className="relative">
                    <IconUser className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Ex: djerba"
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
                      placeholder="Minimum 4 caractères"
                      className="input !pl-10"
                    />
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => setShowDbUrl(!showDbUrl)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
                  >
                    <IconDatabase className="h-3.5 w-3.5" />
                    {showDbUrl
                      ? 'Masquer la configuration PostgreSQL externe'
                      : 'Connecter une URL PostgreSQL / Neon externe (Optionnel)'}
                  </button>

                  {showDbUrl && (
                    <div className="mt-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
                      <label className="label !text-[10px]">URL PostgreSQL Dédiée</label>
                      <input
                        type="text"
                        value={customDbUrl}
                        onChange={(e) => setCustomDbUrl(e.target.value)}
                        placeholder="postgresql://user:pass@ep-xyz.neon.tech/neondb"
                        className="input font-mono !text-xs"
                      />
                      <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-500">
                        Si laissé vide, une base partitionnée vierge et isolée est créée automatiquement.
                      </p>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary mt-2 w-full !py-3 !text-sm"
                >
                  <span>{loading ? 'Initialisation...' : 'Créer ma Caisse & Démarrer'}</span>
                  {!loading && <IconArrowRight className="h-4 w-4" />}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
