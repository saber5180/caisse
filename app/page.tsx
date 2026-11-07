'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCaisseStore } from '@/lib/store';
import { formatDateTime, formatMoney, getStatusBadge, cleanScannerTr } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import PrintReceiptModal, { ReceiptData } from '@/components/PrintReceiptModal';
import { CashTransaction, Driver, DriverStatus } from '@/types/caisse';
import {
  IconAlert,
  IconArrowRight,
  IconBolt,
  IconCalculator,
  IconCheck,
  IconClose,
  IconCoins,
  IconEdit,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconSearch,
  IconSheet,
  IconTruck,
} from '@/components/Icons';

export default function DashboardPage() {
  const currentUser = useCaisseStore((state) => state.currentUser);
  const drivers = useCaisseStore((state) => state.drivers);
  const transactions = useCaisseStore((state) => state.transactions);
  const updateDriver = useCaisseStore((state) => state.updateDriver);
  const executeBascule1230 = useCaisseStore((state) => state.executeBascule1230);

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Modals de navigation rapide par catégorie
  const [activeCategoryModal, setActiveCategoryModal] = useState<
    'NON_PAYES' | 'PAYES' | 'PAS_DE_CAISSE' | 'VALIDES' | null
  >(null);

  // Modal d'inspection détaillée d'un chauffeur au clic sur la ligne
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<Driver | null>(null);

  // Modal de modification rapide de Série / Sous-série / Montant Bordereau
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editSerie, setEditSerie] = useState('');
  const [editSousSerie, setEditSousSerie] = useState('');
  const [editMontantBordereau, setEditMontantBordereau] = useState<number>(0);

  // Filtres du tableau de bord
  const [tableFilter, setTableFilter] = useState<'ALL' | DriverStatus>('ALL');
  const [tableSearch, setTableSearch] = useState('');

  const nonPayes = drivers.filter((d) => d.statut === 'NON PAYE');
  const payes = drivers.filter((d) => d.statut === 'PAYE');
  const pasDeCaisse = drivers.filter((d) => d.statut === 'PAS DE CAISSE');

  const totalDrivers = drivers.length;
  const activeTours = nonPayes.length + payes.length;
  const settlementPct =
    activeTours > 0 ? Math.round((payes.length / activeTours) * 100) : totalDrivers > 0 ? 100 : 0;

  const totalEncaisse = transactions.reduce((sum, t) => sum + t.tPayer, 0);
  const totalAttendu = transactions.reduce((sum, t) => sum + t.recette, 0);
  const ecartGlobal = totalEncaisse - totalAttendu;

  // Calcul dynamique des métriques enrichies par chauffeur (Bordereaux, Mouvements, Écarts)
  const enrichedDrivers = useMemo(() => {
    return drivers.map((d) => {
      // Retrouve toutes les transactions enregistrées pour ce chauffeur (normalisé)
      const dTrClean = cleanScannerTr(d.tr);
      const driverTxns = transactions.filter(
        (t) => cleanScannerTr(t.codeChauffeur) === dTrClean
      );

      // État de mouvement de caisse (total réel encaissé)
      const mvtCaisse = driverTxns.reduce((sum, t) => sum + t.tPayer, 0);

      // Montant du bordereau : valeur enregistrée ou somme théorique attendue des transactions
      const mtBordereau =
        typeof d.montantBordereau === 'number' && d.montantBordereau > 0
          ? d.montantBordereau
          : driverTxns.reduce((sum, t) => sum + t.recette, 0);

      // Calcul automatique de l'écart : Différence entre le montant du bordereau et l'état de mouvement
      const ecart = Math.round((mtBordereau - mvtCaisse) * 1000) / 1000;

      return {
        ...d,
        serie: d.serie || '—',
        sousSerie: d.sousSerie || '—',
        montantBordereau: mtBordereau,
        mouvementCaisse: mvtCaisse,
        ecartBordereau: ecart,
      };
    });
  }, [drivers, transactions]);

  // Filtrage combiné (Statut + Recherche)
  const filteredDrivers = useMemo(() => {
    return enrichedDrivers.filter((d) => {
      const matchStatus = tableFilter === 'ALL' ? true : d.statut === tableFilter;
      const q = tableSearch.toLowerCase().trim();
      const matchSearch = q
        ? d.nom.toLowerCase().includes(q) ||
          d.tr.toLowerCase().includes(q) ||
          (d.serie || '').toLowerCase().includes(q) ||
          (d.sousSerie || '').toLowerCase().includes(q) ||
          (d.programmeJour || '').toLowerCase().includes(q)
        : true;
      return matchStatus && matchSearch;
    });
  }, [enrichedDrivers, tableFilter, tableSearch]);

  // Cumuls financiers des bordereaux et mouvements
  const cumulBordereaux = enrichedDrivers.reduce((sum, d) => sum + (d.montantBordereau || 0), 0);
  const cumulMouvements = enrichedDrivers.reduce((sum, d) => sum + (d.mouvementCaisse || 0), 0);
  const cumulEcart = Math.round((cumulBordereaux - cumulMouvements) * 1000) / 1000;

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

  const startEditDriver = (e: React.MouseEvent, d: Driver) => {
    e.stopPropagation();
    setEditingDriver(d);
    setEditSerie(d.serie && d.serie !== '—' ? d.serie : '');
    setEditSousSerie(d.sousSerie && d.sousSerie !== '—' ? d.sousSerie : '');
    setEditMontantBordereau(d.montantBordereau || 0);
  };

  const handleSaveDriverEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDriver) {
      updateDriver(editingDriver.id, {
        serie: editSerie.trim(),
        sousSerie: editSousSerie.trim(),
        montantBordereau: editMontantBordereau,
      });
      setEditingDriver(null);
    }
  };

  return (
    <>
      {receiptData && (
        <PrintReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}

      {/* =========================================================================
          HERO BANNER COMMAND CENTER
      ========================================================================= */}
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
              Suivi en temps réel des bordereaux, états de mouvement de caisse, décompte des coupures et alertes de recouvrement.
            </p>

            {/* Actions Rapides */}
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

      {/* =========================================================================
          4 KPI STATCARDS CLIQUABLES POUR NAVIGATION DIRECTE
      ========================================================================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Chauffeurs Non Payés"
          value={nonPayes.length}
          icon={<IconAlert className="h-5 w-5" />}
          accent="rose"
          progress={totalDrivers > 0 ? (nonPayes.length / totalDrivers) * 100 : 0}
          hint="👉 Cliquez pour ouvrir la liste des impayés"
          onClick={() => setActiveCategoryModal('NON_PAYES')}
        />
        <StatCard
          label="Chauffeurs Payés"
          value={payes.length}
          icon={<IconCheck className="h-5 w-5" />}
          accent="emerald"
          progress={totalDrivers > 0 ? (payes.length / totalDrivers) * 100 : 0}
          hint="👉 Cliquez pour voir les caisses acquittées"
          onClick={() => setActiveCategoryModal('PAYES')}
        />
        <StatCard
          label="Sans Caisse / Repos"
          value={pasDeCaisse.length}
          icon={<IconTruck className="h-5 w-5" />}
          accent="amber"
          progress={totalDrivers > 0 ? (pasDeCaisse.length / totalDrivers) * 100 : 0}
          hint="👉 Cliquez pour afficher les chauffeurs au repos"
          onClick={() => setActiveCategoryModal('PAS_DE_CAISSE')}
        />
        <StatCard
          label="Opérations Validées"
          value={transactions.length}
          unit="reçus"
          icon={<IconReceipt className="h-5 w-5" />}
          accent="indigo"
          progress={transactions.length > 0 ? 100 : 0}
          hint="👉 Cliquez pour afficher les reçus validés"
          onClick={() => setActiveCategoryModal('VALIDES')}
        />
      </div>

      {/* =========================================================================
          BARRE DE REPARTITION DE LA FLOTTE AVEC SEGMENTS CLIQUABLES
      ========================================================================= */}
      {totalDrivers > 0 && (
        <div className="card mt-5 p-4 sm:px-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Répartition Flotte en Temps Réel ({totalDrivers} Chauffeurs)
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveCategoryModal('PAYES')}
                className="flex items-center gap-1.5 text-emerald-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Payés ({payes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryModal('NON_PAYES')}
                className="flex items-center gap-1.5 text-rose-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Non Payés ({nonPayes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryModal('PAS_DE_CAISSE')}
                className="flex items-center gap-1.5 text-amber-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                Sans Caisse / Repos ({pasDeCaisse.length})
              </button>
            </div>
          </div>

          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            {payes.length > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500 cursor-pointer"
                style={{ width: `${(payes.length / totalDrivers) * 100}%` }}
                onClick={() => setActiveCategoryModal('PAYES')}
                title="Afficher les Chauffeurs Payés"
              />
            )}
            {nonPayes.length > 0 && (
              <div
                className="bg-rose-500 transition-all duration-500 cursor-pointer"
                style={{ width: `${(nonPayes.length / totalDrivers) * 100}%` }}
                onClick={() => setActiveCategoryModal('NON_PAYES')}
                title="Afficher les Chauffeurs Non Payés"
              />
            )}
            {pasDeCaisse.length > 0 && (
              <div
                className="bg-amber-400 transition-all duration-500 cursor-pointer"
                style={{ width: `${(pasDeCaisse.length / totalDrivers) * 100}%` }}
                onClick={() => setActiveCategoryModal('PAS_DE_CAISSE')}
                title="Afficher Sans Caisse / Repos"
              />
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TABLEAU DE BORD : BORDEREAUX, SÉRIE, SOUS-SÉRIE & MOUVEMENTS DE CAISSE
      ========================================================================= */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Colonnes 1 & 2 : Tableau Consolidé avec Lignes Cliquables */}
        <div className="card overflow-hidden xl:col-span-2">
          {/* Card Header & Filter Tabs */}
          <div className="card-header flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 font-bold text-xs ring-1 ring-indigo-200/70">
                  <IconSheet className="h-4 w-4" />
                </span>
                <h2 className="card-title text-sm">Tableau de Bord & Mouvements de Caisse</h2>
              </div>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                Suivi des séries, bordereaux saisis, encaissements et calcul automatique des écarts
              </p>
            </div>

            {/* Onglets Filtre Rapide */}
            <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setTableFilter('ALL')}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                  tableFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tous ({totalDrivers})
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('NON PAYE')}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                  tableFilter === 'NON PAYE'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Non Payés ({nonPayes.length})
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('PAYE')}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                  tableFilter === 'PAYE'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                }`}
              >
                Payés ({payes.length})
              </button>
              <button
                type="button"
                onClick={() => setTableFilter('PAS DE CAISSE')}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all ${
                  tableFilter === 'PAS DE CAISSE'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                }`}
              >
                Repos ({pasDeCaisse.length})
              </button>
            </div>
          </div>

          {/* Search Bar & Totaux Row */}
          <div className="p-3.5 sm:p-4 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Rechercher par chauffeur, TR, série, sous-série..."
                className="input !pl-8 !py-1.5 text-xs font-medium w-full"
              />
            </div>

            {/* Quick Metrics Pills */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="badge-slate font-mono text-[11px]">
                Bordereaux: <strong>{formatMoney(cumulBordereaux)}</strong> TND
              </span>
              <span className="badge-indigo font-mono text-[11px]">
                Mouvements: <strong>{formatMoney(cumulMouvements)}</strong> TND
              </span>
              <span
                className={`font-mono text-[11px] px-2 py-0.5 rounded-full font-bold ${
                  cumulEcart === 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : cumulEcart > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}
              >
                Écart: {cumulEcart > 0 ? '+' : ''}{formatMoney(cumulEcart)} TND
              </span>
            </div>
          </div>

          {filteredDrivers.length === 0 ? (
            <EmptyState
              icon={<IconCheck className="h-7 w-7 text-emerald-600" />}
              title="Aucun chauffeur trouvé"
              description="Aucun résultat ne correspond aux critères de filtre ou de recherche sélectionnés."
            />
          ) : (
            <>
              {/* Mobile Cards (sm:hidden) */}
              <div className="divide-y divide-slate-100 sm:hidden">
                {filteredDrivers.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDriverDetails(d)}
                    className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                          TR {d.tr}
                        </span>
                        <p className="truncate text-sm font-extrabold text-slate-900">{d.nom}</p>
                      </div>
                      <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-2.5 mb-2.5">
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Série / Sous-série
                        </span>
                        <span className="font-semibold text-slate-800">
                          {d.serie} / {d.sousSerie}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Circuit
                        </span>
                        <span className="font-semibold text-slate-800 truncate block">
                          {d.programmeJour || 'STAND-BY'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Montant Bordereaux
                        </span>
                        <strong className="num text-slate-900">
                          {formatMoney(d.montantBordereau)} TND
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">
                          Mouvement Caisse
                        </span>
                        <strong className="num text-emerald-700">
                          {formatMoney(d.mouvementCaisse)} TND
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium text-[11px]">Écart :</span>
                        <span
                          className={`font-mono font-black text-xs ${
                            d.ecartBordereau === 0
                              ? 'text-slate-700'
                              : d.ecartBordereau > 0
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {d.ecartBordereau > 0 ? '+' : ''}{formatMoney(d.ecartBordereau)} TND
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => startEditDriver(e, d)}
                          className="btn-ghost !py-1 !px-2 text-xs font-semibold"
                          title="Modifier Série / Bordereau"
                        >
                          <IconEdit className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                          className="btn-primary !py-1 !px-2.5 text-xs font-bold"
                        >
                          Encaisser
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (hidden sm:block) */}
              <div className="table-wrap hidden sm:block">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="w-16">Code TR</th>
                      <th className="w-40">Chauffeur</th>
                      <th className="w-20">Série</th>
                      <th className="w-20">Sous-série</th>
                      <th className="!text-right w-28">Bordereaux (TND)</th>
                      <th className="!text-right w-28">Mvt Caisse (TND)</th>
                      <th className="!text-right w-28">Écart (TND)</th>
                      <th className="w-28">Circuit</th>
                      <th className="w-24">Statut</th>
                      <th className="!text-center w-28">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDrivers.map((d) => (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedDriverDetails(d)}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors group"
                        title="Cliquez pour afficher la fiche détaillée du chauffeur"
                      >
                        {/* TR */}
                        <td>
                          <span className="inline-flex rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-xs font-extrabold text-white">
                            #{d.tr}
                          </span>
                        </td>

                        {/* Nom */}
                        <td>
                          <p className="max-w-[150px] truncate font-bold text-slate-900" title={d.nom}>
                            {d.nom}
                          </p>
                        </td>

                        {/* Série */}
                        <td>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {d.serie}
                          </span>
                        </td>

                        {/* Sous-série */}
                        <td>
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {d.sousSerie}
                          </span>
                        </td>

                        {/* Calcul des Bordereaux */}
                        <td className="text-right num font-black text-xs text-slate-900">
                          {formatMoney(d.montantBordereau)}
                        </td>

                        {/* Mouvements de Caisse */}
                        <td className="text-right num font-black text-xs text-emerald-700">
                          {formatMoney(d.mouvementCaisse)}
                        </td>

                        {/* Calcul des Écarts (Différence Bordereau - Mouvement) */}
                        <td className="text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-mono text-xs font-black ${
                              d.ecartBordereau === 0
                                ? 'bg-slate-100 text-slate-700'
                                : d.ecartBordereau > 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {d.ecartBordereau > 0 ? '+' : ''}{formatMoney(d.ecartBordereau)}
                          </span>
                        </td>

                        {/* Circuit */}
                        <td>
                          <span className="badge-slate max-w-[110px] truncate" title={d.programmeJour}>
                            {d.programmeJour || 'STAND-BY'}
                          </span>
                        </td>

                        {/* Statut */}
                        <td>
                          <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                        </td>

                        {/* Actions */}
                        <td className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => startEditDriver(e, d)}
                              className="btn-ghost !p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                              title="Modifier Série / Sous-série / Bordereau"
                            >
                              <IconEdit className="h-3.5 w-3.5" />
                            </button>
                            <Link
                              href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                              className="btn-primary !px-2.5 !py-1 !text-xs font-bold"
                              title="Ouvrir au Guichet POS Caisse"
                            >
                              Encaisser
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Colonne 3 : Modules & Derniers Reçus Validés */}
        <div className="space-y-6 xl:col-span-1">
          {/* Modules Opérationnels */}
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

          {/* Derniers Reçus Validés avec Impression 1-Clic */}
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

      {/* =========================================================================
          MODAL 1 : CATEGORIES FLOTTE (NON PAYÉS, PAYÉS, SANS CAISSE, REÇUS)
      ========================================================================= */}
      {activeCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden no-print">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveCategoryModal(null)}
          />

          <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl z-10 overflow-hidden flex flex-col max-h-[85vh] border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeCategoryModal === 'NON_PAYES' && '🔴 Chauffeurs Non Payés (Impayés en attente)'}
                  {activeCategoryModal === 'PAYES' && '🟢 Chauffeurs Payés (Tournées Acquittées)'}
                  {activeCategoryModal === 'PAS_DE_CAISSE' && '🟡 Chauffeurs Sans Caisse / Au Repos'}
                  {activeCategoryModal === 'VALIDES' && '📄 Opérations de Caisse Validées'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fenêtre contextuelle ouverte directement depuis le Tableau de Bord
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCategoryModal(null)}
                className="btn-icon !h-8 !w-8 hover:bg-slate-200"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content List */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-3">
              {activeCategoryModal === 'VALIDES' ? (
                transactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    Aucune transaction validée pour le moment.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                    {transactions.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="badge-slate font-mono font-bold">TR {t.codeChauffeur}</span>
                            <span className="font-bold text-slate-900">{t.nomChauffeur}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{formatDateTime(t.date)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right font-mono">
                            <span className="font-bold text-emerald-700 block">
                              +{formatMoney(t.tPayer)} TND
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Att: {formatMoney(t.recette)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openTransactionReceipt(t)}
                            className="btn-ghost !p-2 text-indigo-600 hover:bg-indigo-50"
                            title="Imprimer"
                          >
                            <IconPrinter className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                (() => {
                  const targetList =
                    activeCategoryModal === 'NON_PAYES'
                      ? nonPayes
                      : activeCategoryModal === 'PAYES'
                      ? payes
                      : pasDeCaisse;

                  if (targetList.length === 0) {
                    return (
                      <div className="p-8 text-center text-xs text-slate-400">
                        Aucun chauffeur dans cette catégorie.
                      </div>
                    );
                  }

                  return (
                    <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
                      {targetList.map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                                #{d.tr}
                              </span>
                              <span className="font-bold text-slate-900">{d.nom}</span>
                              <span className="badge-slate text-[10px]">
                                {d.programmeJour || 'STAND-BY'}
                              </span>
                            </div>
                            {d.reclamation && (
                              <p className="text-[11px] text-rose-600 font-semibold mt-1">
                                {d.reclamation}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                              onClick={() => setActiveCategoryModal(null)}
                              className="btn-primary !py-1.5 !px-3 text-xs font-bold"
                            >
                              Encaisser
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-slate-100 bg-slate-50/90 px-5 py-3">
              <button
                type="button"
                onClick={() => setActiveCategoryModal(null)}
                className="btn-primary !py-1.5 text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2 : DÉTAIL DU CHAUFFEUR AU CLIC SUR LA LIGNE DU TABLEAU
      ========================================================================= */}
      {selectedDriverDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden no-print">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedDriverDetails(null)}
          />

          <div className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl z-10 overflow-hidden flex flex-col border border-slate-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="rounded-xl bg-slate-900 px-2.5 py-1 font-mono text-sm font-extrabold text-white">
                  TR {selectedDriverDetails.tr}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{selectedDriverDetails.nom}</h3>
                  <span className={getStatusBadge(selectedDriverDetails.statut)}>
                    {selectedDriverDetails.statut}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDriverDetails(null)}
                className="btn-icon !h-8 !w-8 hover:bg-slate-200"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Financial Box */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Bordereaux Saisis
                  </span>
                  <strong className="num text-sm text-slate-900 block mt-1">
                    {formatMoney(selectedDriverDetails.montantBordereau)} TND
                  </strong>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Mouvement Caisse
                  </span>
                  <strong className="num text-sm text-emerald-700 block mt-1">
                    {formatMoney(selectedDriverDetails.mouvementCaisse)} TND
                  </strong>
                </div>
                <div
                  className={`rounded-2xl p-3 border ${
                    (selectedDriverDetails.ecartBordereau || 0) === 0
                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                      : (selectedDriverDetails.ecartBordereau || 0) > 0
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
                >
                  <span className="text-[10px] font-bold uppercase block">Écart Calculé</span>
                  <strong className="num text-sm block mt-1">
                    {(selectedDriverDetails.ecartBordereau || 0) > 0 ? '+' : ''}
                    {formatMoney(selectedDriverDetails.ecartBordereau)} TND
                  </strong>
                </div>
              </div>

              {/* Informational Details */}
              <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2 bg-slate-50/50">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Circuit Affecté :</span>
                  <span className="font-bold text-slate-800">
                    {selectedDriverDetails.programmeJour || 'STAND-BY'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Série :</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDriverDetails.serie || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Sous-série :</span>
                  <span className="font-mono font-bold text-slate-800">
                    {selectedDriverDetails.sousSerie || '—'}
                  </span>
                </div>
                {selectedDriverDetails.reclamation && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-[11px] font-bold text-rose-700 block">
                      {selectedDriverDetails.reclamation}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-5 py-3">
              <button
                type="button"
                onClick={(e) => {
                  const d = selectedDriverDetails;
                  setSelectedDriverDetails(null);
                  startEditDriver(e, d);
                }}
                className="btn-ghost !py-2 text-xs font-bold"
              >
                <IconEdit className="h-4 w-4" />
                Modifier Série / Bordereau
              </button>

              <Link
                href={`/caisse?tr=${encodeURIComponent(selectedDriverDetails.tr)}`}
                onClick={() => setSelectedDriverDetails(null)}
                className="btn-primary !py-2 text-xs font-bold shadow-md"
              >
                <IconCalculator className="h-4 w-4" />
                Encaisser au Guichet
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3 : ÉDITION RAPIDE SÉRIE, SOUS-SÉRIE ET MONTANT BORDEREAU
      ========================================================================= */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden no-print">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setEditingDriver(null)}
          />

          <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl z-10 overflow-hidden flex flex-col border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-3.5">
              <h3 className="text-sm font-bold text-slate-900">
                Série & Bordereau · {editingDriver.nom} (TR {editingDriver.tr})
              </h3>
              <button
                type="button"
                onClick={() => setEditingDriver(null)}
                className="btn-icon !h-8 !w-8 hover:bg-slate-200"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDriverEdit} className="p-5 space-y-4">
              <div>
                <label className="label">Colonne Série</label>
                <input
                  type="text"
                  value={editSerie}
                  onChange={(e) => setEditSerie(e.target.value)}
                  placeholder="Ex: S-01, SER-A..."
                  className="input font-mono font-bold"
                />
              </div>

              <div>
                <label className="label">Colonne Sous-série</label>
                <input
                  type="text"
                  value={editSousSerie}
                  onChange={(e) => setEditSousSerie(e.target.value)}
                  placeholder="Ex: SS-1, 01..."
                  className="input font-mono font-bold"
                />
              </div>

              <div>
                <label className="label">Montant des Bordereaux Saisis (TND)</label>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={editMontantBordereau === 0 ? '' : editMontantBordereau}
                  onChange={(e) => setEditMontantBordereau(parseFloat(e.target.value) || 0)}
                  placeholder="0.000 TND"
                  className="input num font-bold text-base"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Ce montant sera automatiquement comparé au mouvement de caisse pour calculer l&apos;écart.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="btn-ghost !py-2 text-xs"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary !py-2 text-xs font-bold shadow-md"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
