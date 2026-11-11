'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCaisseStore } from '@/lib/store';
import { formatDateTime, formatMoney, getStatusBadge, cleanScannerTr, getUnpaidCaisses } from '@/lib/utils';
import StatCard from '@/components/StatCard';
import EmptyState from '@/components/EmptyState';
import PrintReceiptModal, { ReceiptData } from '@/components/PrintReceiptModal';
import { CashTransaction, Driver } from '@/types/caisse';
import {
  IconAlert,
  IconArrowRight,
  IconBolt,
  IconCalculator,
  IconCheck,
  IconClose,
  IconCoins,
  IconEdit,
  IconHistory,
  IconLogout,
  IconPlus,
  IconPrinter,
  IconReceipt,
  IconSearch,
  IconSheet,
  IconShield,
  IconSync,
  IconTruck,
} from '@/components/Icons';

function UnpaidCaissesSelect({ driver }: { driver: Driver }) {
  const unpaid = getUnpaidCaisses(driver);
  if (unpaid.length === 0) {
    return <span className="text-xs font-semibold text-emerald-600">✓ Aucune</span>;
  }
  return (
    <select
      defaultValue=""
      onClick={(e) => e.stopPropagation()}
      className="select !w-full !py-1 !pl-2 !pr-7 !text-xs font-semibold text-rose-700 border-rose-200 bg-rose-50"
      title="Liste des caisses non payées"
    >
      <option value="">{unpaid.length} non payée{unpaid.length > 1 ? 's' : ''} ▾</option>
      {unpaid.map((u) => (
        <option key={u.id} value="" disabled>
          {u.circuit}
          {u.date ? ` — ${new Date(u.date).toLocaleDateString('fr-FR')}` : ''}
          {u.current ? ' (aujourd’hui)' : ''}
        </option>
      ))}
    </select>
  );
}

