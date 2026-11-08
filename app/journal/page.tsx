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
  IconDownload,
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
  const isSyncing = useCaisseStore((state) => state.isSyncing);

  const isSupervisorOrAdmin =
    currentUser?.role === 'superviseur' || currentUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'ACTIF' | 'ARCHIVES'>('ACTIF');
  const [caisseFilter, setCaisseFilter] = useState<'ALL' | 'CRNU' | 'CRSF' | 'CRTN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyClosings, setHistoryClosings] = useState<BilletterieHistoryEntry[]>([]);
  const [selectedClosingId, setSelectedClosingId] = useState<string>('ALL');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

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

      <PageHeader
        title={
          isSupervisorOrAdmin
            ? 'Journal des Transactions Avancé (CRNU · CRSF · CRTN)'
            : `Journal des Transactions — ${currentUser?.displayName || 'Ma Caisse'}`
        }
        subtitle={
          isSupervisorOrAdmin
            ? 'Suivi en temps réel du journal du jour, filtrage par recherche et accès complet aux archives de clôture de toutes les caisses'
            : 'Suivi en temps réel des encaissements du jour, recherche rapide et archives de clôture de votre caisse'
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
              className="btn-ghost flex-1 sm:flex-none min-h-11 justify-center text-xs sm:text-sm font-semibold"
            >
              <IconSync className={`h-4 w-4 ${isSyncing || loadingHistory ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={() => window.print()}
              disabled={displayedTransactions.length === 0}
              className="btn-ghost flex-1 sm:flex-none min-h-11 justify-center text-xs sm:text-sm font-semibold"
            >
              <IconPrinter className="h-4 w-4" />
              Imprimer l&apos;État
            </button>
            <button
              onClick={handleExport}
              disabled={displayedTransactions.length === 0}
              className="btn-primary flex-1 sm:flex-none min-h-11 justify-center text-xs sm:text-sm font-bold shadow-md"
            >
              <IconDownload className="h-4 w-4" />
              Exporter (.xlsx)
            </button>
          </div>
        }
      />

      {/* Tabs Switcher: Le Journal du Jour vs Les Archives de Clôture (Spécification 6) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 no-print">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('ACTIF')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'ACTIF'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <IconReceipt className="h-4 w-4" />
            <span>Le Journal du Jour (En Direct)</span>
            <span className="ml-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-mono">
              {todaySource.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ARCHIVES')}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              activeTab === 'ARCHIVES'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <IconHistory className="h-4 w-4" />
            <span>Les Archives de Clôture</span>
            <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700 font-mono">
              {allArchivedTransactions.length}
            </span>
          </button>
        </div>

        {/* Filtre par Caisse (CRNU, CRSF, CRTN) */}
        {isSupervisorOrAdmin && (
          <div className="flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white p-1">
            {(['ALL', 'CRNU', 'CRSF', 'CRTN'] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setCaisseFilter(code)}
                className={`rounded-xl px-3 py-1.5 text-xs font-extrabold transition-all ${
                  caisseFilter === code
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {code === 'ALL' ? 'Toutes les Caisses' : code}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Barre de Recherche Avancée + Sélection d'Archive de Clôture */}
      <div className="card p-4 mb-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 no-print">
        <div className="relative flex-1">
          <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher une transaction par nom de chauffeur, code TR, caisse (CRNU/CRSF/CRTN), référence ou heure..."
            className="input !pl-10 text-xs sm:text-sm font-medium w-full"
          />
        </div>

        {activeTab === 'ARCHIVES' && historyClosings.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <IconCalendar className="h-4 w-4 text-slate-500 shrink-0" />
            <select
              value={selectedClosingId}
              onChange={(e) => setSelectedClosingId(e.target.value)}
              className="select !h-10 text-xs font-semibold max-w-xs sm:max-w-sm"
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

      {/* Résumé Financier Détaillé (Total, MT Espèce, Versement, Écart) */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-5">
        <div className="card p-4 sm:p-5 bg-slate-900 text-white">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            Total Encaissé (T. Payer)
          </p>
          <p className="num text-lg sm:text-xl font-black text-white mt-1">
            {formatMoney(totalPaye)}{' '}
            <span className="text-xs text-indigo-300 font-normal">TND</span>
          </p>
        </div>

        <div className="card p-4 sm:p-5 border-emerald-200 bg-emerald-50/40">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">
            Montant Espèces (MT Espèce)
          </p>
          <p className="num text-lg sm:text-xl font-black text-emerald-800 mt-1">
            {formatMoney(totalMtEspece)}{' '}
            <span className="text-xs text-emerald-600 font-normal">TND</span>
          </p>
        </div>

        <div className="card p-4 sm:p-5 border-indigo-200 bg-indigo-50/40">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-700">
            Total Versements
          </p>
          <p className="num text-lg sm:text-xl font-black text-indigo-800 mt-1">
            {formatMoney(totalVersement)}{' '}
            <span className="text-xs text-indigo-600 font-normal">TND</span>
          </p>
        </div>

        <div className="card p-4 sm:p-5">
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
            Recette Attendue / Écart
          </p>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="num text-sm font-bold text-slate-700">
              {formatMoney(totalRecette)} TND
            </span>
            <span
              className={`num text-xs font-extrabold ${
                totalEcart >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              ({totalEcart > 0 ? '+' : ''}
              {formatMoney(totalEcart)})
            </span>
          </div>
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
            {/* Mobile View */}
            <div className="divide-y divide-slate-100 md:hidden">
              {displayedTransactions.map((t) => {
                const mtEsp =
                  typeof t.mtEspece === 'number'
                    ? t.mtEspece
                    : Math.round((t.tPayer - (t.versement || 0)) * 1000) / 1000;
                return (
                  <div
                    key={`${t.accountId || ''}-${t.id}`}
                    className="p-4 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-white">
                          {t.caisseCode || 'CAISSE'}
                        </span>
                        <span className="badge-indigo font-mono text-xs font-bold">
                          TR {t.codeChauffeur}
                        </span>
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {t.nomChauffeur}
                        </p>
                      </div>
                      <span className="badge-emerald text-[11px]">{t.status}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 rounded-xl p-2.5 my-2">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          MT Espèce
                        </span>
                        <span className="num font-bold text-emerald-700">
                          {formatMoney(mtEsp)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Versement
                        </span>
                        <span className="num font-bold text-indigo-700">
                          {formatMoney(t.versement)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                          Total Payé
                        </span>
                        <span className="num font-black text-slate-900">
                          {formatMoney(t.tPayer)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs">
                      <span className="text-slate-400">{formatDateTime(t.date)}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className={`num font-bold ${
                            t.resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'
                          }`}
                        >
                          Écart: {t.resAPayer > 0 ? '+' : ''}
                          {formatMoney(t.resAPayer)} TND
                        </span>
                        <button
                          type="button"
                          onClick={() => openReceipt(t)}
                          className="btn-icon !h-7 !w-7 text-indigo-600 hover:bg-indigo-50"
                          title="Imprimer Reçu"
                        >
                          <IconPrinter className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table */}
            <div className="table-wrap hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-24">Caisse</th>
                    <th className="w-40">Date & Heure</th>
                    <th className="w-44">Chauffeur</th>
                    <th className="w-20">Code TR</th>
                    <th className="!text-right w-32">MT Espèce</th>
                    <th className="!text-right w-28">Versement</th>
                    <th className="!text-right w-32">Total Payé</th>
                    <th className="!text-right w-32">Recette</th>
                    <th className="!text-right w-32">Écart</th>
                    <th className="!text-center w-24">Statut</th>
                    <th className="!text-center w-16 no-print">Reçu</th>
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
                        className="hover:bg-slate-50/80 transition-colors"
                      >
                        <td>
                          <span
                            className={`inline-flex rounded-lg px-2.5 py-0.5 font-mono text-xs font-black text-white ${
                              code === 'CRNU'
                                ? 'bg-indigo-600'
                                : code === 'CRSF'
                                ? 'bg-emerald-600'
                                : code === 'CRTN'
                                ? 'bg-sky-600'
                                : 'bg-slate-800'
                            }`}
                          >
                            {code}
                          </span>
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
                          <span className="num font-bold text-indigo-700">#{t.codeChauffeur}</span>
                        </td>
                        <td className="text-right num font-bold text-emerald-700">
                          {formatMoney(mtEsp)} TND
                        </td>
                        <td className="text-right num font-semibold text-indigo-700">
                          {t.versement > 0 ? `${formatMoney(t.versement)} TND` : '0.000 TND'}
                        </td>
                        <td className="text-right num font-black text-slate-900">
                          {formatMoney(t.tPayer)} TND
                        </td>
                        <td className="text-right num text-slate-600">
                          {formatMoney(t.recette)} TND
                        </td>
                        <td className="text-right num font-bold">
                          <span className={t.resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                            {t.resAPayer > 0 ? '+' : ''}
                            {formatMoney(t.resAPayer)} TND
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="badge-emerald">{t.status}</span>
                        </td>
                        <td className="text-center no-print">
                          <button
                            type="button"
                            onClick={() => openReceipt(t)}
                            className="btn-icon !h-8 !w-8 text-indigo-600 hover:bg-indigo-50 inline-flex items-center justify-center"
                            title="Imprimer Reçu / Facture HD"
                          >
                            <IconPrinter className="h-4 w-4" />
                          </button>
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
