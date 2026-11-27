'use client';

import { useEffect, useMemo, useState } from 'react';
import { useCaisseStore } from '@/lib/store';
import { formatDateTime, formatMoney } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import PrintReceiptModal, { ReceiptData } from '@/components/PrintReceiptModal';
import { BilletterieHistoryEntry, CashTransaction } from '@/types/caisse';
import {
  IconCalendar,
  IconClose,
  IconDownload,
  IconEdit,
  IconHistory,
  IconPrinter,
  IconReceipt,
  IconSearch,
  IconSync,
} from '@/components/Icons';
import * as XLSX from 'xlsx';

export default function JournalPage() {
  const currentUser = useCaisseStore((state) => state.currentUser);
  const activeTransactions = useCaisseStore((state) => state.transactions);
  const allTransactions = useCaisseStore((state) => state.allTransactions);
  const fetchAccountData = useCaisseStore((state) => state.fetchAccountData);
  const updateJournalTransaction = useCaisseStore((state) => state.updateJournalTransaction);
  const isSyncing = useCaisseStore((state) => state.isSyncing);

  const isSuperviseur = currentUser?.role === 'superviseur';
  const isSupervisorOrAdmin = isSuperviseur || currentUser?.role === 'admin';
  const canEditJournal = !isSuperviseur;

  const [activeTab, setActiveTab] = useState<'ACTIF' | 'ARCHIVES'>('ACTIF');
  const [caisseFilter, setCaisseFilter] = useState<'ALL' | 'CRNU' | 'CRSF' | 'CRTN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyClosings, setHistoryClosings] = useState<BilletterieHistoryEntry[]>([]);
  const [selectedClosingId, setSelectedClosingId] = useState<string>('ALL');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [editingTx, setEditingTx] = useState<CashTransaction | null>(null);
  const [editRecette, setEditRecette] = useState('');
  const [editEspece, setEditEspece] = useState('');
  const [editVersement, setEditVersement] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const parseAmount = (raw: string) => {
    const n = parseFloat(raw.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : Number.NaN;
  };

  const openEdit = (t: CashTransaction) => {
    const mtEsp =
      typeof t.mtEspece === 'number'
        ? t.mtEspece
        : Math.round((t.tPayer - (t.versement || 0)) * 1000) / 1000;
    setEditingTx(t);
    setEditRecette(t.recette.toFixed(3));
    setEditEspece(mtEsp.toFixed(3));
    setEditVersement((t.versement || 0).toFixed(3));
    setEditError(null);
  };

  const previewEspece = parseAmount(editEspece);
  const previewVersement = parseAmount(editVersement);
  const previewRecette = parseAmount(editRecette);
  const previewTotal =
    Number.isFinite(previewEspece) && Number.isFinite(previewVersement)
      ? Math.round((previewEspece + previewVersement) * 1000) / 1000
      : Number.NaN;
  const previewEcart =
    Number.isFinite(previewTotal) && Number.isFinite(previewRecette)
      ? Math.round((previewTotal - previewRecette) * 1000) / 1000
      : Number.NaN;

  const saveEdit = async () => {
    if (!editingTx) return;
    const recette = parseAmount(editRecette);
    const mtEspece = parseAmount(editEspece);
    const versement = parseAmount(editVersement);
    if (![recette, mtEspece, versement].every((n) => Number.isFinite(n) && n >= 0)) {
      setEditError('Saisissez des montants valides (0 ou plus).');
      return;
    }
    setEditSaving(true);
    setEditError(null);
    const result = await updateJournalTransaction(editingTx, { recette, mtEspece, versement });
    setEditSaving(false);
    if (!result.ok) {
      setEditError(result.error || 'Modification impossible.');
      return;
    }
    setEditingTx(null);
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/caisse/billetterie/history', { cache: 'no-store' });
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setHistoryClosings(json.data);
        }
      }
    } catch (e) {
      console.error('Fetch history closings error:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // Source des transactions du jour : toutes les caisses pour Superviseur/Admin, sinon caisse active
  const todaySource =
    isSupervisorOrAdmin && allTransactions.length > 0 ? allTransactions : activeTransactions;

  // Toutes les transactions archivées issues des clôtures passées
  const allArchivedTransactions: (CashTransaction & {
    clotureDate?: string;
    clotureId?: string;
  })[] = useMemo(() => {
    return historyClosings.flatMap((h) => {
      const txns = Array.isArray(h.archivedTransactions) ? h.archivedTransactions : [];
      return txns.map((t) => ({
        ...t,
        caisseCode: t.caisseCode || h.caisseCode || h.caissierNom || 'CAISSE',
        caisseName: t.caisseName || h.caisseName || h.caissierNom || 'Caisse',
        mtEspece:
          typeof t.mtEspece === 'number'
            ? t.mtEspece
            : Math.round(((t.tPayer || 0) - (t.versement || 0)) * 1000) / 1000,
        clotureDate: h.dateCloture,
        clotureId: h.id,
      }));
    });
  }, [historyClosings]);

  const rawDisplayed = useMemo(() => {
    if (activeTab === 'ACTIF') {
      return todaySource;
    }
    return selectedClosingId === 'ALL'
      ? allArchivedTransactions
      : allArchivedTransactions.filter((t) => t.clotureId === selectedClosingId);
  }, [activeTab, todaySource, allArchivedTransactions, selectedClosingId]);

  // Application du filtre Caisse (CRNU / CRSF / CRTN) et de la Barre de Recherche (Spécification 6)
  const displayedTransactions = useMemo(() => {
    return rawDisplayed.filter((t) => {
      const code = (t.caisseCode || '').toUpperCase();
      const matchCaisse = caisseFilter === 'ALL' ? true : code === caisseFilter;

      const q = searchQuery.toLowerCase().trim();
      const matchSearch = q
        ? (t.nomChauffeur || '').toLowerCase().includes(q) ||
          (t.codeChauffeur || '').toLowerCase().includes(q) ||
          code.toLowerCase().includes(q) ||
          (t.id || '').toLowerCase().includes(q) ||
          formatDateTime(t.date).toLowerCase().includes(q)
        : true;

      return matchCaisse && matchSearch;
    });
  }, [rawDisplayed, caisseFilter, searchQuery]);

  const totalRecette = displayedTransactions.reduce((sum, t) => sum + t.recette, 0);
  const totalPaye = displayedTransactions.reduce((sum, t) => sum + t.tPayer, 0);
  const totalVersement = displayedTransactions.reduce((sum, t) => sum + (t.versement || 0), 0);
  const totalMtEspece = Math.round((totalPaye - totalVersement) * 1000) / 1000;
  const totalEcart = Math.round((totalPaye - totalRecette) * 1000) / 1000;

  const openReceipt = (t: CashTransaction) => {
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
      caisseName: t.caisseName || currentUser?.displayName,
      cashierName: t.caisseCode || currentUser?.username,
    });
  };

  const handleExport = () => {
    const data = displayedTransactions.map((t) => {
      const mtEsp =
        typeof t.mtEspece === 'number'
          ? t.mtEspece
          : Math.round((t.tPayer - (t.versement || 0)) * 1000) / 1000;
      return {
        Caisse: t.caisseCode || currentUser?.caisseCode || 'CAISSE',
        'Date & Heure': formatDateTime(t.date),
        'Code Chauffeur (TR)': t.codeChauffeur,
        'Nom Chauffeur': t.nomChauffeur,
        'MT Espèce (TND)': mtEsp,
        'Versement (TND)': t.versement,
        'Total Payé Réel (TND)': t.tPayer,
        'Recette Théorique (TND)': t.recette,
        'Écart / Reste (TND)': t.resAPayer,
        Statut: t.status,
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const sheetTitle = activeTab === 'ACTIF' ? 'JOURNAL_DU_JOUR' : 'ARCHIVES_CLOTURES';
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
    XLSX.writeFile(wb, `${sheetTitle.toLowerCase()}_${Date.now()}.xlsx`);
  };

  return (
    <>
      {receiptData && (
        <PrintReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}

      {editingTx && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4">
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Modifier la ligne</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {editingTx.caisseCode || 'CAISSE'} · TR {editingTx.codeChauffeur} · {editingTx.nomChauffeur}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Fermer"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600">
                Recette attendue (TND)
                <input
                  value={editRecette}
                  onChange={(e) => setEditRecette(e.target.value)}
                  inputMode="decimal"
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                MT Espèce (TND)
                <input
                  value={editEspece}
                  onChange={(e) => setEditEspece(e.target.value)}
                  inputMode="decimal"
                  className="input mt-1 w-full"
                />
              </label>
              <label className="block text-xs font-bold text-slate-600">
                Versement (TND)
                <input
                  value={editVersement}
                  onChange={(e) => setEditVersement(e.target.value)}
                  inputMode="decimal"
                  className="input mt-1 w-full"
                />
              </label>
              <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Total payé :{' '}
                <strong className="text-slate-900">
                  {Number.isFinite(previewTotal) ? previewTotal.toFixed(3) : '—'} TND
                </strong>
                {' · '}
                Écart :{' '}
                <strong className={previewEcart >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {Number.isFinite(previewEcart) ? `${previewEcart > 0 ? '+' : ''}${previewEcart.toFixed(3)}` : '—'} TND
                </strong>
              </div>
              {editError && (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {editError}
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setEditingTx(null)} className="btn-ghost">
                Annuler
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={editSaving}
                className="btn-primary"
              >
                {editSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <PageHeader
        title={
          isSupervisorOrAdmin
            ? 'Journal des Caisses (CRNU · CRSF · CRTN)'
            : `Journal des Transactions — ${currentUser?.displayName || 'Ma Caisse'}`
        }
        subtitle={
          isSupervisorOrAdmin
            ? 'Suivi en direct des encaissements, espèces, versements et archives de clôture'
            : 'Historique chronologique des encaissements validés et impression des reçus'
        }
        icon={<IconReceipt className="h-5 w-5" />}
        accent="emerald"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => {
                fetchAccountData();
                fetchHistory();
              }}
              className="btn-ghost flex-1 sm:flex-none justify-center !py-2 text-xs font-semibold"
            >
              <IconSync className={`h-4 w-4 ${isSyncing || loadingHistory ? 'animate-spin' : ''}`} />
              Rafraîchir
            </button>
            <button
              onClick={() => window.print()}
              disabled={displayedTransactions.length === 0}
              className="btn-ghost flex-1 sm:flex-none justify-center !py-2 text-xs font-semibold"
            >
              <IconPrinter className="h-4 w-4 text-sky-600" />
              Imprimer
            </button>
            <button
              onClick={handleExport}
              disabled={displayedTransactions.length === 0}
              className="btn-primary flex-1 sm:flex-none justify-center !py-2 text-xs font-bold"
            >
              <IconDownload className="h-4 w-4" />
              Exporter (.xlsx)
            </button>
          </div>
        }
      />

      {/* Onglets Journal du Jour vs Archives */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIF')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'ACTIF'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <IconReceipt className="h-4 w-4" />
            <span>Journal du jour</span>
            <span className="ml-0.5 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300 font-mono">
              {todaySource.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ARCHIVES')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
              activeTab === 'ARCHIVES'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <IconHistory className="h-4 w-4" />
            <span>Archives de clôture</span>
            <span className="ml-0.5 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-700 font-mono">
              {allArchivedTransactions.length}
            </span>
          </button>
        </div>

        {/* Filtre par Caisse */}
        {isSupervisorOrAdmin && (
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1">
            {(['ALL', 'CRNU', 'CRSF', 'CRTN'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCaisseFilter(code)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-all ${
                  caisseFilter === code
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {code === 'ALL' ? 'Toutes' : code}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Recherche + Sélection de clôture */}
      <div className="card p-3.5 mb-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 no-print">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom de chauffeur, code TR, caisse, référence ou heure..."
            className="input !h-9 !min-h-9 !pl-10 text-xs font-medium w-full"
          />
        </div>

        {activeTab === 'ARCHIVES' && historyClosings.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <IconCalendar className="h-4 w-4 text-slate-500 shrink-0" />
            <select
              value={selectedClosingId}
              onChange={(e) => setSelectedClosingId(e.target.value)}
              className="select !h-9 !min-h-9 text-xs font-semibold max-w-xs sm:max-w-sm"
            >
              <option value="ALL">
                Toutes les clôtures ({allArchivedTransactions.length} reçus)
              </option>
              {historyClosings.map((c) => (
                <option key={c.id} value={c.id}>
                  [{c.caisseCode || c.caissierNom || 'CAISSE'}] Clôture du{' '}
                  {new Date(c.dateCloture).toLocaleString('fr-FR')} ({c.archivedTransactions?.length || 0} reçus)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Résumé Financier (4 cartes) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 mb-4">
        <div className="rounded-xl bg-slate-900 p-4 text-white shadow-2xs">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total payé
          </p>
          <p className="num text-xl sm:text-2xl font-extrabold text-white mt-1.5">
            {formatMoney(totalPaye)}{' '}
            <span className="font-mono text-xs text-sky-400 font-semibold">TND</span>
          </p>
        </div>

        <div className="card p-4 border-emerald-200 bg-emerald-50/50">
          <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
            MT Espèces
          </p>
          <p className="num text-xl sm:text-2xl font-extrabold text-emerald-800 mt-1.5">
            {formatMoney(totalMtEspece)}{' '}
            <span className="font-mono text-xs text-emerald-600 font-semibold">TND</span>
          </p>
        </div>

        <div className="card p-4 border-sky-200 bg-sky-50/50">
          <p className="text-[11px] font-bold uppercase tracking-wider text-sky-700">
            Versements
          </p>
          <p className="num text-xl sm:text-2xl font-extrabold text-sky-900 mt-1.5">
            {formatMoney(totalVersement)}{' '}
            <span className="font-mono text-xs text-sky-600 font-semibold">TND</span>
          </p>
        </div>

        <div className="card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {isSuperviseur ? 'Recette attendue' : 'Attendu & Écart'}
          </p>
          {isSuperviseur ? (
            <p className="num mt-1.5 text-xl sm:text-2xl font-extrabold text-slate-900">
              {formatMoney(totalRecette)}{' '}
              <span className="font-mono text-xs font-semibold text-slate-400">TND</span>
            </p>
          ) : (
            <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-1">
              <span className="num text-lg sm:text-xl font-extrabold text-slate-900">
                {formatMoney(totalRecette)} <span className="font-mono text-[10px] text-slate-400">TND</span>
              </span>
              <span
                className={`num text-xs font-bold ${
                  totalEcart >= 0 ? 'text-emerald-700' : 'text-rose-600'
                }`}
              >
                ({totalEcart > 0 ? '+' : ''}
                {formatMoney(totalEcart)})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Tableau des Transactions */}
      <div className="card overflow-hidden">
        <div className="card-header bg-slate-50/70">
          <h2 className="card-title text-sm">
            {activeTab === 'ACTIF'
              ? 'Journal du Jour en Temps Réel'
              : 'Transactions des Archives de Clôture'}{' '}
            ({displayedTransactions.length} opération{displayedTransactions.length > 1 ? 's' : ''})
          </h2>
          <span className="badge-emerald font-semibold text-[11px]">
            {isSupervisorOrAdmin
              ? caisseFilter === 'ALL'
                ? 'CRNU · CRSF · CRTN'
                : `Caisse ${caisseFilter}`
              : currentUser?.displayName || 'Session Active'}
          </span>
        </div>

        {displayedTransactions.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title={
              activeTab === 'ACTIF'
                ? 'Aucune transaction trouvée dans le journal du jour'
                : 'Aucune transaction trouvée dans les archives de clôture'
            }
            description={
              activeTab === 'ACTIF'
                ? 'Les encaissements validés dans les caisses CRNU, CRSF et CRTN s’affichent ici en temps réel.'
                : 'Les transactions archivées lors des clôtures journalières des caisses CRNU, CRSF et CRTN apparaissent ici.'
            }
          />
        ) : (
          <>
            {/* Liste compacte & responsive Mobile / Tablette / Laptop < 1280px (xl:hidden) */}
            <div className="divide-y divide-slate-100 xl:hidden">
              {displayedTransactions.map((t) => {
                const mtEsp =
                  typeof t.mtEspece === 'number'
                    ? t.mtEspece
                    : Math.round((t.tPayer - (t.versement || 0)) * 1000) / 1000;
                const code = t.caisseCode || currentUser?.caisseCode || 'CAISSE';
                return (
                  <div
                    key={`${t.accountId || ''}-${t.id}`}
                    className="p-3.5 sm:px-5 hover:bg-slate-50/70 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`shrink-0 rounded px-2 py-0.5 font-mono text-[10px] font-bold text-white ${
                            code === 'CRNU'
                              ? 'bg-sky-600'
                              : code === 'CRSF'
                              ? 'bg-emerald-600'
                              : code === 'CRTN'
                              ? 'bg-indigo-600'
                              : 'bg-slate-800'
                          }`}
                        >
                          {code}
                        </span>
                        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-800 border border-slate-200">
                          TR {t.codeChauffeur}
                        </span>
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {t.nomChauffeur}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="badge-emerald text-[10.5px]">{t.status}</span>
                        <button
                          type="button"
                          onClick={() => openReceipt(t)}
                          className="btn-icon !h-7 !w-7 text-sky-600 hover:bg-sky-50"
                          title="Imprimer Reçu"
                        >
                          <IconPrinter className="h-3.5 w-3.5" />
                        </button>
                        {canEditJournal && activeTab === 'ACTIF' && (
                          <button
                            type="button"
                            onClick={() => openEdit(t)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                            title="Modifier cette ligne"
                          >
                            <IconEdit className="h-3.5 w-3.5" />
                            Modifier
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs">
                      <span className="text-slate-500">
                        {formatDateTime(t.date)}
                        {t.operatorUsername ? ` · @${t.operatorUsername}` : ''}
                      </span>

                      <div className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-50 px-2.5 py-1.5 border border-slate-200/70 sm:bg-transparent sm:border-0 sm:p-0">
                        <span className="text-[11px] text-slate-500">
                          Espèces : <strong className="num text-emerald-700">{formatMoney(mtEsp)}</strong>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Vers : <strong className="num text-sky-700">{formatMoney(t.versement)}</strong>
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Total : <strong className="num text-slate-900">{formatMoney(t.tPayer)} TND</strong>
                        </span>
                        {!isSuperviseur && (
                          <span
                            className={`num text-[11px] font-bold ${
                              t.resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }`}
                          >
                            Écart {t.resAPayer > 0 ? '+' : ''}
                            {formatMoney(t.resAPayer)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tableau Grand Écran (hidden xl:block) */}
            <div className="table-wrap hidden xl:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-24">Caisse</th>
                    <th className="w-40">Date &amp; Heure</th>
                    <th>Chauffeur</th>
                    <th className="w-20">Code TR</th>
                    <th className="!text-right">MT Espèce</th>
                    <th className="!text-right">Versement</th>
                    <th className="!text-right">Total Payé</th>
                    <th className="!text-right">Recette</th>
                    {!isSuperviseur && <th className="!text-right">Écart</th>}
                    <th className="!text-center">Statut</th>
                    <th className="!text-center no-print">Reçu</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTransactions.map((t) => {
                    const mtEsp =
                      typeof t.mtEspece === 'number'
                        ? t.mtEspece
                        : Math.round((t.tPayer - (t.versement || 0)) * 1000) / 1000;
                    const code = t.caisseCode || currentUser?.caisseCode || 'CAISSE';
                    return (
                      <tr
                        key={`${t.accountId || ''}-${t.id}`}
                      >
                        <td>
                          <span
                            className={`inline-flex rounded px-2 py-0.5 font-mono text-xs font-bold text-white ${
                              code === 'CRNU'
                                ? 'bg-sky-600'
                                : code === 'CRSF'
                                ? 'bg-emerald-600'
                                : code === 'CRTN'
                                ? 'bg-indigo-600'
                                : 'bg-slate-800'
                            }`}
                          >
                            {code}
                          </span>
                          {t.operatorUsername && (
                            <span className="mt-0.5 block text-[10px] font-semibold text-slate-500">
                              @{t.operatorUsername}
                            </span>
                          )}
                        </td>
                        <td className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDateTime(t.date)}
                        </td>
                        <td>
                          <span
                            className="font-semibold text-slate-900 truncate max-w-[180px] block"
                            title={t.nomChauffeur}
                          >
                            {t.nomChauffeur}
                          </span>
                        </td>
                        <td>
                          <span className="num font-bold text-slate-800">#{t.codeChauffeur}</span>
                        </td>
                        <td className="text-right num font-bold text-emerald-700">
                          {formatMoney(mtEsp)} TND
                        </td>
                        <td className="text-right num font-semibold text-sky-700">
                          {t.versement > 0 ? `${formatMoney(t.versement)} TND` : '0.000 TND'}
                        </td>
                        <td className="text-right num font-extrabold text-slate-900">
                          {formatMoney(t.tPayer)} TND
                        </td>
                        <td className="text-right num text-slate-600">
                          {formatMoney(t.recette)} TND
                        </td>
                        {!isSuperviseur && (
                          <td className="text-right num font-bold">
                            <span className={t.resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {t.resAPayer > 0 ? '+' : ''}
                              {formatMoney(t.resAPayer)} TND
                            </span>
                          </td>
                        )}
                        <td className="text-center">
                          <span className="badge-emerald">{t.status}</span>
                        </td>
                        <td className="text-center no-print">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openReceipt(t)}
                              className="btn-icon !h-8 !w-8 text-sky-600 hover:bg-sky-50 inline-flex items-center justify-center"
                              title="Imprimer Reçu / Facture HD"
                            >
                              <IconPrinter className="h-4 w-4" />
                            </button>
                            {canEditJournal && activeTab === 'ACTIF' && (
                              <button
                                type="button"
                                onClick={() => openEdit(t)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                title="Modifier cette ligne"
                              >
                                <IconEdit className="h-3.5 w-3.5" />
                                Modifier
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
