'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCaisseStore } from '@/lib/store';
import { formatDateTime, formatMoney, getStatusBadge } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import PrintReceiptModal, { ReceiptData } from '@/components/PrintReceiptModal';
import { CashTransaction } from '@/types/caisse';
import {
  IconAlert,
  IconArrowRight,
  IconBolt,
  IconCalculator,
  IconCheck,
  IconCoins,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconSheet,
  IconTruck,
} from '@/components/Icons';

export default function DashboardPage() {
  const currentUser = useCaisseStore((state) => state.currentUser);
  const drivers = useCaisseStore((state) => state.drivers);
  const transactions = useCaisseStore((state) => state.transactions);
  const executeBascule1230 = useCaisseStore((state) => state.executeBascule1230);

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  const nonPayes = drivers.filter((d) => d.statut === 'NON PAYE');
  const payes = drivers.filter((d) => d.statut === 'PAYE');
  const pasDeCaisse = drivers.filter((d) => d.statut === 'PAS DE CAISSE');

  const totalDrivers = drivers.length;
  const activeTours = nonPayes.length + payes.length;
  const settlementPct = activeTours > 0 ? Math.round((payes.length / activeTours) * 100) : totalDrivers > 0 ? 100 : 0;

  const totalEncaisse = transactions.reduce((sum, t) => sum + t.tPayer, 0);
  const totalAttendu = transactions.reduce((sum, t) => sum + t.recette, 0);
  const ecartGlobal = totalEncaisse - totalAttendu;

  const urgentAlerts = [...nonPayes].sort((a, b) => {
    const da = new Date(a.dateDerniere || 0).getTime();
    const db = new Date(b.dateDerniere || 0).getTime();
    return da - db;
  });

  const recentTransactions = transactions.slice(0, 6);

  const openTransactionReceipt = (t: CashTransaction) => {
    setReceiptData({
      receiptNo: t.id,
      nom: t.nomChauffeur || 'Comptoir Direct',
      tr: t.codeChauffeur || '—',
      circuit: t.rawData?.circuit || 'TOURNÉE',
      recette: t.recette,
      tPayer: t.tPayer,
      resAPayer: t.resAPayer,
      versement: t.versement,
      rows: t.rawData?.rows || [],
      date: formatDateTime(t.date),
      caisseName: currentUser?.displayName,
      cashierName: currentUser?.username,
    });
  };

  return (
    <>
      {receiptData && (
        <PrintReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}

      {/* Executive Obsidian Treasury Command Hero */}
      <div className="card-dark bg-grid-pattern relative mb-6 overflow-hidden p-6 sm:p-8">
        <div className="relative z-10 flex flex-col justify-between gap-6 xl:flex-row xl:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-bold text-indigo-300 backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span>
                {currentUser?.displayName || 'Trésorerie Centrale'} · Base Isolée Active
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Centre de Pilotage Trésorerie & Flotte
            </h1>
            <p className="mt-1 max-w-xl text-xs text-slate-400 sm:text-sm">
              Vue consolidée des encaissements chauffeurs, écarts de caisse, billetterie physique et alertes de recouvrement en temps réel.
            </p>

            {/* Primary Hero Actions */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <Link href="/caisse" className="btn-primary !px-4 !py-2.5 !text-xs sm:!text-sm">
                <IconCalculator className="h-4 w-4" />
                Ouvrir le Guichet Caisse
              </Link>
              <Link
                href="/chauffeurs"
                className="btn border border-white/15 bg-white/10 !px-4 !py-2.5 !text-xs font-bold text-white backdrop-blur-sm hover:bg-white/15 sm:!text-sm"
              >
                <IconPlus className="h-4 w-4" />
                Gérer les Chauffeurs ({totalDrivers})
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      'Exécuter la Bascule de 12:30 ? Les tournées actives non réglées passeront en dette formelle.'
                    )
                  ) {
                    executeBascule1230();
                  }
                }}
                className="btn-amber !px-3.5 !py-2.5 !text-xs"
              >
                <IconBolt className="h-4 w-4" />
                Bascule 12:30
              </button>
            </div>
          </div>

          {/* Right Financial Snapshot Pod */}
          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md xl:w-96">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Total Encaissé (Journal)
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                  ecartGlobal >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30'
                }`}
              >
                Écart {ecartGlobal > 0 ? '+' : ''}
                {formatMoney(ecartGlobal)} TND
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-white tabular-nums">
                {formatMoney(totalEncaisse)}
              </span>
              <span className="font-mono text-xs font-bold text-indigo-300">TND</span>
            </div>

            <div className="mt-4 border-t border-white/10 pt-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Progression des règlements</span>
                <span className="font-mono font-bold text-emerald-400">{settlementPct}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-all duration-500"
                  style={{ width: `${settlementPct}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-slate-400">
                <span>{payes.length} payé(s)</span>
                <span>{nonPayes.length} en attente</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPI StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Chauffeurs Non Payés"
          value={nonPayes.length}
          icon={<IconAlert className="h-5 w-5" />}
          accent="rose"
          progress={totalDrivers > 0 ? (nonPayes.length / totalDrivers) * 100 : 0}
          hint="Tournées en attente de règlement"
        />
        <StatCard
          label="Chauffeurs Payés"
          value={payes.length}
          icon={<IconCheck className="h-5 w-5" />}
          accent="emerald"
          progress={totalDrivers > 0 ? (payes.length / totalDrivers) * 100 : 0}
          hint="Caisses clôturées et acquittées"
        />
        <StatCard
          label="Sans Caisse / Repos"
          value={pasDeCaisse.length}
          icon={<IconTruck className="h-5 w-5" />}
          accent="amber"
          progress={totalDrivers > 0 ? (pasDeCaisse.length / totalDrivers) * 100 : 0}
          hint="Chauffeurs hors circuit actif"
        />
        <StatCard
          label="Opérations Validées"
          value={transactions.length}
          unit="reçus"
          icon={<IconReceipt className="h-5 w-5" />}
          accent="indigo"
          progress={transactions.length > 0 ? 100 : 0}
          hint={`Attendu théorique : ${formatMoney(totalAttendu)} TND`}
        />
      </div>

      {/* Fleet Distribution Bar (when drivers exist) */}
      {totalDrivers > 0 && (
        <div className="card mt-5 p-4 sm:px-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Répartition en Temps Réel de la Flotte ({totalDrivers} Chauffeurs)
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Payés ({payes.length})
              </span>
              <span className="flex items-center gap-1.5 text-rose-700">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Non Payés ({nonPayes.length})
              </span>
              <span className="flex items-center gap-1.5 text-amber-700">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Sans Caisse ({pasDeCaisse.length})
              </span>
            </div>
          </div>

          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            {payes.length > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${(payes.length / totalDrivers) * 100}%` }}
              />
            )}
            {nonPayes.length > 0 && (
              <div
                className="bg-rose-500 transition-all duration-500"
                style={{ width: `${(nonPayes.length / totalDrivers) * 100}%` }}
              />
            )}
            {pasDeCaisse.length > 0 && (
              <div
                className="bg-amber-400 transition-all duration-500"
                style={{ width: `${(pasDeCaisse.length / totalDrivers) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Content Split Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left 2 Columns: Priority Unpaid Alerts */}
        <div className="card overflow-hidden xl:col-span-2">
          <div className="card-header">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/70">
                <IconAlert className="h-4 w-4" />
              </span>
              <div>
                <h2 className="card-title">Alertes Chauffeurs Non Réglés</h2>
                <p className="text-[11px] font-medium text-slate-400">
                  Priorité d&apos;encaissement classée par ancienneté
                </p>
              </div>
            </div>
            <Link
              href="/chauffeurs"
              className="btn-ghost !px-3 !py-1.5 !text-xs font-bold text-rose-600 hover:!border-rose-200 hover:!bg-rose-50"
            >
              Voir toute la flotte ({totalDrivers})
              <IconArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {urgentAlerts.length === 0 ? (
            <EmptyState
              icon={<IconCheck className="h-7 w-7 text-emerald-600" />}
              title={
                totalDrivers === 0
                  ? 'Aucun chauffeur enregistré dans ce compte'
                  : 'Aucun impayé en attente'
              }
              description={
                totalDrivers === 0
                  ? 'Ajoutez vos chauffeurs ou importez votre fichier Excel pour démarrer le suivi.'
                  : 'Excellent ! Toutes les tournées chauffeurs ont été réglées ou libérées.'
              }
            >
              <Link href="/chauffeurs" className="btn-primary !px-4 !py-2 !text-xs">
                <IconPlus className="h-4 w-4" />
                {totalDrivers === 0 ? 'Ajouter mon premier Chauffeur' : 'Gérer les Chauffeurs'}
              </Link>
            </EmptyState>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="divide-y divide-slate-100 md:hidden">
                {urgentAlerts.slice(0, 8).map((d) => (
                  <div
                    key={d.id}
                    className="p-4 bg-rose-50/25 hover:bg-rose-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                          #{d.tr}
                        </span>
                        <p className="truncate text-sm font-extrabold text-slate-900">{d.nom}</p>
                      </div>
                      <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="badge-slate">
                        {d.programmeJour || d.circuitActuel || 'STAND-BY'}
                      </span>
                      <span className="font-bold text-rose-700 truncate">{d.reclamation}</span>
                    </div>

                    <Link
                      href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                      className="btn-primary w-full !py-2 !text-xs"
                    >
                      <IconCalculator className="h-3.5 w-3.5" />
                      Encaisser Maintenant
                    </Link>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="table-wrap hidden md:block">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-20">Code TR</th>
                      <th className="w-48">Chauffeur</th>
                      <th className="w-32">Circuit</th>
                      <th>Délai & Alerte</th>
                      <th className="w-32 !text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentAlerts.slice(0, 10).map((d) => (
                      <tr key={d.id} className="row-alert">
                        <td>
                          <span className="inline-flex rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-xs font-extrabold text-white">
                            #{d.tr}
                          </span>
                        </td>
                        <td>
                          <p className="max-w-[180px] truncate font-bold text-slate-900" title={d.nom}>
                            {d.nom}
                          </p>
                        </td>
                        <td>
                          <span className="badge-slate max-w-[120px] truncate">
                            {d.programmeJour || d.circuitActuel || 'STAND-BY'}
                          </span>
                        </td>
                        <td className="max-w-[230px]">
                          <div className="flex items-center gap-1.5 truncate text-xs font-bold text-rose-700">
                            <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-rose-500" />
                            <span className="truncate" title={d.reclamation}>
                              {d.reclamation}
                            </span>
                          </div>
                        </td>
                        <td className="text-right">
                          <Link
                            href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                            className="btn-primary !px-3 !py-1.5 !text-xs"
                          >
                            Encaisser
                            <IconArrowRight className="h-3.5 w-3.5" />
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

        {/* Right Column: Quick Modules & Live Transactions Feed */}
        <div className="space-y-6 xl:col-span-1">
          {/* Quick Modules */}
          <div className="card p-5">
            <h3 className="text-sm font-extrabold tracking-tight text-slate-900">
              Modules Opérationnels
            </h3>
            <div className="mt-3.5 space-y-2.5">
              <Link
                href="/caisse"
                className="group flex items-center justify-between rounded-2xl border border-slate-200/90 p-3.5 transition-all hover:border-indigo-300 hover:bg-indigo-50/35"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/70 transition-transform group-hover:scale-105">
                    <IconCalculator className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Guichet POS Caisse</p>
                    <p className="text-[11px] text-slate-500">Scanner TR, coupures & factures</p>
                  </div>
                </div>
                <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
              </Link>

              <Link
                href="/billetterie"
                className="group flex items-center justify-between rounded-2xl border border-slate-200/90 p-3.5 transition-all hover:border-amber-300 hover:bg-amber-50/35"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/70 transition-transform group-hover:scale-105">
                    <IconCoins className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Comptage Billetterie</p>
                    <p className="text-[11px] text-slate-500">Inventaire coffre & PV officiel A4</p>
                  </div>
                </div>
                <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" />
              </Link>

              <Link
                href="/excel"
                className="group flex items-center justify-between rounded-2xl border border-slate-200/90 p-3.5 transition-all hover:border-emerald-300 hover:bg-emerald-50/35"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70 transition-transform group-hover:scale-105">
                    <IconSheet className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Centre Excel (.xlsx)</p>
                    <p className="text-[11px] text-slate-500">Importation flotte & exports audit</p>
                  </div>
                </div>
                <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
              </Link>
            </div>
          </div>

          {/* Recent Validated Receipts with 1-Click Print */}
          <div className="card overflow-hidden">
            <div className="card-header !py-3.5">
              <h3 className="card-title text-sm">Derniers Reçus Validés</h3>
              <Link
                href="/journal"
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                Journal →
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs font-medium text-slate-400">
                Aucun reçu d&apos;encaissement validé pour le moment.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTransactions.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-2 px-4 py-3 text-xs transition-colors hover:bg-slate-50/80"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-900">{t.nomChauffeur}</p>
                      <p className="text-[11px] text-slate-400">{formatDateTime(t.date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="font-mono font-extrabold text-emerald-700">
                          {formatMoney(t.tPayer)} TND
                        </p>
                        <p className="font-mono text-[10px] text-slate-400">
                          Att: {formatMoney(t.recette)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTransactionReceipt(t)}
                        className="btn-icon !h-8 !w-8 text-slate-400 hover:!bg-indigo-50 hover:!text-indigo-600"
                        title="Imprimer Reçu / Facture HD"
                      >
                        <IconPrinter className="h-4 w-4" />
                      </button>
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
