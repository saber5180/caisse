'use client';

import Link from 'next/link';
import { useCaisseStore } from '@/lib/store';
import { formatMoney, getStatusBadge, formatDateTime } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import {
  IconAlert,
  IconBolt,
  IconCalculator,
  IconCoins,
  IconDashboard,
  IconReceipt,
  IconTruck,
} from '@/components/Icons';

export default function DashboardPage() {
  const drivers = useCaisseStore((state) => state.drivers);
  const transactions = useCaisseStore((state) => state.transactions);
  const executeBascule1230 = useCaisseStore((state) => state.executeBascule1230);

  const nonPayes = drivers.filter((d) => d.statut === 'NON PAYE');
  const payes = drivers.filter((d) => d.statut === 'PAYE');
  const pasDeCaisse = drivers.filter((d) => d.statut === 'PAS DE CAISSE');

  const totalCaisseJour = transactions.reduce((sum, t) => sum + t.tPayer, 0);

  // Urgent alerts (NON PAYE with active debt or > 0 days)
  const urgentAlerts = [...nonPayes].sort((a, b) => {
    const da = new Date(a.dateDerniere || 0).getTime();
    const db = new Date(b.dateDerniere || 0).getTime();
    return da - db;
  });

  const recentTransactions = transactions.slice(0, 6);

  return (
    <>
      <PageHeader
        title="Tableau de bord"
        subtitle="Surveillance en temps réel des encaissements, billetterie et alertes chauffeurs"
        icon={<IconDashboard className="h-5 w-5" />}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              onClick={() => {
                if (
                  confirm(
                    'Voulez-vous exécuter la bascule de 12:30 ? Les tournées actives non payées seront basculées en dette.'
                  )
                ) {
                  executeBascule1230();
                }
              }}
              className="btn-amber flex-1 sm:flex-none !py-2 text-xs sm:text-sm font-bold"
              title="Exécuter la clôture/bascule de 12h30"
            >
              <IconBolt className="h-4 w-4" />
              Bascule 12:30
            </button>
            <Link
              href="/billetterie"
              className="btn-ghost flex-1 sm:flex-none !py-2 text-xs sm:text-sm"
            >
              <IconCoins className="h-4 w-4" />
              Billetterie
            </Link>
            <Link
              href="/caisse"
              className="btn-primary w-full sm:w-auto !py-2 text-xs sm:text-sm font-bold"
            >
              <IconCalculator className="h-4 w-4" />
              Guichet de Caisse
            </Link>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Chauffeurs Non Payés"
          value={nonPayes.length}
          icon={<IconAlert className="h-[18px] w-[18px]" />}
          accent="rose"
          hint="Tournées en attente d'encaissement"
        />
        <StatCard
          label="Chauffeurs Payés"
          value={payes.length}
          icon={<IconTruck className="h-[18px] w-[18px]" />}
          accent="emerald"
          hint="Encaissés avec succès"
        />
        <StatCard
          label="Pas de Caisse / Repos"
          value={pasDeCaisse.length}
          icon={<IconCoins className="h-[18px] w-[18px]" />}
          accent="amber"
          hint="Sans caisse active"
        />
        <StatCard
          label="Total Encaissé (Journal)"
          value={formatMoney(totalCaisseJour)}
          unit="TND"
          icon={<IconReceipt className="h-[18px] w-[18px]" />}
          accent="indigo"
          hint={`${transactions.length} transaction(s) validée(s)`}
        />
      </div>

      {/* Main Grid: Alertes Chauffeurs & Dernières Transactions */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Colonne Gauche: Alertes Chauffeurs Non Réglés */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="card-header bg-slate-50/70">
            <div>
              <h2 className="card-title text-sm">Alertes Chauffeurs Non Réglés</h2>
              <p className="text-[11px] text-slate-400">
                Calcul automatique des retards & relances
              </p>
            </div>
            <Link
              href="/chauffeurs?status=NON%20PAYE"
              className="text-xs font-semibold text-rose-600 hover:underline"
            >
              Voir tout ({nonPayes.length}) →
            </Link>
          </div>

          {urgentAlerts.length === 0 ? (
            <EmptyState
              icon={<IconTruck className="h-6 w-6" />}
              title="Aucun impayé en cours"
              description="Toutes les tournées chauffeurs sont actuellement encaissées ou libérées."
            />
          ) : (
            <>
              {/* Mobile Alert Cards View (md:hidden) */}
              <div className="divide-y divide-slate-100 md:hidden">
                {urgentAlerts.slice(0, 10).map((d) => (
                  <div key={d.id} className="p-3.5 bg-rose-50/30 hover:bg-rose-50/60 transition-colors">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="badge-indigo font-mono text-xs">TR {d.tr}</span>
                        <p className="text-sm font-bold text-slate-900">{d.nom}</p>
                      </div>
                      <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-rose-700 font-semibold mb-2">
                      <span className="badge-slate text-[11px]">
                        {d.programmeJour || d.circuitActuel || 'STAND-BY'}
                      </span>
                      <span>{d.reclamation}</span>
                    </div>

                    <Link
                      href={`/caisse?tr=${d.tr}`}
                      className="btn-primary w-full !py-1.5 text-xs font-bold text-center block"
                    >
                      Encaisser Chauffeur
                    </Link>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (hidden md:block) */}
              <div className="table-wrap hidden md:block">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-16">TR</th>
                      <th>Nom Chauffeur</th>
                      <th>Circuit</th>
                      <th>Statut</th>
                      <th>Alerte Retard</th>
                      <th className="!text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentAlerts.slice(0, 10).map((d) => (
                      <tr key={d.id} className="row-alert">
                        <td>
                          <span className="num font-bold text-slate-900">{d.tr}</span>
                        </td>
                        <td>
                          <div className="font-semibold text-slate-900">{d.nom}</div>
                        </td>
                        <td>
                          <span className="badge-slate text-xs font-medium">
                            {d.programmeJour || d.circuitActuel || 'STAND-BY'}
                          </span>
                        </td>
                        <td>
                          <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                        </td>
                        <td>
                          <span className="text-xs font-semibold text-rose-700">
                            {d.reclamation}
                          </span>
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/caisse?tr=${d.tr}`}
                            className="btn-primary !px-2.5 !py-1 !text-xs font-bold"
                          >
                            Encaisser
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Colonne Droite: Modules & Derniers Encaissements */}
        <div className="space-y-6 xl:col-span-1">
          {/* Modules Rapides */}
          <div className="card p-4 sm:p-5">
            <h3 className="text-sm font-bold tracking-tight text-slate-900">
              Accès Rapide aux Modules
            </h3>
            <div className="mt-3.5 space-y-2.5">
              <Link
                href="/caisse"
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition-all hover:border-indigo-300 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <IconCalculator className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900">Guichet Caisse</p>
                    <p className="text-[11px] text-slate-500">Calcul entrées/sorties & scanner TR</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-indigo-600">→</span>
              </Link>

              <Link
                href="/billetterie"
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition-all hover:border-amber-300 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <IconCoins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900">Billetterie</p>
                    <p className="text-[11px] text-slate-500">Comptage physique & rapprochement</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-amber-600">→</span>
              </Link>

              <Link
                href="/chauffeurs"
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition-all hover:border-rose-300 hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                    <IconTruck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-semibold text-slate-900">Chauffeurs</p>
                    <p className="text-[11px] text-slate-500">Statuts, circuits & retards</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-600">→</span>
              </Link>
            </div>
          </div>

          {/* Dernières Transactions */}
          <div className="card overflow-hidden">
            <div className="card-header !py-3">
              <h3 className="card-title text-sm">Derniers Encaissements</h3>
              <Link href="/journal" className="text-xs text-indigo-600 hover:underline">
                Journal complet →
              </Link>
            </div>
            {recentTransactions.length === 0 ? (
              <div className="p-5 text-center text-xs text-slate-400">
                Aucun encaissement validé aujourd&apos;hui.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{t.nomChauffeur}</p>
                      <p className="text-slate-400 text-[11px]">{formatDateTime(t.date)}</p>
                    </div>
                    <div className="text-right">
                      <p className="num font-bold text-indigo-700">{formatMoney(t.tPayer)} TND</p>
                      <p className="text-[10px] text-slate-500">Attendu: {formatMoney(t.recette)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