export default function DashboardPage() {
  const currentUser = useCaisseStore((state) => state.currentUser);
  const drivers = useCaisseStore((state) => state.drivers);
  const transactions = useCaisseStore((state) => state.transactions);
  const allTransactions = useCaisseStore((state) => state.allTransactions);
  const caissesSummary = useCaisseStore((state) => state.caissesSummary);
  const updateDriver = useCaisseStore((state) => state.updateDriver);
  const executeBascule1230 = useCaisseStore((state) => state.executeBascule1230);
  const controlCaisse = useCaisseStore((state) => state.controlCaisse);
  const fetchAccountData = useCaisseStore((state) => state.fetchAccountData);
  const isSyncing = useCaisseStore((state) => state.isSyncing);

  const isSuperviseur = currentUser?.role === 'superviseur';
  const isAdmin = currentUser?.role === 'admin';
  const isSupervisorOrAdmin = isSuperviseur || isAdmin;

  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  // Modals de navigation rapide par catégorie (4 statuts chauffeurs + opérations)
  const [activeCategoryModal, setActiveCategoryModal] = useState<
    'NON_PAYES' | 'STANDBY_NON_PAYES' | 'PAYES' | 'PAS_DE_CAISSE' | 'VALIDES' | null
  >(null);

  // Modal d'inspection détaillée d'un chauffeur au clic sur la ligne
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<Driver | null>(null);

  // Modal de modification rapide de Série / Sous-série / Montant Bordereau
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [editSerie, setEditSerie] = useState('');
  const [editSousSerie, setEditSousSerie] = useState('');
  const [editMontantBordereau, setEditMontantBordereau] = useState<number>(0);

  // Filtres du tableau de bord chauffeurs
  const [tableFilter, setTableFilter] = useState<
    'ALL' | 'NON_PAYE_ACTIF' | 'STANDBY_NON_PAYE' | 'PAYE' | 'PAS DE CAISSE'
  >('ALL');
  const [tableSearch, setTableSearch] = useState('');

  // Filtres du journal temps réel sur le tableau de bord
  const [journalCaisseFilter, setJournalCaisseFilter] = useState<'ALL' | 'CRNU' | 'CRSF' | 'CRTN'>(
    'ALL'
  );
  const [journalSearch, setJournalSearch] = useState('');

  // Classification des chauffeurs selon les 4 statuts exigés (Spécification 2) :
  // 1. Chauffeur Non Payé (Circuit actif hors Stand-by)
  // 2. Chauffeur Stand-by / Non Payé
  // 3. Chauffeur Payé
  // 4. Chauffeur Sans Caisse
  const isStandbyCircuit = (prog?: string) => {
    const p = (prog || '').trim().toUpperCase();
    return !p || p === 'STAND-BY' || p === 'STANDBY';
  };

  const allNonPayes = drivers.filter((d) => d.statut === 'NON PAYE');
  const nonPayesActifs = allNonPayes.filter((d) => !isStandbyCircuit(d.programmeJour));
  const standbyNonPayes = allNonPayes.filter((d) => isStandbyCircuit(d.programmeJour));
  const payes = drivers.filter((d) => d.statut === 'PAYE');
  const pasDeCaisse = drivers.filter((d) => d.statut === 'PAS DE CAISSE');

  const totalDrivers = drivers.length;
  const activeTours = allNonPayes.length + payes.length;
  const settlementPct =
    activeTours > 0 ? Math.round((payes.length / activeTours) * 100) : totalDrivers > 0 ? 100 : 0;

  // Calcul des totaux globaux des 3 caisses (UNIQUEMENT pour Superviseur / Admin)
  const globalMontantActuel = caissesSummary.reduce((sum, c) => sum + c.montantActuel, 0);
  const globalMtEspece = caissesSummary.reduce((sum, c) => sum + c.mtEspece, 0);
  const globalVersement = caissesSummary.reduce((sum, c) => sum + c.versement, 0);
  const globalTotalCloture = caissesSummary.reduce((sum, c) => sum + c.totalCloture, 0);
  const globalTotalClotureEspece = caissesSummary.reduce((sum, c) => sum + c.totalClotureEspece, 0);
  const globalTotalClotureVer = caissesSummary.reduce((sum, c) => sum + c.totalClotureVersement, 0);

  const totalEncaisse = transactions.reduce((sum, t) => sum + t.tPayer, 0);
  const totalAttendu = transactions.reduce((sum, t) => sum + t.recette, 0);
  const ecartGlobal = totalEncaisse - totalAttendu;

  // Source de transactions : globale pour Superviseur/Admin, strictement locale pour chaque caisse CRNU/CRSF/CRTN
  const txnsSource = isSupervisorOrAdmin && allTransactions.length > 0 ? allTransactions : transactions;

  // Calcul dynamique des métriques enrichies par chauffeur (Bordereaux, Mouvements, Écarts)
  const enrichedDrivers = useMemo(() => {
    return drivers.map((d) => {
      const dTrClean = cleanScannerTr(d.tr);
      const driverTxns = txnsSource.filter(
        (t) => cleanScannerTr(t.codeChauffeur) === dTrClean
      );

      const mvtCaisse = driverTxns.reduce((sum, t) => sum + t.tPayer, 0);
      const mtBordereau =
        typeof d.montantBordereau === 'number' && d.montantBordereau > 0
          ? d.montantBordereau
          : driverTxns.reduce((sum, t) => sum + t.recette, 0);

      const ecart = Math.round((mtBordereau - mvtCaisse) * 1000) / 1000;
      const lastPaidCaisse = isSupervisorOrAdmin
        ? driverTxns.find((t) => t.status === 'PAYE')?.caisseCode
        : undefined;

      return {
        ...d,
        serie: d.serie || '—',
        sousSerie: d.sousSerie || '—',
        montantBordereau: mtBordereau,
        mouvementCaisse: mvtCaisse,
        ecartBordereau: ecart,
        paidCaisseCode: lastPaidCaisse,
      };
    });
  }, [drivers, txnsSource, isSupervisorOrAdmin]);

  // Filtrage combiné (Statut + Recherche)
  const filteredDrivers = useMemo(() => {
    return enrichedDrivers.filter((d) => {
      let matchStatus = true;
      if (tableFilter === 'NON_PAYE_ACTIF') {
        matchStatus = d.statut === 'NON PAYE' && !isStandbyCircuit(d.programmeJour);
      } else if (tableFilter === 'STANDBY_NON_PAYE') {
        matchStatus = d.statut === 'NON PAYE' && isStandbyCircuit(d.programmeJour);
      } else if (tableFilter === 'PAYE') {
        matchStatus = d.statut === 'PAYE';
      } else if (tableFilter === 'PAS DE CAISSE') {
        matchStatus = d.statut === 'PAS DE CAISSE';
      }

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

  // Filtrage du Journal Temps Réel
  const filteredJournalTransactions = useMemo(() => {
    return txnsSource.filter((t) => {
      const matchCaisse =
        !isSupervisorOrAdmin || journalCaisseFilter === 'ALL'
          ? true
          : (t.caisseCode || '').toUpperCase() === journalCaisseFilter;
      const q = journalSearch.toLowerCase().trim();
      const matchSearch = q
        ? (t.nomChauffeur || '').toLowerCase().includes(q) ||
          (t.codeChauffeur || '').toLowerCase().includes(q) ||
          (isSupervisorOrAdmin && (t.caisseCode || '').toLowerCase().includes(q)) ||
          (t.id || '').toLowerCase().includes(q)
        : true;
      return matchCaisse && matchSearch;
    });
  }, [isSupervisorOrAdmin, txnsSource, journalCaisseFilter, journalSearch]);

  const cumulBordereaux = enrichedDrivers.reduce((sum, d) => sum + (d.montantBordereau || 0), 0);
  const cumulMouvements = enrichedDrivers.reduce((sum, d) => sum + (d.mouvementCaisse || 0), 0);
  const cumulEcart = Math.round((cumulBordereaux - cumulMouvements) * 1000) / 1000;

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
      caisseName: isSupervisorOrAdmin
        ? t.caisseName || currentUser?.displayName
        : currentUser?.displayName,
      cashierName: isSupervisorOrAdmin
        ? t.caisseCode || currentUser?.username
        : currentUser?.username,
    });
  };

  const startEditDriver = (e: React.MouseEvent, d: Driver) => {
    e.stopPropagation();
    if (isSuperviseur) return;
    setEditingDriver(d);
    setEditSerie(d.serie && d.serie !== '—' ? d.serie : '');
    setEditSousSerie(d.sousSerie && d.sousSerie !== '—' ? d.sousSerie : '');
    setEditMontantBordereau(d.montantBordereau || 0);
  };

  const handleSaveDriverEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingDriver && !isSuperviseur) {
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
                {currentUser?.displayName || 'Trésorerie Centrale'} ·{' '}
                {isSupervisorOrAdmin ? 'Supervision Multi-Caisses Active' : 'Caisse Isolée Active'}
              </span>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {isSuperviseur
                ? 'Tableau de Bord Superviseur — Pilotage Temps Réel'
                : `Centre de Pilotage — ${currentUser?.displayName || 'Caisse'}`}
            </h1>
            <p className="mt-1 max-w-xl text-xs text-slate-400 sm:text-sm">
              {isSuperviseur
                ? 'Suivi en direct des recettes des caisses CRNU, CRSF et CRTN (MT Espèce & Versement), statut des chauffeurs, journal consolidé et contrôle à distance des caissiers.'
                : 'Suivi en temps réel de votre caisse, calcul automatique des bordereaux et synchronisation instantanée des statuts chauffeurs.'}
            </p>

            {/* Actions Rapides */}
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {!isSuperviseur ? (
                <>
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
                </>
              ) : (
                <>
                  <Link href="/journal" className="btn-primary !px-4 !py-2.5 !text-xs sm:!text-sm">
                    <IconReceipt className="h-4 w-4" />
                    Journal des Transactions Avancé
                  </Link>
                  <Link
                    href="/billetterie/historique"
                    className="btn border border-white/15 bg-white/10 !px-4 !py-2.5 !text-xs font-bold text-white backdrop-blur-sm hover:bg-white/15 sm:!text-sm"
                  >
                    <IconHistory className="h-4 w-4" />
                    Historique des Clôtures (CRNU · CRSF · CRTN)
                  </Link>
                  <button
                    type="button"
                    onClick={() => fetchAccountData()}
                    className="btn border border-emerald-400/30 bg-emerald-500/20 !px-3.5 !py-2.5 !text-xs font-bold text-emerald-300 hover:bg-emerald-500/30"
                  >
                    <IconSync className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                    Actualiser en Direct
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Financial Snapshot Pod */}
          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.05] p-5 backdrop-blur-md xl:w-96">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                {isSupervisorOrAdmin
                  ? 'Total Global des Caisses (CRNU+CRSF+CRTN)'
                  : `Total Encaissé (${currentUser?.caisseCode || 'Ma Caisse'})`}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                  ecartGlobal >= 0
                    ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30'
                    : 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/30'
                }`}
              >
                {isSupervisorOrAdmin
                  ? 'Temps Réel'
                  : `Écart ${ecartGlobal > 0 ? '+' : ''}${formatMoney(ecartGlobal)} TND`}
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold tracking-tight text-white tabular-nums">
                {formatMoney(isSupervisorOrAdmin ? globalMontantActuel : totalEncaisse)}
              </span>
              <span className="font-mono text-xs font-bold text-indigo-300">TND</span>
            </div>

            {isSupervisorOrAdmin && (
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-white/[0.06] p-2.5 text-xs">
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Total MT Espèce
                  </span>
                  <strong className="font-mono text-emerald-300">
                    {formatMoney(globalMtEspece)} TND
                  </strong>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase text-slate-400">
                    Total Versement
                  </span>
                  <strong className="font-mono text-sky-300">
                    {formatMoney(globalVersement)} TND
                  </strong>
                </div>
              </div>
            )}

            <div className="mt-4 border-t border-white/10 pt-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-300">Progression Flotte Globale</span>
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
                <span>{allNonPayes.length} non payé(s)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SPÉCIFICATION 1 & CONTRÔLE : SUIVI EN TEMPS RÉEL DES CAISSES CRNU, CRSF, CRTN
          (VISIBLE UNIQUEMENT POUR LE SUPERVISEUR ET L'ADMIN)
      ========================================================================= */}
      {isSupervisorOrAdmin && caissesSummary.length > 0 && (
        <div className="mb-6">
          <div className="mb-3.5 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm">
                <IconCoins className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                  1. Suivi des Recettes des Caisses en Temps Réel (CRNU · CRSF · CRTN)
                </h2>
                <p className="text-[11px] font-medium text-slate-500">
                  Montant actuel en direct, détail MT Espèce / Versement et contrôle à distance des caissiers
                </p>
              </div>
            </div>

            {/* Cumul Global des 3 Caisses */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/90 px-3.5 py-1.5 text-xs">
                <span className="font-bold text-indigo-950">Total Global Caisses : </span>
                <strong className="font-mono font-black text-indigo-700">
                  {formatMoney(globalMontantActuel)} TND
                </strong>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-1.5 text-xs">
                <span className="font-bold text-amber-950">Cumul Clôtures : </span>
                <strong className="font-mono font-black text-amber-700">
                  {formatMoney(globalTotalCloture)} TND
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            {caissesSummary.map((caisse) => (
              <div
                key={caisse.accountId}
                className={`card relative flex flex-col justify-between overflow-hidden p-5 transition-all ${
                  caisse.isBlocked
                    ? 'border-2 border-rose-300 bg-rose-50/20'
                    : 'border border-slate-200/90 bg-white'
                }`}
              >
                <div>
                  {/* Top Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-2xl font-mono text-xs font-black text-white shadow-sm ${
                          caisse.isBlocked
                            ? 'bg-rose-600'
                            : caisse.caisseCode === 'CRNU'
                            ? 'bg-indigo-600'
                            : caisse.caisseCode === 'CRSF'
                            ? 'bg-emerald-600'
                            : 'bg-sky-600'
                        }`}
                      >
                        {caisse.caisseCode}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="text-sm font-extrabold text-slate-900">
                            {caisse.displayName}
                          </h3>
                          <span className="font-mono text-[10px] font-bold text-slate-400">
                            @{caisse.username}
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-500">
                          {caisse.nbTransactions} opération{caisse.nbTransactions > 1 ? 's' : ''} aujourd&apos;hui
                        </p>
                      </div>
                    </div>

                    {/* Live Status Pill */}
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                        caisse.isBlocked
                          ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          caisse.isBlocked ? 'bg-rose-500' : 'animate-pulse bg-emerald-500'
                        }`}
                      />
                      {caisse.isBlocked ? 'Bloquée' : 'En Direct'}
                    </span>
                  </div>

                  {/* Montant Actuel en Temps Réel */}
                  <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <span>Montant Actuel Temps Réel</span>
                      <span className="font-mono text-emerald-400">{caisse.caisseCode}</span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="font-mono text-2xl font-black tracking-tight text-white tabular-nums">
                        {formatMoney(caisse.montantActuel)}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-400">TND</span>
                    </div>
                  </div>

                  {/* Détails Spécifiques par Caisse : MT Espèce & Versement */}
                  <div className="mt-3 grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                        MT Espèce
                      </span>
                      <strong className="num mt-0.5 block text-sm font-black text-emerald-900">
                        {formatMoney(caisse.mtEspece)} TND
                      </strong>
                    </div>

                    <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/50 p-3">
                      <span className="block text-[10px] font-extrabold uppercase tracking-wider text-indigo-700">
                        Versement
                      </span>
                      <strong className="num mt-0.5 block text-sm font-black text-indigo-900">
                        {formatMoney(caisse.versement)} TND
                      </strong>
                    </div>
                  </div>

                  {/* Total de Clôture Individuel de la Caisse */}
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-600">
                      Total Clôtures ({caisse.nbClotures}) :
                    </span>
                    <Link
                      href={`/billetterie/historique?caisse=${caisse.caisseCode}`}
                      className="font-mono font-extrabold text-slate-900 hover:text-indigo-600 hover:underline"
                    >
                      {formatMoney(caisse.totalCloture)} TND →
                    </Link>
                  </div>
                </div>

                {/* Gestion des Droits et des Caissiers (Contrôle à distance) */}
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      <IconShield className="h-3 w-3 text-violet-600" />
                      Contrôle à distance Caissier
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {caisse.isBlocked ? (
                      <button
                        type="button"
                        onClick={() => controlCaisse(caisse.accountId, 'unblock')}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                      >
                        <IconCheck className="h-3.5 w-3.5" />
                        Débloquer {caisse.caisseCode}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              `Bloquer temporairement la caisse ${caisse.caisseCode} à distance ? Le caissier sera immédiatement déconnecté et ne pourra plus saisir.`
                            )
                          ) {
                            controlCaisse(caisse.accountId, 'block');
                          }
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        <IconAlert className="h-3.5 w-3.5" />
                        Bloquer Caisse
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        if (
                          confirm(
                            `Forcer la déconnexion immédiate de l'utilisateur de la caisse ${caisse.caisseCode} ?`
                          )
                        ) {
                          controlCaisse(caisse.accountId, 'force_logout');
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200"
                    >
                      <IconLogout className="h-3.5 w-3.5" />
                      Déconnecter
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          SPÉCIFICATION 2 : SUIVI DU STATUT DES CHAUFFEURS (4 STATUTS VISUELS CLIQUABLES)
      ========================================================================= */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <IconTruck className="h-4 w-4" />
          </span>
          <h2 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
            {isSupervisorOrAdmin
              ? '2. Suivi du Statut des Chauffeurs (Synchronisation Temps Réel)'
              : 'Statut de la Flotte Chauffeurs (Synchronisation Temps Réel)'}
          </h2>
        </div>
        <span className="rounded-xl bg-white px-3 py-1 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-slate-200/80">
          Flotte : <strong className="font-mono text-slate-900">{totalDrivers}</strong> chauffeurs
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Chauffeur Non Payé"
          value={nonPayesActifs.length}
          icon={<IconAlert className="h-5 w-5" />}
          accent="rose"
          progress={totalDrivers > 0 ? (nonPayesActifs.length / totalDrivers) * 100 : 0}
          hint="👉 Tournées actives non réglées (Cliquer)"
          onClick={() => setActiveCategoryModal('NON_PAYES')}
        />
        <StatCard
          label="Chauffeur Stand-by / Non Payé"
          value={standbyNonPayes.length}
          icon={<IconBolt className="h-5 w-5" />}
          accent="amber"
          progress={totalDrivers > 0 ? (standbyNonPayes.length / totalDrivers) * 100 : 0}
          hint="👉 En Stand-by avec caisse non payée (Cliquer)"
          onClick={() => setActiveCategoryModal('STANDBY_NON_PAYES')}
        />
        <StatCard
          label="Chauffeur Payé"
          value={payes.length}
          icon={<IconCheck className="h-5 w-5" />}
          accent="emerald"
          progress={totalDrivers > 0 ? (payes.length / totalDrivers) * 100 : 0}
          hint="👉 Recette validée en caisse (Cliquer)"
          onClick={() => setActiveCategoryModal('PAYES')}
        />
        <StatCard
          label="Chauffeur Sans Caisse"
          value={pasDeCaisse.length}
          icon={<IconTruck className="h-5 w-5" />}
          accent="indigo"
          progress={totalDrivers > 0 ? (pasDeCaisse.length / totalDrivers) * 100 : 0}
          hint="👉 Chauffeurs sans caisse / repos (Cliquer)"
          onClick={() => setActiveCategoryModal('PAS_DE_CAISSE')}
        />
      </div>

      {/* =========================================================================
          BARRE DE REPARTITION DE LA FLOTTE AVEC LES 4 SEGMENTS CLIQUABLES
      ========================================================================= */}
      {totalDrivers > 0 && (
        <div className="card mt-5 p-4 sm:px-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
              Indicateur Visuel des 4 Statuts Chauffeurs ({totalDrivers} Chauffeurs)
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveCategoryModal('NON_PAYES')}
                className="flex items-center gap-1.5 text-rose-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                Chauffeur Non Payé ({nonPayesActifs.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryModal('STANDBY_NON_PAYES')}
                className="flex items-center gap-1.5 text-amber-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Stand-by / Non Payé ({standbyNonPayes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryModal('PAYES')}
                className="flex items-center gap-1.5 text-emerald-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Chauffeur Payé ({payes.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryModal('PAS_DE_CAISSE')}
                className="flex items-center gap-1.5 text-indigo-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                Chauffeur Sans Caisse ({pasDeCaisse.length})
              </button>
            </div>
          </div>

          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            {payes.length > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500 cursor-pointer"
                style={{ width: `${(payes.length / totalDrivers) * 100}%` }}
                onClick={() => setActiveCategoryModal('PAYES')}
                title="Chauffeur Payé"
              />
            )}
            {nonPayesActifs.length > 0 && (
              <div
                className="bg-rose-500 transition-all duration-500 cursor-pointer"
                style={{ width: `${(nonPayesActifs.length / totalDrivers) * 100}%` }}
                onClick={() => setActiveCategoryModal('NON_PAYES')}
                title="Chauffeur Non Payé"
              />
            )}
            {standbyNonPayes.length > 0 && (
              <div
                className="bg-amber-500 transition-all duration-500 cursor-pointer"
                style={{ width: `${(standbyNonPayes.length / totalDrivers) * 100}%` }}
                onClick={() => setActiveCategoryModal('STANDBY_NON_PAYES')}
                title="Chauffeur Stand-by / Non Payé"
              />
            )}
            {pasDeCaisse.length > 0 && (
              <div
                className="bg-indigo-400 transition-all duration-500 cursor-pointer"
                style={{ width: `${(pasDeCaisse.length / totalDrivers) * 100}%` }}
                onClick={() => setActiveCategoryModal('PAS_DE_CAISSE')}
                title="Chauffeur Sans Caisse"
              />
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          SECTION A (PLEINE LARGEUR) : SUIVI GLOBAL DES CHAUFFEURS & LIAISON INTER-MODULES
      ========================================================================= */}
      <div className="card mt-6 overflow-hidden">
        {/* Top Header : Title + Cumuls Financiers */}
        <div className="card-header flex-col items-stretch gap-3 border-b border-slate-100 bg-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/70">
              <IconSheet className="h-4 w-4" />
            </span>
            <div>
              <h2 className="card-title text-sm sm:text-base">
                Suivi Global des Chauffeurs & Liaison Inter-Modules
              </h2>
              <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                Synchronisation automatique en temps réel entre Programme, Mouvements et Statut Global ({filteredDrivers.length} affichés)
              </p>
            </div>
          </div>

          {/* Cumuls Pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-[11px] text-slate-700">
              Bordereaux : <strong className="text-slate-900">{formatMoney(cumulBordereaux)} TND</strong>
            </span>
            <span className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-1.5 font-mono text-[11px] text-emerald-800">
              Mouvements : <strong className="text-emerald-900">{formatMoney(cumulMouvements)} TND</strong>
            </span>
            <span
              className={`rounded-xl px-3 py-1.5 font-mono text-[11px] font-bold ${
                cumulEcart === 0
                  ? 'border border-slate-200 bg-slate-50 text-slate-700'
                  : cumulEcart > 0
                  ? 'border border-rose-200 bg-rose-50 text-rose-700'
                  : 'border border-indigo-200 bg-indigo-50 text-indigo-700'
              }`}
            >
              Écart : {cumulEcart > 0 ? '+' : ''}
              {formatMoney(cumulEcart)} TND
            </span>
          </div>
        </div>

        {/* Second Toolbar : Filter Tabs + Search Input */}
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-3.5 sm:px-5 lg:flex-row lg:items-center">
          {/* Onglets Filtre Rapide selon les 4 Statuts */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTableFilter('ALL')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                tableFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              Tous ({totalDrivers})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('NON_PAYE_ACTIF')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                tableFilter === 'NON_PAYE_ACTIF'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 border border-rose-200/60 hover:bg-rose-100'
              }`}
            >
              Non Payé ({nonPayesActifs.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('STANDBY_NON_PAYE')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                tableFilter === 'STANDBY_NON_PAYE'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100'
              }`}
            >
              Stand-by / Non Payé ({standbyNonPayes.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('PAYE')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                tableFilter === 'PAYE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100'
              }`}
            >
              Payé ({payes.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('PAS DE CAISSE')}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                tableFilter === 'PAS DE CAISSE'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200/60 hover:bg-indigo-100'
              }`}
            >
              Sans Caisse ({pasDeCaisse.length})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full lg:w-80">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Rechercher chauffeur, TR, série, circuit..."
              className="input !pl-8 !py-1.5 text-xs font-medium w-full bg-white"
            />
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
            <div className="divide-y divide-slate-100 max-h-[520px] overflow-y-auto sm:hidden">
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
                        Programme du jour
                      </span>
                      <span className="font-semibold text-slate-800">
                        {d.programmeJour || 'STAND-BY'}
                      </span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">
                        Caisses non payées
                      </span>
                      <UnpaidCaissesSelect driver={d} />
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

                    {!isSuperviseur && (
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
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View with Sticky Header & Clean Scroll (hidden sm:block) */}
            <div className="table-wrap hidden max-h-[520px] overflow-y-auto sm:block">
              <table className="data-table">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="w-20">Code TR</th>
                    <th>Chauffeur</th>
                    <th className="w-32">Programme du jour</th>
                    <th className="w-44">Caisses non payées</th>
                    <th className="!text-right w-32">Bordereaux (TND)</th>
                    <th className="!text-right w-32">Mvt Caisse (TND)</th>
                    <th className="!text-right w-32">Écart (TND)</th>
                    <th className="w-32">Circuit</th>
                    <th className="w-36">Statut</th>
                    {!isSuperviseur && <th className="!text-center w-32">Actions</th>}
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
                      <td>
                        <span className="inline-flex rounded-lg bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-extrabold text-white">
                          #{d.tr}
                        </span>
                      </td>
                      <td>
                        <p className="font-bold text-slate-900" title={d.nom}>
                          {d.nom}
                        </p>
                      </td>
                      <td>
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {d.programmeJour || 'STAND-BY'}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <UnpaidCaissesSelect driver={d} />
                      </td>
                      <td className="text-right num font-black text-xs text-slate-900">
                        {formatMoney(d.montantBordereau)}
                      </td>
                      <td className="text-right num font-black text-xs text-emerald-700">
                        {formatMoney(d.mouvementCaisse)}
                      </td>
                      <td className="text-right">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-xs font-black ${
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
                      <td>
                        <span className="badge-slate truncate" title={d.programmeJour}>
                          {d.programmeJour || 'STAND-BY'}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-col items-start gap-0.5">
                          <span className={getStatusBadge(d.statut)}>
                            {d.statut === 'NON PAYE' && isStandbyCircuit(d.programmeJour)
                              ? 'STAND-BY / NON PAYÉ'
                              : d.statut === 'PAS DE CAISSE'
                              ? 'SANS CAISSE'
                              : d.statut}
                          </span>
                          {isSupervisorOrAdmin && d.paidCaisseCode && d.statut === 'PAYE' && (
                            <span className="font-mono text-[9px] font-bold text-emerald-700">
                              Réglé : {d.paidCaisseCode}
                            </span>
                          )}
                        </div>
                      </td>
                      {!isSuperviseur && (
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
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* =========================================================================
          SECTION B (2 COLONNES ÉQUILIBRÉES CÔTE À CÔTE) :
          - POUR SUPERVISEUR / ADMIN : HISTORIQUE DE CLÔTURE + JOURNAL DES CAISSES
          - POUR CAISSES NORMALES (CRNU, CRSF, CRTN) : MODULES OPÉRATIONNELS + REÇUS DE LA CAISSE
      ========================================================================= */}
      {isSupervisorOrAdmin ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Colonne 1 : Spécification 5 — Historique de Clôture (CRNU, CRSF, CRTN & Global) */}
          <div className="card flex flex-col justify-between overflow-hidden">
            <div>
              <div className="card-header border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/70">
                    <IconHistory className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="card-title text-sm sm:text-base">
                      3. Historique de Clôture (CRNU · CRSF · CRTN)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Totaux individuels par caisse et montant global cumulé
                    </p>
                  </div>
                </div>
                <Link
                  href="/billetterie/historique"
                  className="btn-ghost !py-1.5 !px-3 text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50/50"
                >
                  Ouvrir l&apos;Historique →
                </Link>
              </div>

              <div className="p-5 space-y-4">
                {/* Montant Global de Clôture */}
                <div className="rounded-2xl bg-slate-900 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Montant Global de Clôture (CRNU + CRSF + CRTN)
                    </span>
                    <span className="rounded-full bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                      Cumul Global
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-2xl font-black text-amber-400">
                    {formatMoney(globalTotalCloture)}{' '}
                    <span className="text-xs font-normal text-slate-300">TND</span>
                  </p>
                  <div className="mt-2.5 flex items-center gap-4 border-t border-white/10 pt-2.5 text-xs text-slate-300">
                    <span>
                      MT Espèce :{' '}
                      <strong className="font-mono text-emerald-300">
                        {formatMoney(globalTotalClotureEspece)} TND
                      </strong>
                    </span>
                    <span>
                      Versement :{' '}
                      <strong className="font-mono text-sky-300">
                        {formatMoney(globalTotalClotureVer)} TND
                      </strong>
                    </span>
                  </div>
                </div>

                {/* Détail Individuel pour chaque Caisse : CRNU, CRSF et CRTN */}
                <div className="space-y-2.5">
                  {caissesSummary.map((c) => (
                    <Link
                      key={c.accountId}
                      href={`/billetterie/historique?caisse=${c.caisseCode}`}
                      className="group flex items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5 text-xs transition-all hover:border-indigo-300 hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-xl font-mono text-xs font-black text-white ${
                            c.caisseCode === 'CRNU'
                              ? 'bg-indigo-600'
                              : c.caisseCode === 'CRSF'
                              ? 'bg-emerald-600'
                              : 'bg-sky-600'
                          }`}
                        >
                          {c.caisseCode}
                        </span>
                        <div>
                          <p className="font-extrabold text-slate-900 text-sm">
                            {c.displayName}
                          </p>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Esp: <strong className="font-mono text-emerald-700">{formatMoney(c.totalClotureEspece)}</strong> · Ver: <strong className="font-mono text-indigo-700">{formatMoney(c.totalClotureVersement)}</strong>
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-sm font-black text-slate-900 block">
                          {formatMoney(c.totalCloture)} TND
                        </span>
                        <span className="text-[10.5px] font-semibold text-indigo-600 group-hover:underline">
                          {c.nbClotures} clôture{c.nbClotures > 1 ? 's' : ''} · Voir détail →
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-right">
              <Link
                href="/billetterie/historique"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                <span>Consulter et imprimer tous les PV de clôture</span>
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Colonne 2 : Spécification 3 & 6 — Journal des Caisses en Temps Réel (CRNU, CRSF, CRTN) */}
          <div className="card flex flex-col justify-between overflow-hidden">
            <div>
              <div className="card-header border-b border-slate-100 bg-white">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70">
                    <IconReceipt className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="card-title text-sm sm:text-base">
                      4. Journal des Caisses (CRNU · CRSF · CRTN)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Transactions de la journée en temps réel ({filteredJournalTransactions.length})
                    </p>
                  </div>
                </div>
                <Link
                  href="/journal"
                  className="btn-ghost !py-1.5 !px-3 text-xs font-bold text-emerald-700 border border-emerald-200 bg-emerald-50/50"
                >
                  Fenêtre Dédiée →
                </Link>
              </div>

              {/* Filtre par Caisse & Recherche Rapide */}
              <div className="border-b border-slate-100 bg-slate-50/70 p-3.5 space-y-2.5">
                <div className="grid grid-cols-4 gap-1.5">
                  {(['ALL', 'CRNU', 'CRSF', 'CRTN'] as const).map((code) => (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setJournalCaisseFilter(code)}
                      className={`rounded-xl py-1.5 text-xs font-extrabold transition-all ${
                        journalCaisseFilter === code
                          ? 'bg-slate-900 text-white shadow-sm'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {code === 'ALL' ? 'Toutes' : code}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={journalSearch}
                    onChange={(e) => setJournalSearch(e.target.value)}
                    placeholder="Rechercher une transaction par chauffeur, TR, caisse..."
                    className="input !pl-8 !py-1.5 text-xs bg-white"
                  />
                </div>
              </div>

              {filteredJournalTransactions.length === 0 ? (
                <div className="p-10 text-center text-xs font-medium text-slate-400">
                  Aucune transaction enregistrée pour ce filtre aujourd&apos;hui.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[340px] overflow-y-auto">
                  {filteredJournalTransactions.slice(0, 15).map((t) => {
                    const mtEspece =
                      typeof t.mtEspece === 'number'
                        ? t.mtEspece
                        : Math.round((t.tPayer - t.versement) * 1000) / 1000;
                    return (
                      <div
                        key={`${t.accountId || ''}-${t.id}`}
                        className="flex items-center justify-between gap-2 px-4 py-3 text-xs transition-colors hover:bg-slate-50/80"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[9px] font-black text-white">
                              {t.caisseCode || 'CAISSE'}
                            </span>
                            <p className="truncate font-bold text-slate-900">
                              {t.nomChauffeur} (TR {t.codeChauffeur})
                            </p>
                          </div>
                          <p className="mt-0.5 text-[10.5px] text-slate-400">
                            {formatDateTime(t.date)} · Esp: <strong>{formatMoney(mtEspece)}</strong> | Ver: <strong>{formatMoney(t.versement)}</strong>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
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
                            title="Consulter / Imprimer Reçu"
                          >
                            <IconPrinter className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-right">
              <Link
                href="/journal"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                <span>Ouvrir le Journal Avancé & Archives de Clôture</span>
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : (
        /* VUE CAISSE NORMALE (CRNU, CRSF ou CRTN) : STRICTEMENT ISOLÉE À SA PROPRE CAISSE */
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Colonne 1 : Modules Opérationnels de la Caisse */}
          <div className="card p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                Modules Opérationnels — {currentUser?.displayName}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Accès rapide aux outils de votre caisse ({currentUser?.caisseCode || currentUser?.username?.toUpperCase()})
              </p>

              <div className="mt-4 space-y-2.5">
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
                      <p className="text-sm font-bold text-slate-900">Comptage Billetterie & Clôture</p>
                      <p className="text-[11px] text-slate-500">Inventaire coffre & clôture journalière</p>
                    </div>
                  </div>
                  <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-amber-600" />
                </Link>

                <Link
                  href="/billetterie/historique"
                  className="group flex items-center justify-between rounded-2xl border border-slate-200/90 p-3.5 transition-all hover:border-emerald-300 hover:bg-emerald-50/35"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70 transition-transform group-hover:scale-105">
                      <IconHistory className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Historique de mes Clôtures</p>
                      <p className="text-[11px] text-slate-500">Consultation et impression des PV A4</p>
                    </div>
                  </div>
                  <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                </Link>
              </div>
            </div>
          </div>

          {/* Colonne 2 : Derniers Reçus Validés de cette Caisse uniquement */}
          <div className="card overflow-hidden flex flex-col justify-between">
            <div>
              <div className="card-header !py-3.5">
                <div>
                  <h3 className="card-title text-sm sm:text-base">
                    Derniers Reçus Validés ({currentUser?.displayName})
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Opérations enregistrées dans votre caisse aujourd&apos;hui
                  </p>
                </div>
                <Link
                  href="/journal"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  Mon Journal →
                </Link>
              </div>

              {transactions.length === 0 ? (
                <div className="p-10 text-center text-xs font-medium text-slate-400">
                  Aucun reçu d&apos;encaissement validé dans votre caisse pour le moment.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                  {transactions.slice(0, 10).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2 px-4 py-3 text-xs transition-colors hover:bg-slate-50/80"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-900">
                          {t.nomChauffeur} (TR {t.codeChauffeur})
                        </p>
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

            <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 text-right">
              <Link
                href="/journal"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700"
              >
                <span>Voir tout le journal de ma caisse</span>
                <IconArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1 : LES 4 STATUTS CHAUFFEURS & OPÉRATIONS VALIDÉES
      ========================================================================= */}
      {activeCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden no-print">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={() => setActiveCategoryModal(null)}
          />

          <div className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl z-10 overflow-hidden flex flex-col max-h-[85vh] border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-5 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {activeCategoryModal === 'NON_PAYES' &&
                    '🔴 Chauffeur Non Payé (Circuits Actifs)'}
                  {activeCategoryModal === 'STANDBY_NON_PAYES' &&
                    '🟠 Chauffeur Stand-by / Non Payé'}
                  {activeCategoryModal === 'PAYES' &&
                    '🟢 Chauffeur Payé (Recettes Validées)'}
                  {activeCategoryModal === 'PAS_DE_CAISSE' &&
                    '🔵 Chauffeur Sans Caisse'}
                  {activeCategoryModal === 'VALIDES' &&
                    '📄 Opérations de Caisse Validées'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronisé en temps réel
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
                            {isSupervisorOrAdmin && (
                              <span className="badge-indigo font-mono font-bold">
                                {t.caisseCode || 'CAISSE'}
                              </span>
                            )}
                            <span className="badge-slate font-mono font-bold">
                              TR {t.codeChauffeur}
                            </span>
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
                      ? nonPayesActifs
                      : activeCategoryModal === 'STANDBY_NON_PAYES'
                      ? standbyNonPayes
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
                          {!isSuperviseur && (
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                                onClick={() => setActiveCategoryModal(null)}
                                className="btn-primary !py-1.5 !px-3 text-xs font-bold"
                              >
                                Encaisser
                              </Link>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>

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

            <div className="p-5 space-y-4 text-xs">
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

              <div className="rounded-2xl border border-slate-200 p-3.5 space-y-2 bg-slate-50/50">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Circuit Affecté :</span>
                  <span className="font-bold text-slate-800">
                    {selectedDriverDetails.programmeJour || 'STAND-BY'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500 font-medium">Caisses non payées :</span>
                  <span className="font-mono font-bold text-rose-700 text-right">
                    {getUnpaidCaisses(selectedDriverDetails).length === 0
                      ? 'Aucune'
                      : getUnpaidCaisses(selectedDriverDetails)
                          .map((u) => u.circuit)
                          .join(', ')}
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

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-5 py-3">
              {!isSuperviseur ? (
                <>
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
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedDriverDetails(null)}
                  className="btn-primary ml-auto !py-2 text-xs font-bold"
                >
                  Fermer
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3 : ÉDITION RAPIDE SÉRIE, SOUS-SÉRIE ET MONTANT BORDEREAU
      ========================================================================= */}
      {editingDriver && !isSuperviseur && (
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
