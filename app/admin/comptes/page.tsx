'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCaisseStore } from '@/lib/store';
import PageHeader from '@/components/PageHeader';
import { IconAlert, IconShield, IconUser } from '@/components/Icons';

type AccountRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  caisseCode: string;
  isBlocked: boolean;
};

const ASSIGNMENTS = [
  { id: 'CRNU', label: 'Caisse CRNU' },
  { id: 'CRSF', label: 'Caisse CRSF' },
  { id: 'CRTN', label: 'Caisse CRTN' },
  { id: 'SUPERVISEUR', label: 'Superviseur' },
] as const;

export default function AdminComptesPage() {
  const router = useRouter();
  const currentUser = useCaisseStore((s) => s.currentUser);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [assignment, setAssignment] = useState<(typeof ASSIGNMENTS)[number]['id']>('CRNU');
  const [saving, setSaving] = useState(false);
  const [pwdTarget, setPwdTarget] = useState<AccountRow | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/accounts', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Chargement impossible');
      setAccounts(json.data || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace('/');
    }
  }, [currentUser, router]);

  useEffect(() => {
    load();
  }, [load]);

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, displayName, assignment }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Création impossible');
      setInfo(json.message);
      setUsername('');
      setPassword('');
      setDisplayName('');
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const patchAccount = async (id: string, action: 'block' | 'unblock' | 'password', extra?: Record<string, string>) => {
    setError(null);
    setInfo(null);
    const res = await fetch('/api/admin/accounts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, ...extra }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || 'Action impossible');
      return;
    }
    setInfo(json.message);
    setPwdTarget(null);
    setNewPassword('');
    await load();
  };

  if (currentUser && currentUser.role !== 'admin') return null;

  return (
    <div className="w-full pb-16">
      <PageHeader
        title="Gestion des Comptes"
        subtitle="Création et administration des accès caissiers (CRNU, CRSF, CRTN) et superviseurs"
        icon={<IconUser className="h-5 w-5" />}
        accent="indigo"
      />

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-semibold text-rose-800">
          <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {info && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800">
          {info}
        </div>
      )}

      <form onSubmit={createAccount} className="card mb-5 p-4 sm:p-5">
        <h2 className="text-sm font-bold text-slate-900">Nouveau compte opérateur ou superviseur</h2>
        <p className="mt-0.5 text-xs text-slate-500">Chaque identifiant est rattaché à une caisse ou à la supervision.</p>
        <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-bold text-slate-600">
            Identifiant
            <input className="input mt-1 w-full" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Mot de passe
            <input type="password" className="input mt-1 w-full" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Nom affiché
            <input className="input mt-1 w-full" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </label>
          <label className="block text-xs font-bold text-slate-600">
            Affectation
            <select
              className="input mt-1 w-full"
              value={assignment}
              onChange={(e) => setAssignment(e.target.value as (typeof ASSIGNMENTS)[number]['id'])}
            >
              {ASSIGNMENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button type="submit" disabled={saving} className="btn-primary mt-3.5 !py-2 text-xs font-bold">
          {saving ? 'Création…' : 'Créer le compte'}
        </button>
      </form>

      <div className="card divide-y divide-slate-100 overflow-hidden">
        <div className="card-header">
          <h3 className="card-title">Comptes enregistrés ({accounts.length})</h3>
          <span className="badge-slate font-mono text-[10.5px]">ACCÈS</span>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Chargement…</div>
        ) : (
          accounts.map((acc) => (
            <article key={acc.id} className="p-3.5 sm:px-5 hover:bg-slate-50/70 transition-colors">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`inline-flex h-8 min-w-[3.5rem] shrink-0 items-center justify-center rounded-lg px-2 font-mono text-[11px] font-bold text-white ${
                      acc.role === 'admin'
                        ? 'bg-slate-900'
                        : acc.role === 'superviseur'
                        ? 'bg-indigo-600'
                        : acc.caisseCode === 'CRSF'
                        ? 'bg-emerald-600'
                        : 'bg-sky-600'
                    }`}
                  >
                    {acc.caisseCode || acc.role.toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {acc.displayName}{' '}
                      <span className="font-mono text-xs font-semibold text-slate-400">@{acc.username}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {acc.role === 'admin'
                        ? 'Administrateur'
                        : acc.role === 'superviseur'
                        ? 'Superviseur'
                        : `Caisse ${acc.caisseCode}`}
                      {acc.isBlocked ? (
                        <span className="ml-1.5 font-semibold text-rose-600">· Bloqué</span>
                      ) : (
                        <span className="ml-1.5 font-semibold text-emerald-600">· Actif</span>
                      )}
                    </p>
                  </div>
                </div>

                {acc.role !== 'admin' && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {acc.isBlocked ? (
                      <button
                        type="button"
                        className="btn-ghost h-8 text-xs font-bold text-emerald-700"
                        onClick={() => patchAccount(acc.id, 'unblock')}
                      >
                        Débloquer
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost h-8 text-xs font-bold text-rose-600"
                        onClick={() => {
                          if (confirm(`Bloquer ${acc.username} ?`)) patchAccount(acc.id, 'block');
                        }}
                      >
                        Bloquer
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-ghost h-8 text-xs font-semibold text-sky-700"
                      onClick={() => {
                        setPwdTarget(acc);
                        setNewPassword('');
                      }}
                    >
                      <IconShield className="h-3.5 w-3.5" />
                      Mot de passe
                    </button>
                  </div>
                )}
              </div>
              {pwdTarget?.id === acc.id && (
                <form
                  className="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    patchAccount(acc.id, 'password', { password: newPassword });
                  }}
                >
                  <label className="block min-w-[12rem] flex-1 text-xs font-bold text-slate-600">
                    Nouveau mot de passe
                    <input
                      type="password"
                      className="input mt-1 w-full bg-white"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                  </label>
                  <button type="submit" className="btn-primary h-9 text-xs font-bold">
                    Enregistrer
                  </button>
                  <button type="button" className="btn-ghost h-9 text-xs bg-white" onClick={() => setPwdTarget(null)}>
                    Annuler
                  </button>
                </form>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
