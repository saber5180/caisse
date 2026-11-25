'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCaisseStore } from '@/lib/store';
import {
  formatDateTime,
  formatMoney,
  cleanScannerTr,
  calculateRetardFrom1230,
  isJourPaye,
  normalizeCaisseCode,
  shiftStartMs,
  withPaidCaisse,
} from '@/lib/utils';
import StatCard from '@/components/StatCard';
import SheetModal from '@/components/SheetModal';
import EmptyState from '@/components/EmptyState';
import PrintReceiptModal, { ReceiptData } from '@/components/PrintReceiptModal';
import { CashTransaction, Driver } from '@/types/caisse';
import {
  IconAlert,
  IconArrowRight,
  IconBolt,
  IconCalculator,
  IconCheck,
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

function UnpaidCaissesSelect({
  driver,
  allDrivers,
  isSuperviseur,
}: {
  driver: Driver;
  allDrivers: Driver[];
  isSuperviseur?: boolean;
}) {
  const unpaid = (driver.programmeHistorique || []).filter((entry) => !entry.paid);
  const standby = !driver.programmeJour || ['STAND-BY', 'STANDBY'].includes(driver.programmeJour.trim().toUpperCase());
  const dayStillOpen =
    !standby &&
    !isJourPaye(driver) &&
    driver.statut !== 'PAYE' &&
    !calculateRetardFrom1230(driver.programmeDate || driver.dateDerniere).isOverdue;
  if (unpaid.length === 0) {
    if (dayStillOpen) {
      return (
        <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-1 text-[11px] font-semibold text-sky-800">
          En cours
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200/90 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-bold text-emerald-700 whitespace-nowrap">
        ✓ 0 caisse impayée
      </span>
    );
  }
  return (
    <select
      value=""
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const targetTr = e.target.value;
        if (targetTr && !isSuperviseur && typeof window !== 'undefined') {
          window.location.href = `/caisse?tr=${encodeURIComponent(targetTr)}`;
        }
      }}
      className="select !h-8 !w-full !max-w-full !rounded-md !py-1 !pl-2 !pr-7 !text-[11px] font-medium text-rose-800 border-rose-200 bg-rose-50 cursor-pointer"
      title="Liste des caisses non payées de ce Code TR"
    >
      <option value="">
        ⚠️ {unpaid.length} impayée{unpaid.length > 1 ? 's' : ''} · {unpaid[0].circuit}
      </option>
      {unpaid.map((u, idx) => (
        <option key={`${driver.id}-${u.id}-${idx}`} value={driver.tr} className="bg-white font-semibold text-slate-900">
          {idx + 1}. {u.circuit || 'ANCIENNE CAISSE'} (TR {driver.tr}) — {u.date ? new Date(u.date).toLocaleDateString('fr-FR') : '—'}
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
  const billetterieItems = useCaisseStore((state) => state.billetterieItems);
  const srfMoins = useCaisseStore((state) => state.srfMoins);
  const ver = useCaisseStore((state) => state.ver);
  const recettePhysiqueTheorique = useCaisseStore((state) => state.recettePhysiqueTheorique);
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
  const [categoryQuery, setCategoryQuery] = useState('');

  // Modal d'inspection détaillée d'un chauffeur au clic sur la ligne
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<Driver | null>(null);

  // Modal de modification rapide de Série / Sous-série / Montant Bordereau
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [heroSerie, setHeroSerie] = useState('');
  const [heroSousSerie, setHeroSousSerie] = useState('');
  const [heroSerie2, setHeroSerie2] = useState('');
  const [heroSerie3, setHeroSerie3] = useState('');
  const [ecartValeurInput, setEcartValeurInput] = useState('');
  const [heroLoaded, setHeroLoaded] = useState(false);
  // Séries / Sous-série / Valeur : enregistrées en base de données, propres à chaque compte caisse
  const heroKey = currentUser?.id || '';
  useEffect(() => {
    if (!heroKey) return;
    let cancelled = false;
    setHeroLoaded(false);
    fetch('/api/caisse/hero', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.success) return;
        setHeroSerie(j.data.serie1 || '');
        setHeroSerie2(j.data.serie2 || '');
        setHeroSerie3(j.data.serie3 || '');
        setHeroSousSerie(j.data.sousSerie || '');
        setEcartValeurInput(j.data.valeur || '');
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHeroLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [heroKey]);
  useEffect(() => {
    if (!heroLoaded || !heroKey || isSuperviseur) return;
    const timer = setTimeout(() => {
      fetch('/api/caisse/hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serie1: heroSerie,
          serie2: heroSerie2,
          serie3: heroSerie3,
          sousSerie: heroSousSerie,
          valeur: ecartValeurInput,
        }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [heroLoaded, heroKey, isSuperviseur, heroSerie, heroSerie2, heroSerie3, heroSousSerie, ecartValeurInput]);
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

  const hasHistoryDebt = (d: Driver) => (d.programmeHistorique || []).some((entry) => !entry.paid);
  const dayStillOpen = (d: Driver) => {
    if (isStandbyCircuit(d.programmeJour)) return false;
    if (isJourPaye(d) || d.statut === 'PAYE') return false;
    return !calculateRetardFrom1230(d.programmeDate || d.dateDerniere).isOverdue;
  };
  const dayLate = (d: Driver) =>
    !isStandbyCircuit(d.programmeJour) &&
    !isJourPaye(d) &&
    d.statut !== 'PAYE' &&
    calculateRetardFrom1230(d.programmeDate || d.dateDerniere).isOverdue;
  const totalDrivers = drivers.length;

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
        isSupervisorOrAdmin && typeof d.montantBordereau === 'number' && d.montantBordereau > 0
          ? d.montantBordereau
          : driverTxns.reduce((sum, t) => sum + t.recette, 0);

      const ecart = Math.round((mvtCaisse - mtBordereau) * 1000) / 1000;
      const lastPaidCaisse =
        d.caissePaye || driverTxns[0]?.caisseCode;

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

  const shiftStart = shiftStartMs();
  const paidTodayByTr = new Map<string, string>();
  for (const t of txnsSource) {
    if (!t?.date || new Date(t.date).getTime() < shiftStart) continue;
    const tr = cleanScannerTr(t.codeChauffeur).toUpperCase();
    if (!tr || paidTodayByTr.has(tr)) continue;
    paidTodayByTr.set(tr, normalizeCaisseCode(t.caisseCode));
  }
  const paidThisDay = (d: Driver) => {
    const tr = cleanScannerTr(d.tr).toUpperCase();
    if (paidTodayByTr.has(tr)) return true;
    if (!d.payeLe) return false;
    return new Date(d.payeLe).getTime() >= shiftStart;
  };
  const caisseOf = (d: Driver & { paidCaisseCode?: string }) => {
    const fromReceipt = paidTodayByTr.get(cleanScannerTr(d.tr).toUpperCase());
    if (fromReceipt) return fromReceipt;
    if (!d.payeLe || new Date(d.payeLe).getTime() < shiftStart) return '';
    return normalizeCaisseCode(d.caissePaye || d.paidCaisseCode);
  };
  const nonPayesActifs = drivers.filter(
    (d) => !paidThisDay(d) && !isStandbyCircuit(d.programmeJour) && (hasHistoryDebt(d) || dayLate(d))
  );
  const standbyNonPayes = drivers.filter(
    (d) => !paidThisDay(d) && isStandbyCircuit(d.programmeJour) && hasHistoryDebt(d)
  );
  const enCours = drivers.filter((d) => !paidThisDay(d) && !hasHistoryDebt(d) && dayStillOpen(d));
  const pasDeCaisse = drivers.filter(
    (d) => !paidThisDay(d) && !hasHistoryDebt(d) && !dayStillOpen(d) && !dayLate(d)
  );
  const allNonPayes = [...nonPayesActifs, ...standbyNonPayes];
  const payes = enrichedDrivers.filter((d) => paidThisDay(d));
  const rowStatut = (d: Driver & { paidCaisseCode?: string }) => {
    if (paidThisDay(d)) return withPaidCaisse('Payé', caisseOf(d));
    if (hasHistoryDebt(d)) return isStandbyCircuit(d.programmeJour) ? 'Stand-by' : 'Non payé';
    if (isStandbyCircuit(d.programmeJour) || d.statut === 'PAS DE CAISSE') return 'Sans caisse';
    if (dayStillOpen(d)) return 'En cours';
    return 'Non payé';
  };
  const settlementPct =
    totalDrivers > 0 ? Math.round((payes.length / totalDrivers) * 100) : 0;

  // Filtrage combiné (Statut + Recherche)
  const filteredDrivers = useMemo(() => {
    return enrichedDrivers.filter((d) => {
      let matchStatus = true;
      const historyDebt = (d.programmeHistorique || []).some((entry) => !entry.paid);
      const openDay =
        !isStandbyCircuit(d.programmeJour) &&
        !isJourPaye(d) &&
        d.statut !== 'PAYE' &&
        !calculateRetardFrom1230(d.programmeDate || d.dateDerniere).isOverdue;
      const lateDay =
        !isStandbyCircuit(d.programmeJour) &&
        !isJourPaye(d) &&
        d.statut !== 'PAYE' &&
        calculateRetardFrom1230(d.programmeDate || d.dateDerniere).isOverdue;
      if (tableFilter === 'NON_PAYE_ACTIF') {
        matchStatus = !isStandbyCircuit(d.programmeJour) && (historyDebt || lateDay);
      } else if (tableFilter === 'STANDBY_NON_PAYE') {
        matchStatus = isStandbyCircuit(d.programmeJour) && historyDebt;
      } else if (tableFilter === 'PAYE') {
        matchStatus = paidThisDay(d);
      } else if (tableFilter === 'PAS DE CAISSE') {
        matchStatus =
          !historyDebt && !openDay && !lateDay && d.statut !== 'PAYE' && !isJourPaye(d);
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

  // Caisse isolée : uniquement la journée encore ouverte. La clôture remet ces cumuls à 0.
  const sheetCoupures = billetterieItems.reduce(
    (sum, item) => sum + (Number(item.nombre) || 0) * (Number(item.valeur) || 0),
    0
  );
  const sheetMouvements =
    Math.round((sheetCoupures + (srfMoins || 0) + (ver || 0)) * 1000) / 1000;
  const sheetBordereaux = Math.round((recettePhysiqueTheorique || 0) * 1000) / 1000;
  const txnBordereaux =
    Math.round(txnsSource.reduce((sum, t) => sum + (t.recette || 0), 0) * 1000) / 1000;
  const txnMouvements =
    Math.round(txnsSource.reduce((sum, t) => sum + (t.tPayer || 0), 0) * 1000) / 1000;
  const liveSheet = sheetMouvements > 0 || sheetBordereaux > 0;
  const openBordereaux = liveSheet ? sheetBordereaux : txnBordereaux;
  const cumulBordereaux = isSupervisorOrAdmin
    ? enrichedDrivers.reduce((sum, d) => sum + (d.montantBordereau || 0), 0)
    : openBordereaux;
  const cumulMouvements = isSupervisorOrAdmin
    ? enrichedDrivers.reduce((sum, d) => sum + (d.mouvementCaisse || 0), 0)
    : liveSheet
      ? sheetMouvements
      : txnMouvements;
  const cumulEcart = Math.round((cumulMouvements - cumulBordereaux) * 1000) / 1000;
  const ecartDiff = Math.round((cumulBordereaux - (parseFloat(ecartValeurInput) || 0)) * 1000) / 1000;

  const superviseurCaisseRows = (['CRNU', 'CRSF', 'CRTN'] as const).map((code) => {
    const found = caissesSummary.find((c) => c.caisseCode === code);
    return {
      code,
      name: found?.displayName || `Caisse ${code}`,
      bordereaux: found?.recetteAttendue || 0,
      mouvements: found?.montantActuel || 0,
    };
  });
  const superviseurTotalBordereaux = superviseurCaisseRows.reduce((sum, row) => sum + row.bordereaux, 0);
  const superviseurTotalMouvements = superviseurCaisseRows.reduce((sum, row) => sum + row.mouvements, 0);

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

  const openCategoryModal = (
    kind: 'NON_PAYES' | 'STANDBY_NON_PAYES' | 'PAYES' | 'PAS_DE_CAISSE' | 'VALIDES'
  ) => {
    setCategoryQuery('');
    setActiveCategoryModal(kind);
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
      <div className="card-dark bg-grid-pattern relative mb-6 overflow-hidden p-5 sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative z-10">
          {/* Identité de la caisse */}
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                {isSupervisorOrAdmin ? 'Supervision Multi-Caisses Active' : 'Caisse Isolée Active'}
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                {currentUser?.displayName || 'Trésorerie Centrale'}
              </h1>
              <p className="mt-1 text-sm font-medium italic text-indigo-200/90 sm:text-base">
                « Précision au centime, confiance à chaque encaissement. »
              </p>
            </div>
          </div>

          {isSuperviseur ? (
            <section className="mt-5 rounded-2xl border border-white/10 bg-white/[0.05] p-4 sm:p-5">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">
                Cumuls Bordereaux &amp; Mouvements (en direct)
              </h2>
              <div className="mt-3 space-y-2 sm:hidden">
                {superviseurCaisseRows.map((row) => (
                  <div key={row.code} className="rounded-xl border border-white/10 bg-white/[0.06] p-3">
                    <p className="text-sm font-black text-white">{row.code}</p>
                    <p className="text-[11px] text-slate-400">{row.name}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Bordereaux</span>
                        <strong className="font-mono text-sm font-black text-white">{formatMoney(row.bordereaux)}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300">Mouvements</span>
                        <strong className="font-mono text-sm font-black text-emerald-200">{formatMoney(row.mouvements)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-white/15 bg-white/[0.08] p-3">
                  <p className="text-sm font-black uppercase text-white">Total global</p>
                  <p className="text-[11px] text-slate-400">CRNU + CRSF + CRTN</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <strong className="font-mono text-sm font-black text-white">{formatMoney(superviseurTotalBordereaux)}</strong>
                    <strong className="font-mono text-sm font-black text-emerald-200">{formatMoney(superviseurTotalMouvements)}</strong>
                  </div>
                </div>
              </div>
              <div className="mt-3 hidden overflow-x-auto sm:block">
                <table className="w-full border-separate border-spacing-0 text-left">
                  <thead>
                    <tr className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                      <th className="border-b border-white/10 px-3 py-2.5">Caisse</th>
                      <th className="border-b border-white/10 px-3 py-2.5 text-right">Bordereaux</th>
                      <th className="border-b border-white/10 px-3 py-2.5 text-right">Mouvements</th>
                    </tr>
                  </thead>
                  <tbody>
                    {superviseurCaisseRows.map((row) => (
                      <tr key={row.code}>
                        <td className="border-b border-white/10 px-3 py-3 text-sm font-bold text-white">
                          {row.name}
                        </td>
                        <td className="border-b border-white/10 px-3 py-3 text-right font-mono text-sm font-extrabold tabular-nums text-white">
                          {formatMoney(row.bordereaux)} TND
                        </td>
                        <td className="border-b border-white/10 px-3 py-3 text-right font-mono text-sm font-extrabold tabular-nums text-emerald-200">
                          {formatMoney(row.mouvements)} TND
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-white/[0.06]">
                      <td className="px-3 py-3.5">
                        <span className="block text-sm font-black uppercase tracking-wide text-white">Total global</span>
                        <span className="text-[11px] font-semibold text-slate-400">CRNU + CRSF + CRTN</span>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Bordereaux global</span>
                        <strong className="font-mono text-lg font-black tabular-nums text-white">
                          {formatMoney(superviseurTotalBordereaux)} TND
                        </strong>
                      </td>
                      <td className="px-3 py-3.5 text-right">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-300">Mouvement global</span>
                        <strong className="font-mono text-lg font-black tabular-nums text-emerald-200">
                          {formatMoney(superviseurTotalMouvements)} TND
                        </strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ) : (
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-12">
            {/* Panneau Séries */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 sm:p-5 xl:col-span-5">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Séries &amp; Sous-série</h2>
              <div className="mt-3 space-y-2.5">
                {[
                  { id: 'hero-serie-1', label: 'Série 1', v: heroSerie, set: setHeroSerie },
                  { id: 'hero-serie-2', label: 'Série 2', v: heroSerie2, set: setHeroSerie2 },
                  { id: 'hero-serie-3', label: 'Série 3', v: heroSerie3, set: setHeroSerie3 },
                  { id: 'hero-sous-serie', label: 'Sous-série', v: heroSousSerie, set: setHeroSousSerie },
                ].map((f, i) => (
                  <div key={f.id} className={`flex items-center gap-3 ${i === 3 ? 'border-t border-white/10 pt-3' : ''}`}>
                    <label htmlFor={f.id} className="w-24 shrink-0 text-xs font-extrabold uppercase tracking-wider text-indigo-300 sm:w-28 sm:text-[13px]">
                      {f.label}
                    </label>
                    <input
                      id={f.id}
                      type="text"
                      value={f.v}
                      onChange={(e) => f.set(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950/50 px-3.5 py-2.5 text-lg font-extrabold tracking-wide text-white placeholder-slate-500 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 sm:text-xl"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Panneau Cumuls */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.05] p-4 sm:p-5 xl:col-span-7">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">Cumuls Bordereaux &amp; Mouvements</h2>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Bordereaux</span>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <strong className="font-mono text-xl font-extrabold tabular-nums text-white sm:text-2xl">{formatMoney(cumulBordereaux)}</strong>
                    <span className="font-mono text-[11px] font-bold text-indigo-300">TND</span>
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-emerald-300">Mouvements</span>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <strong className="font-mono text-xl font-extrabold tabular-nums text-emerald-200 sm:text-2xl">{formatMoney(cumulMouvements)}</strong>
                    <span className="font-mono text-[11px] font-bold text-emerald-300">TND</span>
                  </div>
                </div>
                <div className={`rounded-xl border p-3.5 ${cumulEcart === 0 ? 'border-white/10 bg-white/[0.06]' : cumulEcart > 0 ? 'border-rose-400/30 bg-rose-500/15' : 'border-indigo-400/30 bg-indigo-500/15'}`}>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-300">Écart</span>
                  <div className="mt-1.5 flex items-baseline gap-1.5">
                    <strong className={`font-mono text-xl font-extrabold tabular-nums sm:text-2xl ${cumulEcart === 0 ? 'text-white' : cumulEcart > 0 ? 'text-rose-300' : 'text-indigo-200'}`}>
                      {cumulEcart > 0 ? '+' : ''}{formatMoney(cumulEcart)}
                    </strong>
                    <span className="font-mono text-[11px] font-bold text-slate-400">TND</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
                  <label htmlFor="ecart-valeur" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Valeur à soustraire</label>
                  <input
                    id="ecart-valeur"
                    type="number"
                    step="0.001"
                    value={ecartValeurInput}
                    onChange={(e) => setEcartValeurInput(e.target.value)}
                    placeholder="0.000"
                    className="mt-1.5 w-full rounded-lg border border-white/15 bg-slate-950/50 px-3 py-2 font-mono text-lg font-bold text-white placeholder-slate-500 transition focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20"
                  />
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.06] p-3.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Différence (Bordereaux − Valeur)</span>
                  <div className="mt-2 flex items-baseline gap-1.5">
                    <strong className={`font-mono text-xl font-extrabold tabular-nums sm:text-2xl ${ecartDiff === 0 ? 'text-white' : ecartDiff > 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                      {ecartDiff > 0 ? '+' : ''}{formatMoney(ecartDiff)}
                    </strong>
                    <span className="font-mono text-[11px] font-bold text-slate-400">TND</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
          )}
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
                <h2 className="truncate text-sm font-semibold text-slate-900">
                  Caisses en direct
                </h2>
                <p className="truncate text-xs text-slate-500">
                  CRNU, CRSF et CRTN
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
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-xs font-medium text-white hover:bg-emerald-700"
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
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100"
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
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
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
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="truncate text-base font-bold tracking-tight text-slate-900">
          Statut de la flotte
        </h2>
        <span className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">
          {totalDrivers} chauffeurs
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Non payé"
          value={nonPayesActifs.length}
          icon={<IconAlert className="h-4 w-4" />}
          accent="rose"
          progress={totalDrivers > 0 ? (nonPayesActifs.length / totalDrivers) * 100 : 0}
          hint="Uniquement les caisses de l'historique"
          onClick={() => openCategoryModal('NON_PAYES')}
        />
        <StatCard
          label="Stand-by"
          value={standbyNonPayes.length}
          icon={<IconBolt className="h-4 w-4" />}
          accent="amber"
          progress={totalDrivers > 0 ? (standbyNonPayes.length / totalDrivers) * 100 : 0}
          hint="En attente, caisse non réglée"
          onClick={() => openCategoryModal('STANDBY_NON_PAYES')}
        />
        <StatCard
          label="Payé"
          value={payes.length}
          icon={<IconCheck className="h-4 w-4" />}
          accent="emerald"
          progress={totalDrivers > 0 ? (payes.length / totalDrivers) * 100 : 0}
          hint="Aujourd'hui seulement, remis à 0 après 12:30"
          onClick={() => openCategoryModal('PAYES')}
        />
        <StatCard
          label="Sans caisse"
          value={pasDeCaisse.length}
          icon={<IconTruck className="h-4 w-4" />}
          accent="indigo"
          progress={totalDrivers > 0 ? (pasDeCaisse.length / totalDrivers) * 100 : 0}
          hint="Repos ou sans caisse"
          onClick={() => openCategoryModal('PAS_DE_CAISSE')}
        />
      </div>

      {/* =========================================================================
          BARRE DE REPARTITION DE LA FLOTTE AVEC LES 4 SEGMENTS CLIQUABLES
      ========================================================================= */}
      {totalDrivers > 0 && (
        <div className="card mt-5 p-4 sm:px-6">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span className="text-sm font-bold tracking-tight text-slate-800">
              Répartition · {totalDrivers} chauffeurs
            </span>
            <div className="flex flex-wrap items-center gap-4 text-xs font-semibold">
              <button
                type="button"
                onClick={() => openCategoryModal('NON_PAYES')}
                className="flex items-center gap-1.5 text-red-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Historique non payé ({nonPayesActifs.length})
              </button>
              <span className="flex items-center gap-1.5 text-sky-700">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                En cours ({enCours.length})
              </span>
              <button
                type="button"
                onClick={() => openCategoryModal('STANDBY_NON_PAYES')}
                className="flex items-center gap-1.5 text-amber-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                Stand-by / Non Payé ({standbyNonPayes.length})
              </button>
              <button
                type="button"
                onClick={() => openCategoryModal('PAYES')}
                className="flex items-center gap-1.5 text-emerald-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Chauffeur Payé ({payes.length})
              </button>
              <button
                type="button"
                onClick={() => openCategoryModal('PAS_DE_CAISSE')}
                className="flex items-center gap-1.5 text-indigo-700 hover:underline"
              >
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                Chauffeur Sans Caisse ({pasDeCaisse.length})
              </button>
            </div>
          </div>

          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            {enCours.length > 0 && (
              <div
                className="bg-sky-400 transition-all duration-500"
                style={{ width: `${(enCours.length / totalDrivers) * 100}%` }}
                title="En cours"
              />
            )}
            {payes.length > 0 && (
              <div
                className="bg-emerald-500 transition-all duration-500 cursor-pointer"
                style={{ width: `${(payes.length / totalDrivers) * 100}%` }}
                onClick={() => openCategoryModal('PAYES')}
                title="Chauffeur Payé"
              />
            )}
            {nonPayesActifs.length > 0 && (
              <div
                className="bg-red-500 transition-all duration-500 cursor-pointer"
                style={{ width: `${(nonPayesActifs.length / totalDrivers) * 100}%` }}
                onClick={() => openCategoryModal('NON_PAYES')}
                title="Chauffeur Non Payé"
              />
            )}
            {standbyNonPayes.length > 0 && (
              <div
                className="bg-amber-400 transition-all duration-500 cursor-pointer"
                style={{ width: `${(standbyNonPayes.length / totalDrivers) * 100}%` }}
                onClick={() => openCategoryModal('STANDBY_NON_PAYES')}
                title="Chauffeur Stand-by / Non Payé"
              />
            )}
            {pasDeCaisse.length > 0 && (
              <div
                className="bg-indigo-500 transition-all duration-500 cursor-pointer"
                style={{ width: `${(pasDeCaisse.length / totalDrivers) * 100}%` }}
                onClick={() => openCategoryModal('PAS_DE_CAISSE')}
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

          {/* Total Encaissé + Progression Flotte (ancienne position des cumuls) */}
          <div className="grid w-full grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:w-auto lg:min-w-[34rem]">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  {isSupervisorOrAdmin ? 'Total Global des Caisses' : `Total Encaissé (${currentUser?.caisseCode || 'Ma Caisse'})`}
                </span>
                {!isSupervisorOrAdmin && (
                  <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${ecartGlobal >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                    Écart {ecartGlobal > 0 ? '+' : ''}{formatMoney(ecartGlobal)} TND
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <strong className="font-mono text-xl font-extrabold tabular-nums text-slate-900">
                  {formatMoney(isSupervisorOrAdmin ? globalMontantActuel : totalEncaisse)}
                </strong>
                <span className="font-mono text-[11px] font-bold text-indigo-600">TND</span>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Progression Flotte Globale</span>
                <span className="font-mono font-bold text-emerald-600">{settlementPct}%</span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 transition-all duration-500" style={{ width: `${settlementPct}%` }} />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-slate-500">
                <span>{payes.length} payé(s)</span>
                <span>{allNonPayes.length} non payé(s)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Second Toolbar : Filter Tabs + Search Input */}
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-3.5 sm:px-5 lg:flex-row lg:items-center">
          {/* Onglets Filtre Rapide selon les 4 Statuts */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTableFilter('ALL')}
              className={`h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors ${
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
              className={`h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors ${
                tableFilter === 'NON_PAYE_ACTIF'
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-red-50 text-red-700 border border-red-200/60 hover:bg-red-100'
              }`}
            >
              Non Payé ({nonPayesActifs.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('STANDBY_NON_PAYE')}
              className={`h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors ${
                tableFilter === 'STANDBY_NON_PAYE'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-amber-50 text-amber-800 border border-amber-200/60 hover:bg-amber-100'
              }`}
            >
              Stand-by ({standbyNonPayes.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('PAYE')}
              className={`h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors ${
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
              className={`h-8 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-colors ${
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
            {/* Responsive Cards View for Mobile & Tablet / Compact Laptops (xl:hidden) */}
            <div className="grid grid-cols-1 gap-3 p-3.5 sm:p-4 md:grid-cols-2 max-h-[600px] overflow-y-auto xl:hidden bg-slate-50/40">
              {filteredDrivers.map((d) => {
                const retard = calculateRetardFrom1230(d.programmeDate || d.dateDerniere);
                const isStandby = isStandbyCircuit(d.programmeJour);
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDriverDetails(d)}
                    className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-slate-300"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-900" title={d.nom}>
                          {d.nom}
                        </p>
                        <span className="shrink-0 font-mono text-xs text-slate-400">TR {d.tr}</span>
                      </div>
                      <div className="mt-2">
                        <span
                          className={
                            rowStatut(d) === 'En cours'
                              ? 'badge bg-sky-50 text-sky-800 ring-1 ring-sky-200'
                              : rowStatut(d).startsWith('Payé')
                              ? 'badge-solid-emerald'
                              : rowStatut(d) === 'Non payé'
                              ? 'badge-solid-rose'
                              : 'badge-solid-amber'
                          }
                        >
                          {rowStatut(d)}
                        </span>
                        {caisseOf(d) && (
                          <p className="mt-1 inline-flex rounded-md bg-indigo-600 px-2 py-0.5 font-mono text-[11px] font-black tracking-wide text-white">
                            {caisseOf(d)}
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 rounded-xl bg-slate-50/90 border border-slate-100 p-2.5 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">
                            Programme du jour &amp; Échéance
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`inline-flex rounded-lg px-2 py-0.5 font-mono text-[11px] font-extrabold ${
                                isStandby
                                  ? 'bg-amber-100/80 text-amber-900'
                                  : 'bg-sky-100/80 text-sky-900'
                              }`}
                            >
                              {d.programmeJour || 'STAND-BY'}
                            </span>
                            {d.statut === 'NON PAYE' && (
                              <span
                                className={`text-[10px] font-bold ${
                                  retard.isOverdue ? 'text-rose-600' : 'text-sky-700'
                                }`}
                              >
                                {retard.isOverdue ? `⚠️ ${retard.text}` : `🕒 ${retard.text}`}
                              </span>
                            )}
                          </div>
                        </div>

                        <div onClick={(e) => e.stopPropagation()}>
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block mb-1">
                            Caisses non payées
                          </span>
                          <UnpaidCaissesSelect
                            driver={d}
                            allDrivers={drivers}
                            isSuperviseur={isSuperviseur}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-slate-100 pt-3 text-xs">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Bordereau</span>
                          <strong className="num text-slate-900">{formatMoney(d.montantBordereau)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Mvt Caisse</span>
                          <strong className="num text-emerald-700">{formatMoney(d.mouvementCaisse)}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Écart</span>
                          <strong
                            className={`num ${
                              d.ecartBordereau === 0
                                ? 'text-slate-700'
                                : d.ecartBordereau > 0
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          >
                            {d.ecartBordereau > 0 ? '+' : ''}
                            {formatMoney(d.ecartBordereau)}
                          </strong>
                        </div>
                      </div>

                      {!isSuperviseur && (
                        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                          <Link
                            href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                            className="btn-primary w-full"
                          >
                            Encaisser
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Pro Table View (hidden xl:block) */}
            <div className="hidden max-h-[560px] overflow-x-hidden overflow-y-auto xl:block">
              <table className="data-table w-full table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-50 shadow-[0_1px_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="w-[5.75rem] !whitespace-nowrap">Code TR</th>
                    <th>Chauffeur</th>
                    <th className="w-[18%] !whitespace-normal">Programme</th>
                    <th className="w-[16%] !whitespace-normal">Impayés</th>
                    <th className="w-[6.25rem] !text-right">Bordereau</th>
                    <th className="w-[6.25rem] !text-right">Mouvement</th>
                    <th className="w-[5.5rem] !text-right">Écart</th>
                    <th className="w-[7.5rem] !whitespace-normal">Statut</th>
                    {!isSuperviseur && <th className="w-[8.25rem] !text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((d) => {
                    const retard = calculateRetardFrom1230(d.programmeDate || d.dateDerniere);
                    const isStandby = isStandbyCircuit(d.programmeJour);
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedDriverDetails(d)}
                        className="cursor-pointer hover:bg-indigo-50/35 transition-colors group"
                        title="Cliquez pour afficher la fiche détaillée du chauffeur"
                      >
                        <td className="!py-2.5 whitespace-nowrap">
                          <span className="whitespace-nowrap font-mono text-xs font-semibold text-slate-900">
                            TR {d.tr}
                          </span>
                        </td>
                        <td className="!py-2.5">
                          <p className="truncate text-[13px] font-medium text-slate-900" title={d.nom}>
                            {d.nom}
                          </p>
                        </td>
                        <td className="!py-3">
                          <div className="flex min-w-0 flex-col items-start gap-1">
                            <span
                              className={`block max-w-full truncate rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
                                isStandby
                                  ? 'bg-amber-50 text-amber-800'
                                  : 'bg-sky-50 text-sky-900'
                              }`}
                            >
                              {d.programmeJour || 'STAND-BY'}
                            </span>
                            {d.statut === 'PAYE' ? (
                              <span className="text-[10.5px] font-bold text-emerald-600">✓ Caisse réglée</span>
                            ) : d.statut === 'PAS DE CAISSE' ? (
                              <span className="text-[10.5px] text-slate-400">Repos / Sans caisse</span>
                            ) : retard.isOverdue ? (
                              <span className="text-[10.5px] font-extrabold text-rose-600">
                                ⚠️ Retard : {retard.text}
                              </span>
                            ) : (
                              <span className="text-[10.5px] font-semibold text-sky-700">
                                🕒 {retard.text}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="!py-3" onClick={(e) => e.stopPropagation()}>
                          <UnpaidCaissesSelect
                            driver={d}
                            allDrivers={drivers}
                            isSuperviseur={isSuperviseur}
                          />
                        </td>
                        <td className="!py-3 text-right num font-black text-xs text-slate-900">
                          {formatMoney(d.montantBordereau)}
                        </td>
                        <td className="!py-3 text-right num font-black text-xs text-emerald-700">
                          {formatMoney(d.mouvementCaisse)}
                        </td>
                        <td className="!py-3 text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-lg font-mono text-xs font-black ${
                              d.ecartBordereau === 0
                                ? 'bg-slate-100 text-slate-700'
                                : d.ecartBordereau > 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {d.ecartBordereau > 0 ? '+' : ''}
                            {formatMoney(d.ecartBordereau)}
                          </span>
                        </td>
                        <td className="!py-3">
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className={
                                rowStatut(d) === 'En cours'
                                  ? 'badge bg-sky-50 text-sky-800 ring-1 ring-sky-200'
                                  : rowStatut(d).startsWith('Payé')
                                  ? 'badge-solid-emerald'
                                  : rowStatut(d) === 'Non payé'
                                  ? 'badge-solid-rose'
                                  : 'badge-solid-amber'
                              }
                            >
                              {rowStatut(d)}
                            </span>
                            {caisseOf(d) && (
                              <span className="inline-flex rounded-md bg-indigo-600 px-2 py-0.5 font-mono text-[11px] font-black tracking-wide text-white">
                                {caisseOf(d)}
                              </span>
                            )}
                          </div>
                        </td>
                        {!isSuperviseur && (
                          <td className="!py-3 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={(e) => startEditDriver(e, d)}
                                className="btn-ghost !h-8 !w-8 !px-0 text-slate-500"
                                title="Modifier Série / Sous-série / Bordereau"
                              >
                                <IconEdit className="h-3.5 w-3.5" />
                              </button>
                              <Link
                                href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                                className="btn-primary !h-8 !px-2.5 !text-xs"
                                title="Ouvrir au Guichet POS Caisse"
                              >
                                Encaisser
                              </Link>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
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

      {activeCategoryModal && (
        <SheetModal
          size="lg"
          accent={
            activeCategoryModal === 'NON_PAYES'
              ? 'rose'
              : activeCategoryModal === 'STANDBY_NON_PAYES'
              ? 'amber'
              : activeCategoryModal === 'PAYES'
              ? 'emerald'
              : activeCategoryModal === 'PAS_DE_CAISSE'
              ? 'indigo'
              : undefined
          }
          title={
            activeCategoryModal === 'NON_PAYES'
              ? 'Non payé'
              : activeCategoryModal === 'STANDBY_NON_PAYES'
              ? 'Stand-by'
              : activeCategoryModal === 'PAYES'
              ? 'Payé'
              : activeCategoryModal === 'PAS_DE_CAISSE'
              ? 'Sans caisse'
              : 'Opérations validées'
          }
          onClose={() => setActiveCategoryModal(null)}
          toolbar={
            activeCategoryModal === 'VALIDES' ? undefined : (
              <div className="flex items-center gap-2">
                <div className="relative min-w-0 flex-1">
                  <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={categoryQuery}
                    onChange={(e) => setCategoryQuery(e.target.value)}
                    placeholder="Nom, TR ou circuit"
                    className="input !pl-9"
                  />
                </div>
                <span className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md bg-slate-900 px-2 font-mono text-sm font-semibold text-white">
                  {(() => {
                    const source =
                      activeCategoryModal === 'NON_PAYES'
                        ? nonPayesActifs
                        : activeCategoryModal === 'STANDBY_NON_PAYES'
                        ? standbyNonPayes
                        : activeCategoryModal === 'PAYES'
                        ? payes
                        : pasDeCaisse;
                    const q = categoryQuery.trim().toLowerCase();
                    const n = q
                      ? source.filter(
                          (d) =>
                            d.nom.toLowerCase().includes(q) ||
                            d.tr.toLowerCase().includes(q) ||
                            (d.programmeJour || '').toLowerCase().includes(q)
                        ).length
                      : source.length;
                    return n;
                  })()}
                </span>
              </div>
            )
          }
        >
          {activeCategoryModal === 'VALIDES' ? (
            transactions.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-400">Aucune transaction validée pour le moment.</p>
            ) : (
              <ul className="space-y-2">
                {transactions.map((t) => (
                  <li key={t.id} className="rounded-2xl border border-slate-200 bg-white p-3.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {isSupervisorOrAdmin && (
                        <span className="badge-indigo font-mono">{t.caisseCode || 'CAISSE'}</span>
                      )}
                      <span className="rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-xs font-black text-white">
                        TR {t.codeChauffeur}
                      </span>
                      <span className="min-w-0 text-sm font-extrabold leading-snug text-slate-900">{t.nomChauffeur}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(t.date)}</p>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm font-extrabold text-emerald-700">+{formatMoney(t.tPayer)} TND</p>
                        <p className="font-mono text-[11px] text-slate-400">Attendu {formatMoney(t.recette)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => openTransactionReceipt(t)}
                        className="btn-ghost !px-3 !py-2 text-xs font-bold text-indigo-700"
                      >
                        <IconPrinter className="h-4 w-4" />
                        Reçu
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : (
            (() => {
              const source =
                activeCategoryModal === 'NON_PAYES'
                  ? nonPayesActifs
                  : activeCategoryModal === 'STANDBY_NON_PAYES'
                  ? standbyNonPayes
                  : activeCategoryModal === 'PAYES'
                  ? payes
                  : pasDeCaisse;
              const q = categoryQuery.trim().toLowerCase();
              const targetList = q
                ? source.filter(
                    (d) =>
                      d.nom.toLowerCase().includes(q) ||
                      d.tr.toLowerCase().includes(q) ||
                      (d.programmeJour || '').toLowerCase().includes(q)
                  )
                : source;

              return targetList.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-400">Aucun chauffeur dans cette liste.</p>
              ) : (
                <ul className="-mx-4 -my-3 space-y-2 bg-slate-50 px-3 py-3">
                  {targetList.map((d) => {
                    const avatar =
                      activeCategoryModal === 'NON_PAYES'
                        ? 'bg-red-500 text-white'
                        : activeCategoryModal === 'STANDBY_NON_PAYES'
                        ? 'bg-amber-400 text-amber-950'
                        : activeCategoryModal === 'PAYES'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-indigo-500 text-white';
                    const initials = d.nom
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join('')
                      .toUpperCase();
                    return (
                      <li
                        key={d.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-xs font-bold tracking-tight ${avatar}`}>
                          {initials || 'TR'}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-bold tracking-tight text-slate-900">{d.nom}</p>
                            <span className="shrink-0 whitespace-nowrap rounded-md bg-slate-900 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                              TR {d.tr}
                            </span>
                            {caisseOf(d) && (
                              <span className="shrink-0 rounded-md bg-indigo-600 px-2 py-0.5 font-mono text-[11px] font-black tracking-wide text-white">
                                {caisseOf(d)}
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 truncate text-xs font-semibold tracking-wide text-slate-500">{d.programmeJour || 'Stand-by'}</p>
                          {d.reclamation && /retard/i.test(d.reclamation) ? (
                            <p className="mt-0.5 truncate text-xs font-medium text-rose-700">{d.reclamation}</p>
                          ) : null}
                        </div>
                        {!isSuperviseur && (
                          <Link
                            href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                            onClick={() => setActiveCategoryModal(null)}
                            className="btn-primary !h-8 shrink-0 !px-2.5 !text-xs"
                          >
                            Encaisser
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              );
            })()
          )}
        </SheetModal>
      )}

      {/* =========================================================================
          MODAL 2 : DÉTAIL DU CHAUFFEUR AU CLIC SUR LA LIGNE DU TABLEAU
      ========================================================================= */}
      {selectedDriverDetails && (
        <SheetModal
          title={`${selectedDriverDetails.nom}`}
          subtitle={`TR ${selectedDriverDetails.tr} · ${selectedDriverDetails.statut}${caisseOf(selectedDriverDetails) ? ` · Payé à ${caisseOf(selectedDriverDetails)}` : ''}`}
          onClose={() => setSelectedDriverDetails(null)}
          footer={
            !isSuperviseur ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    const d = selectedDriverDetails;
                    setSelectedDriverDetails(null);
                    startEditDriver(e, d);
                  }}
                  className="btn-ghost w-full sm:w-auto"
                >
                  <IconEdit className="h-4 w-4" />
                  Modifier
                </button>
                <Link
                  href={`/caisse?tr=${encodeURIComponent(selectedDriverDetails.tr)}`}
                  onClick={() => setSelectedDriverDetails(null)}
                  className="btn-primary w-full sm:w-auto"
                >
                  <IconCalculator className="h-4 w-4" />
                  Encaisser
                </Link>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSelectedDriverDetails(null)}
                className="btn-primary w-full sm:ml-auto sm:w-auto"
              >
                Fermer
              </button>
            )
          }
        >
              <div className="grid grid-cols-1 gap-2 text-center sm:grid-cols-3">
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

              <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-slate-500 font-medium">Circuit</span>
                  <span className="font-bold text-slate-800">
                    {selectedDriverDetails.programmeJour || 'STAND-BY'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <span className="shrink-0 text-slate-500 font-medium">Caisses non payées</span>
                  <span className="font-mono font-bold text-rose-700 sm:text-right">
                    {(() => {
                      const history = (selectedDriverDetails.programmeHistorique || []).filter(
                        (entry) => !entry.paid
                      );
                      const openDay =
                        !isStandbyCircuit(selectedDriverDetails.programmeJour) &&
                        !isJourPaye(selectedDriverDetails) &&
                        selectedDriverDetails.statut !== 'PAYE' &&
                        !calculateRetardFrom1230(
                          selectedDriverDetails.programmeDate || selectedDriverDetails.dateDerniere
                        ).isOverdue;
                      if (history.length === 0) return openDay ? 'En cours' : 'Aucune';
                      return history.map((entry) => entry.circuit || 'ANCIENNE CAISSE').join(', ');
                    })()}
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
        </SheetModal>
      )}

      {/* =========================================================================
          MODAL 3 : ÉDITION RAPIDE SÉRIE, SOUS-SÉRIE ET MONTANT BORDEREAU
      ========================================================================= */}
      {editingDriver && !isSuperviseur && (
        <SheetModal
          title={`Série & bordereau`}
          subtitle={`${editingDriver.nom} · TR ${editingDriver.tr}`}
          onClose={() => setEditingDriver(null)}
        >
            <form onSubmit={handleSaveDriverEdit} className="space-y-4">
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

              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="btn-ghost w-full sm:w-auto"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary w-full sm:w-auto"
                >
                  Enregistrer
                </button>
              </div>
            </form>
        </SheetModal>
      )}
    </>
  );
}
