'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaisseStore } from '@/lib/store';
import { IconAlert, IconCheck, IconCoins } from '@/components/Icons';

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
      router.push('/caisse');
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

      setSuccess('Compte créé avec succès ! Initialisation de votre caisse...');
      resetStoreForAccount();
      setCurrentUser(data.user);
      await fetchAccountData();
      setTimeout(() => {
        router.push('/caisse');
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 py-8 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/30">
            <IconCoins className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Caisse Chauffeurs
          </h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Système de Gestion, Encaissement & Billetterie Multi-Comptes
          </p>
        </div>

        {/* Auth Card */}
        <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-800/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-900/80 p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`rounded-lg py-2.5 transition-all ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
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
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Créer un Compte
            </button>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
              <IconAlert className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              <IconCheck className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' ? (
            <form onSubmit={(e) => handleLogin(e)} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Nom d&apos;utilisateur ou Caisse
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: admin, sfax, tunis..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Connexion en cours...' : 'Accéder à ma Caisse'}
              </button>

              {/* Quick Demo Accounts */}
              <div className="pt-4 border-t border-slate-700/60">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center mb-2.5">
                  Accès Démo 1-Clic (Bases isolées)
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => handleLogin(undefined, 'admin', 'admin123')}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-center text-xs font-medium text-slate-300 hover:border-indigo-500 hover:text-white"
                  >
                    👑 Admin
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLogin(undefined, 'sfax', 'sfax123')}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-center text-xs font-medium text-slate-300 hover:border-indigo-500 hover:text-white"
                  >
                    🏢 Sfax
                  </button>
                  <button
                    type="button"
                    onClick={() => handleLogin(undefined, 'tunis', 'tunis123')}
                    className="rounded-lg border border-slate-700 bg-slate-900/60 p-2 text-center text-xs font-medium text-slate-300 hover:border-indigo-500 hover:text-white"
                  >
                    🏢 Tunis
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Register Form */
            <form onSubmit={handleRegister} className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Nom d&apos;affichage de la caisse
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: Caisse Chauffeurs Djerba"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Identifiant de connexion (Username)
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ex: djerba"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* Optional Custom Database URL */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowDbUrl(!showDbUrl)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 underline font-medium"
                >
                  {showDbUrl
                    ? '▲ Masquer base de données personnalisée'
                    : '⚙️ Base de données dédiée propre (Optionnel)'}
                </button>

                {showDbUrl && (
                  <div className="mt-2 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                    <label className="mb-1 block text-[11px] font-medium text-slate-300">
                      URL PostgreSQL / Neon dédiée
                    </label>
                    <input
                      type="text"
                      value={customDbUrl}
                      onChange={(e) => setCustomDbUrl(e.target.value)}
                      placeholder="postgresql://user:pass@ep-xyz.neon.tech/neondb"
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                    <p className="mt-1.5 text-[10px] text-slate-400 leading-normal">
                      Si vide, une partition de base de données isolée dans Neon sera automatiquement affectée à cette caisse.
                    </p>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-50"
              >
                {loading ? 'Création en cours...' : 'Créer mon Compte & Démarrer'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Chaque compte dispose de sa propre base de données, chauffeurs, billetterie et historique étanches.
        </p>
      </div>
    </div>
  );
}

