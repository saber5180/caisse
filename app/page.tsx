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
  IconCalendar,
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

function driverInitials(name?: string): string {
  return (name || 'TR')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function normalCaisseCode(raw?: string | null): 'CRNU' | 'CRSF' | 'CRTN' | '' {
  const value = (raw || '').toUpperCase();
  if (value.includes('CRNU')) return 'CRNU';
  if (value.includes('CRSF')) return 'CRSF';
  if (value.includes('CRTN')) return 'CRTN';
  return '';
}

function PaidAtCaisse({ code, paidBy }: { code: string; paidBy?: string }) {
  const caisse = normalCaisseCode(code);
  const name = (paidBy || '').trim();
  if (!caisse && !name) return <span className="text-[11px] font-medium text-slate-300">—</span>;
  const tone =
    caisse === 'CRNU'
      ? 'bg-sky-50 text-sky-900 ring-sky-200'
      : caisse === 'CRSF'
      ? 'bg-emerald-50 text-emerald-900 ring-emerald-200'
      : caisse === 'CRTN'
      ? 'bg-indigo-50 text-indigo-900 ring-indigo-200'
      : 'bg-slate-100 text-slate-800 ring-slate-200';
  const dot =
    caisse === 'CRNU' ? 'bg-sky-600' : caisse === 'CRSF' ? 'bg-emerald-600' : caisse === 'CRTN' ? 'bg-indigo-600' : 'bg-slate-500';
  return (
    <span
      className={`inline-flex max-w-full items-stretch overflow-hidden rounded-md ring-1 ${tone}`}
      title={name ? `${caisse || 'Caisse'} · ${name}` : caisse}
    >
      {caisse ? (
        <span className="inline-flex shrink-0 items-center gap-1.5 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide">
          <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
          {caisse}
        </span>
      ) : null}
      {name ? (
        <span className="flex min-w-0 max-w-[8.5rem] items-center truncate border-l border-current/15 bg-white px-2 text-[11px] font-semibold text-slate-800">
          {name}
        </span>
      ) : null}
    </span>
  );
}

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
  const fleetPaidToday = useCaisseStore((state) => state.fleetPaidToday);
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
  const fleetByTr = new Map<string, (typeof fleetPaidToday)[number]>();
  for (const p of fleetPaidToday) {
    const tr = cleanScannerTr(p.tr).toUpperCase();
    if (!tr) continue;
    if (!p.date || new Date(p.date).getTime() < shiftStart) continue;
    const prev = fleetByTr.get(tr);
    if (!prev || new Date(p.date).getTime() >= new Date(prev.date).getTime()) fleetByTr.set(tr, p);
  }
  const paidTodayByTr = new Map<string, string>();
  for (const t of txnsSource) {
    if (!t?.date || new Date(t.date).getTime() < shiftStart) continue;
    const tr = cleanScannerTr(t.codeChauffeur).toUpperCase();
    if (!tr || paidTodayByTr.has(tr)) continue;
    paidTodayByTr.set(tr, normalizeCaisseCode(t.caisseCode));
  }
  const paidThisDay = (d: Driver) => {
    const tr = cleanScannerTr(d.tr).toUpperCase();
    if (fleetByTr.has(tr) || paidTodayByTr.has(tr)) return true;
    if (!d.payeLe) return false;
    return new Date(d.payeLe).getTime() >= shiftStart;
  };
  const caisseOf = (d: Driver & { paidCaisseCode?: string }) => {
    const tr = cleanScannerTr(d.tr).toUpperCase();
    const fromFleet = normalCaisseCode(fleetByTr.get(tr)?.caisseCode);
    if (fromFleet) return fromFleet;
    const fromReceipt = normalCaisseCode(paidTodayByTr.get(tr));
    if (fromReceipt) return fromReceipt;
    if (!d.payeLe || new Date(d.payeLe).getTime() < shiftStart) return '';
    return normalCaisseCode(d.caissePaye || d.paidCaisseCode);
  };
  const paidByOf = (d: Driver) => {
    const tr = cleanScannerTr(d.tr).toUpperCase();
    const fromFleet = fleetByTr.get(tr);
    if (fromFleet) return (fromFleet.operatorName || fromFleet.operatorUsername || '').trim();
    if (!d.payeLe || new Date(d.payeLe).getTime() < shiftStart) return '';
    return (d.payePar || '').trim();
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
    if (paidThisDay(d)) return 'Payé';
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

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  // Calcul des segments SVG pour l'anneau de répartition de la flotte
  const ringRadius = 46;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const fleetSegments = [
    { key: 'PAYE', count: payes.length, color: '#10b981' },
    { key: 'EN_COURS', count: enCours.length, color: '#38bdf8' },
    { key: 'NON_PAYE', count: nonPayesActifs.length, color: '#f43f5e' },
    { key: 'STANDBY', count: standbyNonPayes.length, color: '#f97316' },
    { key: 'SANS_CAISSE', count: pasDeCaisse.length, color: '#6366f1' },
  ];
  let cumulativeFraction = 0;
  const ringArcs = fleetSegments
    .filter((s) => s.count > 0 && totalDrivers > 0)
    .map((s) => {
      const fraction = s.count / totalDrivers;
      const dashLength = fraction * ringCircumference;
      const dashOffset = -cumulativeFraction * ringCircumference;
      cumulativeFraction += fraction;
      return { ...s, dashLength, dashOffset };
    });

  return (
    <div className="space-y-6 pb-10">
      {receiptData && (
        <PrintReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}

      {/* =========================================================================
          COCKPIT EXÉCUTIF DU TABLEAU DE BORD (FINTECH NAVY & COBALT)
      ========================================================================= */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#132038] p-5 sm:p-6 text-white shadow-lg">
        {/* Éclairage architectural discret bleu cobalt & émeraude */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"
        />

        <div className="relative z-10">
          {/* Barre supérieure du cockpit */}
          <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isSupervisorOrAdmin ? 'Supervision en direct' : 'Session active'}
                </span>
                <span className="rounded-full border border-sky-400/25 bg-sky-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-sky-300">
                  {isSupervisorOrAdmin
                    ? 'CRNU · CRSF · CRTN'
                    : currentUser?.caisseCode || currentUser?.username?.toUpperCase() || 'CAISSE'}
                </span>
                <span className="text-xs font-medium capitalize text-slate-400">
                  {todayLabel}
                </span>
              </div>

              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {currentUser?.displayName || 'Tableau de bord'}
              </h1>
              <p className="mt-0.5 text-xs text-slate-400 sm:text-sm">
                {isSupervisorOrAdmin
                  ? 'Consolidation temps réel des encaissements, clôtures et tournées chauffeurs'
                  : 'Pilotage en temps réel de vos séries, bordereaux chauffeurs et encaissements du jour'}
              </p>
            </div>

            {/* Actions rapides du cockpit */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fetchAccountData()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.1] hover:text-white"
                title="Synchroniser les données"
              >
                <IconSync className={`h-3.5 w-3.5 text-sky-400 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>

              {!isSuperviseur && (
                <>
                  <Link
                    href="/billetterie"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.1] hover:text-white"
                  >
                    <IconCoins className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Billetterie</span>
                  </Link>
                  <Link
                    href="/caisse"
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-sky-500 px-4 text-xs font-bold text-white shadow-sm shadow-sky-950/50 transition hover:bg-sky-400"
                  >
                    <IconCalculator className="h-4 w-4" />
                    <span>Ouvrir le Guichet</span>
                    <IconArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Contenu du cockpit : Vue Superviseur vs Vue Caisse (Séries + Cumuls) */}
          {isSuperviseur ? (
            <div className="mt-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Synthèse consolidée par guichet
                </span>
                <span className="font-mono text-[11px] font-semibold text-sky-400">
                  {totalDrivers} chauffeurs · {settlementPct}% réglés
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                {superviseurCaisseRows.map((row) => (
                  <div
                    key={row.code}
                    className="rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold text-white ${
                          row.code === 'CRNU'
                            ? 'bg-sky-600'
                            : row.code === 'CRSF'
                            ? 'bg-emerald-600'
                            : 'bg-indigo-600'
                        }`}
                      >
                        {row.code}
                      </span>
                      <span className="text-xs font-medium text-slate-400">{row.name}</span>
                    </div>
                    <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Bordereaux</span>
                        <strong className="num font-bold text-white">
                          {formatMoney(row.bordereaux)} TND
                        </strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Mouvements</span>
                        <strong className="num font-bold text-emerald-400">
                          {formatMoney(row.mouvements)} TND
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Carte Total Consolidé */}
                <div className="rounded-xl border border-sky-400/30 bg-gradient-to-br from-sky-500/20 to-emerald-500/10 p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-300">
                      Total consolidé
                    </span>
                    <span className="font-mono text-[10px] font-bold text-emerald-300">3 CAISSES</span>
                  </div>
                  <div className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-300">Cumul bordereaux</span>
                      <strong className="num text-sm font-extrabold text-white">
                        {formatMoney(superviseurTotalBordereaux)} TND
                      </strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-emerald-200">Cumul mouvements</span>
                      <strong className="num text-sm font-extrabold text-emerald-300">
                        {formatMoney(superviseurTotalMouvements)} TND
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-12">
              {/* Module 1 : Séries & Sous-série */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 xl:col-span-5">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/20 font-mono text-xs font-bold text-sky-300">
                      #
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-white">Séries &amp; Sous-série</h2>
                      <p className="text-[11px] text-slate-400">Sauvegarde automatique par caisse</p>
                    </div>
                  </div>
                  <span className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] font-bold text-slate-300">
                    {currentUser?.caisseCode || 'CAISSE'}
                  </span>
                </div>

                <div className="mt-3.5 grid grid-cols-2 gap-3">
                  {[
                    { id: 'hero-serie-1', tag: 'S1', label: 'Série 1', v: heroSerie, set: setHeroSerie },
                    { id: 'hero-serie-2', tag: 'S2', label: 'Série 2', v: heroSerie2, set: setHeroSerie2 },
                    { id: 'hero-serie-3', tag: 'S3', label: 'Série 3', v: heroSerie3, set: setHeroSerie3 },
                    { id: 'hero-sous-serie', tag: 'SS', label: 'Sous-série', v: heroSousSerie, set: setHeroSousSerie },
                  ].map((f) => (
                    <div key={f.id}>
                      <label htmlFor={f.id} className="mb-1.5 block text-[11px] font-semibold text-slate-300">
                        {f.label}
                      </label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded bg-sky-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                          {f.tag}
                        </span>
                        <input
                          id={f.id}
                          type="text"
                          value={f.v}
                          onChange={(e) => f.set(e.target.value)}
                          placeholder="—"
                          className="h-10 w-full rounded-xl border border-white/15 bg-slate-950/60 pl-10 pr-3 font-mono text-sm font-bold text-white placeholder-slate-500 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Module 2 : Cumuls Bordereaux, Mouvements & Différence */}
              <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 xl:col-span-7">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-300">
                      <IconCoins className="h-4 w-4" />
                    </span>
                    <div>
                      <h2 className="text-sm font-bold text-white">Cumuls Bordereaux &amp; Mouvements</h2>
                      <p className="text-[11px] text-slate-400">Situation financière de la journée ouverte</p>
                    </div>
                  </div>
                  <span className="rounded-md border border-emerald-400/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    TEMPS RÉEL
                  </span>
                </div>

                <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3.5">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      Bordereaux
                    </span>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <strong className="num text-xl font-extrabold text-white">
                        {formatMoney(cumulBordereaux)}
                      </strong>
                      <span className="font-mono text-[10px] font-semibold text-sky-400">TND</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3.5">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-emerald-300">
                      Mouvements
                    </span>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <strong className="num text-xl font-extrabold text-emerald-300">
                        {formatMoney(cumulMouvements)}
                      </strong>
                      <span className="font-mono text-[10px] font-semibold text-emerald-400">TND</span>
                    </div>
                  </div>

                  <div
                    className={`rounded-xl border p-3.5 ${
                      cumulEcart === 0
                        ? 'border-white/10 bg-slate-950/50 text-white'
                        : cumulEcart > 0
                        ? 'border-rose-400/30 bg-rose-500/15 text-rose-200'
                        : 'border-sky-400/30 bg-sky-500/15 text-sky-200'
                    }`}
                  >
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider opacity-80">
                      Écart (Mvt − Bord.)
                    </span>
                    <div className="mt-1.5 flex items-baseline gap-1">
                      <strong className="num text-xl font-extrabold">
                        {cumulEcart > 0 ? '+' : ''}{formatMoney(cumulEcart)}
                      </strong>
                      <span className="font-mono text-[10px] font-semibold opacity-75">TND</span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-slate-950/50 p-3">
                    <label htmlFor="ecart-valeur" className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                      Valeur à soustraire
                    </label>
                    <div className="relative mt-1.5">
                      <input
                        id="ecart-valeur"
                        type="number"
                        step="0.001"
                        value={ecartValeurInput}
                        onChange={(e) => setEcartValeurInput(e.target.value)}
                        placeholder="0.000"
                        className="h-9 w-full rounded-lg border border-white/15 bg-slate-900/90 pl-3 pr-12 font-mono text-sm font-bold text-white placeholder-slate-500 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/20"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] font-bold text-slate-400">
                        TND
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center rounded-xl border border-sky-400/30 bg-gradient-to-br from-sky-500/15 to-emerald-500/10 px-4 py-3">
                    <span className="block text-[10.5px] font-bold uppercase tracking-wider text-sky-300">
                      Différence (Bordereaux − Valeur)
                    </span>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <strong
                        className={`num text-xl font-extrabold ${
                          ecartDiff === 0 ? 'text-white' : ecartDiff > 0 ? 'text-emerald-300' : 'text-rose-300'
                        }`}
                      >
                        {ecartDiff > 0 ? '+' : ''}{formatMoney(ecartDiff)}
                      </strong>
                      <span className="font-mono text-[10px] font-bold text-sky-300/80">TND</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          SUIVI EN TEMPS RÉEL DES CAISSES CRNU, CRSF, CRTN (SUPERVISEUR & ADMIN)
      ========================================================================= */}
      {isSupervisorOrAdmin && caissesSummary.length > 0 && (
        <section className="space-y-3.5">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-600 text-white shadow-2xs">
                <IconCoins className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-base font-extrabold text-slate-900">
                  Caisses régionales en direct
                </h2>
                <p className="text-xs text-slate-500">
                  Activité temps réel et contrôle d&apos;accès (CRNU · CRSF · CRTN)
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs">
                <span className="font-semibold text-sky-900">Total Caisses : </span>
                <strong className="font-mono font-extrabold text-sky-800">
                  {formatMoney(globalMontantActuel)} TND
                </strong>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs shadow-2xs">
                <span className="font-semibold text-slate-600">Cumul Clôtures : </span>
                <strong className="font-mono font-extrabold text-slate-900">
                  {formatMoney(globalTotalCloture)} TND
                </strong>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {caissesSummary.map((caisse) => {
              const barColor = caisse.isBlocked
                ? 'bg-rose-500'
                : caisse.caisseCode === 'CRNU'
                ? 'bg-sky-500'
                : caisse.caisseCode === 'CRSF'
                ? 'bg-emerald-500'
                : 'bg-indigo-500';
              return (
                <div
                  key={caisse.accountId}
                  className={`card relative flex flex-col justify-between overflow-hidden p-5 transition-all hover:shadow-md ${
                    caisse.isBlocked
                      ? 'border-2 border-rose-300 bg-rose-50/20'
                      : 'border border-slate-200/90 bg-white'
                  }`}
                >
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${barColor}`} />
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl font-mono text-xs font-black text-white shadow-2xs ${
                            caisse.isBlocked
                              ? 'bg-rose-600'
                              : caisse.caisseCode === 'CRNU'
                              ? 'bg-sky-600'
                              : caisse.caisseCode === 'CRSF'
                              ? 'bg-emerald-600'
                              : 'bg-indigo-600'
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

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          caisse.isBlocked
                            ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
                            : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            caisse.isBlocked ? 'bg-rose-500' : 'animate-pulse bg-emerald-500'
                          }`}
                        />
                        {caisse.isBlocked ? 'Bloquée' : 'En direct'}
                      </span>
                    </div>

                    <div className="mt-4 rounded-xl bg-slate-900 p-4 text-white">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <span>Encaissement temps réel</span>
                        <span className="font-mono text-sky-400">{caisse.caisseCode}</span>
                      </div>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-mono text-2xl font-extrabold tracking-tight text-white tabular-nums">
                          {formatMoney(caisse.montantActuel)}
                        </span>
                        <span className="font-mono text-xs font-semibold text-slate-400">TND</span>
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2.5">
                      <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-3">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                          MT Espèce
                        </span>
                        <strong className="num mt-0.5 block text-sm font-extrabold text-emerald-900">
                          {formatMoney(caisse.mtEspece)} TND
                        </strong>
                      </div>

                      <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 p-3">
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-sky-700">
                          Versement
                        </span>
                        <strong className="num mt-0.5 block text-sm font-extrabold text-sky-900">
                          {formatMoney(caisse.versement)} TND
                        </strong>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3 py-2 text-xs">
                      <span className="font-semibold text-slate-600">
                        Total Clôtures ({caisse.nbClotures}) :
                      </span>
                      <Link
                        href={`/billetterie/historique?caisse=${caisse.caisseCode}`}
                        className="font-mono font-extrabold text-slate-900 hover:text-sky-600 hover:underline"
                      >
                        {formatMoney(caisse.totalCloture)} TND →
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        <IconShield className="h-3 w-3 text-indigo-600" />
                        Contrôle à distance
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {caisse.isBlocked ? (
                        <button
                          type="button"
                          onClick={() => controlCaisse(caisse.caisseCode, 'unblock')}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          <IconCheck className="h-3.5 w-3.5" />
                          Débloquer
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
                              controlCaisse(caisse.caisseCode, 'block');
                            }
                          }}
                          className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                        >
                          <IconAlert className="h-3.5 w-3.5" />
                          Bloquer
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
                            controlCaisse(caisse.caisseCode, 'force_logout');
                          }
                        }}
                        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <IconLogout className="h-3.5 w-3.5" />
                        Déconnecter
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================================
          PANORAMA ANALYTIQUE DE LA FLOTTE : JAUGE CIRCULAIRE + 4 CARTES KPI
      ========================================================================= */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
              Situation de la flotte chauffeurs
            </h2>
            <p className="text-xs text-slate-500">
              Vue analytique des règlements · Cliquez sur une catégorie pour inspecter les chauffeurs
            </p>
          </div>
          <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1 font-mono text-xs font-bold text-slate-700 shadow-2xs">
            {totalDrivers} chauffeurs
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Jauge analytique circulaire de répartition */}
          <div className="card relative flex flex-col justify-between overflow-hidden p-5 xl:col-span-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Taux d&apos;apurement
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Répartition temps réel sur {totalDrivers} chauffeur{totalDrivers > 1 ? 's' : ''}
                </p>
              </div>
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-xs font-extrabold text-emerald-700 ring-1 ring-emerald-200/80">
                {payes.length} / {totalDrivers}
              </span>
            </div>

            <div className="my-4 flex items-center gap-5">
              {/* Anneau SVG haute précision */}
              <div className="relative h-28 w-28 shrink-0">
                <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r={ringRadius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth="12"
                  />
                  {ringArcs.map((arc) => (
                    <circle
                      key={arc.key}
                      cx="60"
                      cy="60"
                      r={ringRadius}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth="12"
                      strokeDasharray={`${arc.dashLength} ${ringCircumference}`}
                      strokeDashoffset={arc.dashOffset}
                      className="transition-all duration-500"
                    />
                  ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="num text-xl font-extrabold leading-none text-slate-900">
                    {settlementPct}%
                  </span>
                  <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Réglés
                  </span>
                </div>
              </div>

              {/* Légende interactive cliquable */}
              <div className="min-w-0 flex-1 space-y-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => openCategoryModal('PAYES')}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left transition hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    Payés
                  </span>
                  <strong className="num text-slate-900">{payes.length}</strong>
                </button>

                <div className="flex w-full items-center justify-between rounded-lg px-2 py-1">
                  <span className="flex items-center gap-2 font-semibold text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                    En cours
                  </span>
                  <strong className="num text-slate-900">{enCours.length}</strong>
                </div>

                <button
                  type="button"
                  onClick={() => openCategoryModal('NON_PAYES')}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left transition hover:bg-rose-50/60"
                >
                  <span className="flex items-center gap-2 font-semibold text-rose-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                    Non payés
                  </span>
                  <strong className="num text-rose-700">{nonPayesActifs.length}</strong>
                </button>

                <button
                  type="button"
                  onClick={() => openCategoryModal('STANDBY_NON_PAYES')}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left transition hover:bg-orange-50/60"
                >
                  <span className="flex items-center gap-2 font-semibold text-orange-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                    Stand-by
                  </span>
                  <strong className="num text-orange-700">{standbyNonPayes.length}</strong>
                </button>

                <button
                  type="button"
                  onClick={() => openCategoryModal('PAS_DE_CAISSE')}
                  className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left transition hover:bg-indigo-50/60"
                >
                  <span className="flex items-center gap-2 font-semibold text-indigo-700">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    Sans caisse
                  </span>
                  <strong className="num text-indigo-700">{pasDeCaisse.length}</strong>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500">
              <span>{allNonPayes.length} dossier{allNonPayes.length > 1 ? 's' : ''} en attente</span>
              <Link href="/programme" className="font-bold text-sky-600 hover:text-sky-700">
                Programme 12:30 →
              </Link>
            </div>
          </div>

          {/* 4 Cartes KPI Statuts Cliquables */}
          <div className="grid grid-cols-2 gap-3.5 sm:gap-4 xl:col-span-8">
            <StatCard
              label="Non payés"
              value={nonPayesActifs.length}
              icon={<IconAlert className="h-4 w-4" />}
              accent="rose"
              progress={totalDrivers > 0 ? (nonPayesActifs.length / totalDrivers) * 100 : 0}
              hint="Tournées antérieures à régler"
              onClick={() => openCategoryModal('NON_PAYES')}
            />
            <StatCard
              label="Stand-by à régler"
              value={standbyNonPayes.length}
              icon={<IconBolt className="h-4 w-4" />}
              accent="amber"
              progress={totalDrivers > 0 ? (standbyNonPayes.length / totalDrivers) * 100 : 0}
              hint="Stand-by avec caisse en attente"
              onClick={() => openCategoryModal('STANDBY_NON_PAYES')}
            />
            <StatCard
              label="Chauffeurs payés"
              value={payes.length}
              icon={<IconCheck className="h-4 w-4" />}
              accent="emerald"
              progress={totalDrivers > 0 ? (payes.length / totalDrivers) * 100 : 0}
              hint="Tournées réglées sur la journée"
              onClick={() => openCategoryModal('PAYES')}
            />
            <StatCard
              label="Sans caisse"
              value={pasDeCaisse.length}
              icon={<IconTruck className="h-4 w-4" />}
              accent="indigo"
              progress={totalDrivers > 0 ? (pasDeCaisse.length / totalDrivers) * 100 : 0}
              hint="Repos ou sans engagement actif"
              onClick={() => openCategoryModal('PAS_DE_CAISSE')}
            />
          </div>
        </div>
      </section>

      {/* =========================================================================
          SUIVI GLOBAL DES CHAUFFEURS & RAPPROCHEMENT
      ========================================================================= */}
      <div className="card overflow-hidden">
        <div className="card-header flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white shadow-2xs">
              <IconSheet className="h-5 w-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">
                  Suivi des chauffeurs &amp; rapprochement
                </h2>
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                  {filteredDrivers.length} / {totalDrivers}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Cliquez sur un chauffeur pour consulter sa fiche détaillée ou lancer un encaissement
              </p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2.5 text-xs sm:grid-cols-2 lg:w-auto lg:min-w-[28rem]">
            <div className="rounded-xl bg-slate-900 px-4 py-2.5 text-white">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isSupervisorOrAdmin ? 'Total encaissé' : `Encaissé (${currentUser?.caisseCode || 'Caisse'})`}
                </span>
                {!isSupervisorOrAdmin && (
                  <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${ecartGlobal >= 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                    Écart {ecartGlobal > 0 ? '+' : ''}{formatMoney(ecartGlobal)}
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1">
                <strong className="num text-lg font-extrabold text-white">
                  {formatMoney(isSupervisorOrAdmin ? globalMontantActuel : totalEncaisse)}
                </strong>
                <span className="font-mono text-[10px] text-sky-400">TND</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => openCategoryModal('VALIDES')}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-left transition hover:border-sky-300 hover:bg-sky-50/40"
            >
              <div className="flex w-full items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Reçus émis
                </span>
                <span className="text-[11px] font-bold text-sky-600">Détail →</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <strong className="num text-lg font-extrabold text-slate-900">
                  {txnsSource.length} <span className="font-sans text-xs font-semibold text-slate-500">opération{txnsSource.length > 1 ? 's' : ''}</span>
                </strong>
                <span className="font-mono text-[11px] font-bold text-emerald-700">{settlementPct}% flotte</span>
              </div>
            </button>
          </div>
        </div>

        {/* Barre de filtres + Recherche */}
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/70 p-3.5 sm:px-5 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTableFilter('ALL')}
              className={`h-8 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-all ${
                tableFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              Tous ({totalDrivers})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('NON_PAYE_ACTIF')}
              className={`h-8 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-all ${
                tableFilter === 'NON_PAYE_ACTIF'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
              }`}
            >
              Non payé ({nonPayesActifs.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('STANDBY_NON_PAYE')}
              className={`h-8 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-all ${
                tableFilter === 'STANDBY_NON_PAYE'
                  ? 'bg-orange-600 text-white shadow-2xs'
                  : 'bg-orange-50 text-orange-800 border border-orange-200 hover:bg-orange-100'
              }`}
            >
              Stand-by ({standbyNonPayes.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('PAYE')}
              className={`h-8 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-all ${
                tableFilter === 'PAYE'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Payé ({payes.length})
            </button>
            <button
              type="button"
              onClick={() => setTableFilter('PAS DE CAISSE')}
              className={`h-8 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition-all ${
                tableFilter === 'PAS DE CAISSE'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
              }`}
            >
              Sans caisse ({pasDeCaisse.length})
            </button>
          </div>

          <div className="relative w-full lg:w-80">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              placeholder="Rechercher chauffeur, TR, série, circuit..."
              className="input !h-9 !min-h-9 !pl-8 !pr-8 !py-1.5 text-xs font-medium w-full bg-white"
            />
            {tableSearch && (
              <button
                type="button"
                onClick={() => setTableSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                title="Effacer la recherche"
              >
                <IconClose className="h-3.5 w-3.5" />
              </button>
            )}
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
            {/* Liste compacte & responsive Mobile / Tablette / Laptop < 1280px (xl:hidden) */}
            <div className="divide-y divide-slate-100 xl:hidden">
              {filteredDrivers.map((d) => {
                const retard = calculateRetardFrom1230(d.programmeDate || d.dateDerniere);
                const isStandby = isStandbyCircuit(d.programmeJour);
                const statutLabel = rowStatut(d);
                const avatarTone =
                  statutLabel === 'En cours'
                    ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                    : statutLabel.startsWith('Payé')
                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                    : statutLabel === 'Non payé'
                    ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                    : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
                return (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDriverDetails(d)}
                    className="cursor-pointer p-3.5 sm:px-5 transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ${avatarTone}`}>
                          {driverInitials(d.nom)}
                        </span>
                        <span className="shrink-0 rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                          TR {d.tr}
                        </span>
                        <p className="truncate text-sm font-bold text-slate-900" title={d.nom}>
                          {d.nom}
                        </p>
                        <span
                          className={`hidden sm:inline-flex shrink-0 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
                            isStandby
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-sky-50 text-sky-800 border border-sky-200/70'
                          }`}
                        >
                          {d.programmeJour || 'STAND-BY'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={
                            statutLabel === 'En cours'
                              ? 'badge bg-sky-50 text-sky-800 border border-sky-200'
                              : statutLabel.startsWith('Payé')
                              ? 'badge-emerald'
                              : statutLabel === 'Non payé'
                              ? 'badge-rose'
                              : 'badge-slate'
                          }
                        >
                          {statutLabel}
                        </span>
                        {!isSuperviseur && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => startEditDriver(e, d)}
                              className="btn-ghost !h-7 !w-7 !px-0 text-slate-500"
                              title="Modifier"
                            >
                              <IconEdit className="h-3.5 w-3.5" />
                            </button>
                            <Link
                              href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                              className="btn-primary !h-7 !px-2.5 !text-xs font-bold"
                            >
                              Encaisser
                            </Link>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
                      <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span
                          className={`sm:hidden inline-flex rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
                            isStandby
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-sky-50 text-sky-800 border border-sky-200/70'
                          }`}
                        >
                          {d.programmeJour || 'STAND-BY'}
                        </span>
                        <UnpaidCaissesSelect
                          driver={d}
                          allDrivers={drivers}
                          isSuperviseur={isSuperviseur}
                        />
                        <PaidAtCaisse code={caisseOf(d)} paidBy={paidByOf(d)} />
                        {d.statut === 'NON PAYE' && (
                          <span
                            className={`text-[11px] font-semibold ${
                              retard.isOverdue ? 'text-rose-600' : 'text-slate-500'
                            }`}
                          >
                            {retard.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tableau Grand Écran (hidden xl:block) */}
            <div className="hidden overflow-x-hidden xl:block">
              <table className="data-table w-full table-fixed">
                <thead>
                  <tr>
                    <th className="w-24">Code TR</th>
                    <th>Chauffeur</th>
                    <th className="w-[16%]">Programme</th>
                    <th className="w-[16%]">Impayés</th>
                    <th className="w-[7.5rem]">Statut</th>
                    <th className="w-[12.5rem]">Payé à</th>
                    {!isSuperviseur && <th className="w-[8.5rem] !text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((d) => {
                    const retard = calculateRetardFrom1230(d.programmeDate || d.dateDerniere);
                    const isStandby = isStandbyCircuit(d.programmeJour);
                    const statutLabel = rowStatut(d);
                    const avatarTone =
                      statutLabel === 'En cours'
                        ? 'bg-sky-50 text-sky-700 ring-1 ring-sky-200'
                        : statutLabel.startsWith('Payé')
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : statutLabel === 'Non payé'
                        ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                        : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
                    return (
                      <tr
                        key={d.id}
                        onClick={() => setSelectedDriverDetails(d)}
                        className="group cursor-pointer"
                        title="Cliquez pour afficher la fiche détaillée du chauffeur"
                      >
                        <td className="whitespace-nowrap">
                          <span className="inline-flex items-center rounded-md bg-slate-900 px-2 py-0.5 font-mono text-xs font-bold text-white">
                            TR {d.tr}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ${avatarTone}`}>
                              {driverInitials(d.nom)}
                            </span>
                            <div className="min-w-0">
                              <p className="max-w-[13rem] truncate text-[13px] font-bold text-slate-900 group-hover:text-sky-700 transition-colors" title={d.nom}>
                                {d.nom}
                              </p>
                              {(d.serie !== '—' || d.sousSerie !== '—') && (
                                <p className="font-mono text-[10.5px] text-slate-400">
                                  Série {d.serie} · SS {d.sousSerie}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex flex-col items-start gap-0.5">
                            <span
                              className={`inline-block max-w-[11rem] truncate rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
                                isStandby
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-sky-50 text-sky-800 border border-sky-200/70'
                              }`}
                            >
                              {d.programmeJour || 'STAND-BY'}
                            </span>
                            {d.statut === 'PAYE' ? (
                              <span className="text-[10.5px] font-semibold text-emerald-600">Réglée</span>
                            ) : d.statut === 'PAS DE CAISSE' ? (
                              <span className="text-[10.5px] text-slate-400">Sans caisse</span>
                            ) : retard.isOverdue ? (
                              <span className="text-[10.5px] font-bold text-rose-600">
                                Retard : {retard.text}
                              </span>
                            ) : (
                              <span className="text-[10.5px] text-slate-500">
                                {retard.text}
                              </span>
                            )}
                          </div>
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <UnpaidCaissesSelect
                            driver={d}
                            allDrivers={drivers}
                            isSuperviseur={isSuperviseur}
                          />
                        </td>
                        <td>
                          <span
                            className={
                              statutLabel === 'En cours'
                                ? 'badge bg-sky-50 text-sky-800 border border-sky-200'
                                : statutLabel.startsWith('Payé')
                                ? 'badge-emerald'
                                : statutLabel === 'Non payé'
                                ? 'badge-rose'
                                : 'badge-slate'
                            }
                          >
                            {statutLabel}
                          </span>
                        </td>
                        <td>
                          <PaidAtCaisse code={caisseOf(d)} paidBy={paidByOf(d)} />
                        </td>
                        {!isSuperviseur && (
                          <td className="text-right" onClick={(e) => e.stopPropagation()}>
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
                                className="btn-primary !h-8 !px-2.5 !text-xs font-bold"
                                title="Ouvrir au Guichet de Caisse"
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
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700 ring-1 ring-sky-200/80">
                    <IconHistory className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="card-title text-sm sm:text-base">
                      Historique de Clôture (CRNU · CRSF · CRTN)
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Totaux individuels par caisse et montant global cumulé
                    </p>
                  </div>
                </div>
                <Link
                  href="/billetterie/historique"
                  className="btn-ghost !py-1.5 !px-3 text-xs font-bold text-sky-700 border border-sky-200 bg-sky-50/50"
                >
                  Ouvrir l&apos;Historique →
                </Link>
              </div>

              <div className="p-5 space-y-4">
                {/* Montant Global de Clôture */}
                <div className="rounded-xl bg-slate-900 p-4 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Montant Global de Clôture (CRNU + CRSF + CRTN)
                    </span>
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-300">
                      Cumul Global
                    </span>
                  </div>
                  <p className="mt-1.5 font-mono text-2xl font-extrabold text-white">
                    {formatMoney(globalTotalCloture)}{' '}
                    <span className="text-xs font-normal text-sky-400">TND</span>
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
        /* VUE CAISSE NORMALE (CRNU, CRSF ou CRTN) */
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Colonne 1 : Grille Bento des modules opérationnels (7 col) */}
          <div className="card p-5 flex flex-col justify-between lg:col-span-7">
            <div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                <div>
                  <h3 className="text-base font-extrabold tracking-tight text-slate-900">
                    Modules de votre caisse
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Accès rapide aux opérations courantes ({currentUser?.displayName})
                  </p>
                </div>
                <span className="badge-indigo font-mono text-[10.5px]">
                  {currentUser?.caisseCode || currentUser?.username?.toUpperCase()}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Link
                  href="/caisse"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-sky-50/70 via-white to-white p-4 transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-600 text-white shadow-2xs">
                      <IconCalculator className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-sky-100/80 px-2 py-0.5 font-mono text-[10px] font-bold text-sky-800">
                      {allNonPayes.length} à régler
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="flex items-center justify-between text-sm font-extrabold text-slate-900 group-hover:text-sky-700">
                      <span>Guichet de Caisse</span>
                      <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Pointage TR, saisie des coupures et émission de reçus
                    </p>
                  </div>
                </Link>

                <Link
                  href="/billetterie"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50/60 via-white to-white p-4 transition-all hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-2xs">
                      <IconCoins className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-emerald-100/80 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
                      {formatMoney(sheetCoupures)} TND
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="flex items-center justify-between text-sm font-extrabold text-slate-900 group-hover:text-emerald-700">
                      <span>Comptage Billetterie</span>
                      <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Inventaire des 11 coupures, versements et clôture
                    </p>
                  </div>
                </Link>

                <Link
                  href="/programme"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/80">
                      <IconCalendar className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                      {enCours.length} en cours
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="flex items-center justify-between text-sm font-extrabold text-slate-900 group-hover:text-indigo-700">
                      <span>Programme &amp; Bascule 12:30</span>
                      <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" />
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Tournées du jour et historique journalier des impayés
                    </p>
                  </div>
                </Link>

                <Link
                  href="/billetterie/historique"
                  className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                      <IconHistory className="h-5 w-5" />
                    </div>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                      PV A4
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="flex items-center justify-between text-sm font-extrabold text-slate-900">
                      <span>Historique des Clôtures</span>
                      <IconArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-800" />
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Archives des journées clôturées et réimpression A4
                    </p>
                  </div>
                </Link>
              </div>
            </div>
          </div>

          {/* Colonne 2 : Derniers Reçus Validés (5 col) */}
          <div className="card overflow-hidden flex flex-col justify-between lg:col-span-5">
            <div>
              <div className="card-header !py-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/80">
                    <IconReceipt className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">
                      Derniers reçus validés
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {transactions.length} encaissement{transactions.length > 1 ? 's' : ''} sur cette session
                    </p>
                  </div>
                </div>
                <Link
                  href="/journal"
                  className="btn-ghost !h-8 !px-3 !text-xs font-semibold"
                >
                  Journal →
                </Link>
              </div>

              {transactions.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <IconReceipt className="h-5 w-5" />
                  </div>
                  <p className="mt-2.5 text-xs font-semibold text-slate-600">
                    Aucun reçu validé pour le moment
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Les encaissements du guichet apparaîtront ici en direct.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto">
                  {transactions.slice(0, 10).map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between gap-2.5 px-4 py-3 text-xs transition-colors hover:bg-slate-50/80"
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-[10px] font-bold text-white">
                          {t.codeChauffeur}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-slate-900">
                            {t.nomChauffeur}
                          </p>
                          <p className="text-[11px] text-slate-400">{formatDateTime(t.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="num font-extrabold text-emerald-700">
                            +{formatMoney(t.tPayer)} TND
                          </p>
                          <p className="num text-[10px] text-slate-400">
                            Bord. {formatMoney(t.recette)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openTransactionReceipt(t)}
                          className="btn-icon !h-8 !w-8 text-slate-400 hover:!bg-sky-50 hover:!text-sky-600"
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
                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-600 hover:text-sky-700"
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
                        ? 'bg-rose-600 text-white'
                        : activeCategoryModal === 'STANDBY_NON_PAYES'
                        ? 'bg-orange-500 text-white'
                        : activeCategoryModal === 'PAYES'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-indigo-600 text-white';
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
                          </div>
                          <p className="mt-0.5 truncate text-xs font-semibold tracking-wide text-slate-500">{d.programmeJour || 'Stand-by'}</p>
                          <div className="mt-1">
                            <PaidAtCaisse code={caisseOf(d)} paidBy={paidByOf(d)} />
                          </div>
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
          subtitle={`TR ${selectedDriverDetails.tr} · ${selectedDriverDetails.statut}${caisseOf(selectedDriverDetails) ? ` · ${caisseOf(selectedDriverDetails)}` : ''}${paidByOf(selectedDriverDetails) ? ` · ${paidByOf(selectedDriverDetails)}` : ''}`}
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
    </div>
  );
}
