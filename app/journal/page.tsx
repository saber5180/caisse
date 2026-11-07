'use client';

import { useEffect, useState } from 'react';
import { useCaisseStore } from '@/lib/store';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils';
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
} from '@/components/Icons';
import * as XLSX from 'xlsx';

export default function JournalPage() {
  const currentUser = useCaisseStore((state) => state.currentUser);
  const activeTransactions = useCaisseStore((state) => state.transactions);

  const [activeTab, setActiveTab] = useState<'ACTIF' | 'ARCHIVES'>('ACTIF');
  const [historyClosings, setHistoryClosings] = useState<BilletterieHistoryEntry[]>([]);
  const [selectedClosingId, setSelectedClosingId] = useState<string>('ALL');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

  useEffect(() => {
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
    fetchHistory();
  }, []);

  // Compute all archived transactions across closings
  const allArchivedTransactions: (CashTransaction & { clotureDate?: string; clotureId?: string })[] =
    historyClosings.flatMap((h) => {
      const txns = Array.isArray(h.archivedTransactions) ? h.archivedTransactions : [];
      return txns.map((t) => ({
        ...t,
        clotureDate: h.dateCloture,
        clotureId: h.id,
      }));
    });

  const displayedArchived =
    selectedClosingId === 'ALL'
      ? allArchivedTransactions
      : allArchivedTransactions.filter((t) => t.clotureId === selectedClosingId);

  const displayedTransactions =
    activeTab === 'ACTIF' ? activeTransactions : displayedArchived;

  const totalRecette = displayedTransactions.reduce((sum, t) => sum + t.recette, 0);
  const totalPaye = displayedTransactions.reduce((sum, t) => sum + t.tPayer, 0);
  const totalEcart = totalPaye - totalRecette;

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
      caisseName: currentUser?.displayName,
      cashierName: currentUser?.username,
    });
  };

  const handleExport = () => {
    const data = displayedTransactions.map((t) => ({
      'Date & Heure': formatDateTime(t.date),
      'Code Chauffeur (TR)': t.codeChauffeur,
      'Nom Chauffeur': t.nomChauffeur,
      'Recette Théorique (TND)': t.recette,
      'Total Payé Réel (TND)': t.tPayer,
      'Écart / Reste (TND)': t.resAPayer,
      'Versement (TND)': t.versement,
      Statut: t.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    const sheetTitle = activeTab === 'ACTIF' ? 'JOURNAL_ACTIF' : 'JOURNAL_ARCHIVE';
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle);
    XLSX.writeFile(wb, `${sheetTitle.toLowerCase()}_${Date.now()}.xlsx`);
  };

  return (
    <>
      {receiptData && (
        <PrintReceiptModal data={receiptData} onClose={() => setReceiptData(null)} />
      )}

      <PageHeader
        title="Journal des Transactions de Caisse"
        subtitle="Historique des encaissements actifs et consultation des transactions archivées par clôture"
        icon={<IconReceipt className="h-5 w-5" />}
        accent="emerald"
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
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

      {/* Tabs Switcher: Journal Actif vs Archives Clôtures */}
      <div className="flex items-center gap-2 mb-5 no-print">
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
          <span>Journal Actif (En cours)</span>
          <span className="ml-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300 font-mono">
            {activeTransactions.length}
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
          <span>Archives des Clôtures</span>
          <span className="ml-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700 font-mono">
            {allArchivedTransactions.length}
          </span>
        </button>
      </div>

      {/* Filter by Closing Date when in Archives tab */}
      {activeTab === 'ARCHIVES' && historyClosings.length > 0 && (
        <div className="card p-3.5 sm:p-4 mb-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print bg-slate-50/70">
          <div className="flex items-center gap-2">
            <IconCalendar className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700">Filtrer par Arrêté de Clôture :</span>
          </div>
          <select
            value={selectedClosingId}
            onChange={(e) => setSelectedClosingId(e.target.value)}
            className="select !h-9 text-xs font-medium max-w-md"
          >
            <option value="ALL">Toutes les clôtures ({allArchivedTransactions.length} opérations)</option>
            {historyClosings.map((c) => (
              <option key={c.id} value={c.id}>
                Clôture du {new Date(c.dateCloture).toLocaleString('fr-FR')} · {c.caissierNom || 'Opérateur'} ({c.archivedTransactions?.length || 0} reçus)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Résumé Financier du Journal */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3 mb-5">
        <div className="card p-4 sm:p-5">
          <p className="label !mb-1 text-[11px]">Total Recettes Théoriques</p>
          <p className="num text-lg sm:text-xl font-bold text-slate-800">
            {formatMoney(totalRecette)} <span className="text-xs text-slate-400 font-normal">TND</span>
          </p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="label !mb-1 text-[11px]">Total Payé Réel (Encaissé)</p>
          <p className="num text-lg sm:text-xl font-bold text-emerald-700">
            {formatMoney(totalPaye)} <span className="text-xs text-slate-400 font-normal">TND</span>
          </p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="label !mb-1 text-[11px]">Écart Cumulé Global</p>
          <p className={`num text-lg sm:text-xl font-bold ${totalEcart >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
            {totalEcart > 0 ? '+' : ''}{formatMoney(totalEcart)} <span className="text-xs text-slate-400 font-normal">TND</span>
          </p>
        </div>
      </div>

      {/* Tableau des Transactions */}
      <div className="card overflow-hidden">
        <div className="card-header bg-slate-50/70">
          <h2 className="card-title text-sm">
            {activeTab === 'ACTIF' ? 'Journal Actif du Jour' : 'Transactions Archivées'} ({displayedTransactions.length} opération{displayedTransactions.length > 1 ? 's' : ''})
          </h2>
          <span className="badge-emerald font-semibold text-[11px]">
            {activeTab === 'ACTIF' ? 'Session active' : 'Archivage sécurisé'}
          </span>
        </div>

        {displayedTransactions.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title={activeTab === 'ACTIF' ? 'Aucune transaction dans la session active' : 'Aucune transaction archivée'}
            description={
              activeTab === 'ACTIF'
                ? 'Les encaissements validés au guichet apparaîtront ici. Lors de la clôture journalière, ils seront automatiquement archivés.'
                : 'Les transactions archivées lors des clôtures de journée apparaîtront ici.'
            }
          />
        ) : (
          <>
            {/* Mobile View */}
            <div className="divide-y divide-slate-100 md:hidden">
              {displayedTransactions.map((t) => (
                <div key={t.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="badge-indigo font-mono text-xs font-bold">TR {t.codeChauffeur}</span>
                      <p className="text-sm font-bold text-slate-900">{t.nomChauffeur}</p>
                    </div>
                    <span className="badge-emerald text-[11px]">{t.status}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-xl p-2.5 my-2">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Attendu</span>
                      <span className="num font-bold text-slate-700">{formatMoney(t.recette)} TND</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-semibold">Encaissé Réel</span>
                      <span className="num font-bold text-emerald-700">{formatMoney(t.tPayer)} TND</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-xs">
                    <span className="text-slate-400">{formatDateTime(t.date)}</span>
                    <div className="flex items-center gap-2">
                      <span className={`num font-bold ${t.resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        Écart: {t.resAPayer > 0 ? '+' : ''}{formatMoney(t.resAPayer)} TND
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
              ))}
            </div>

            {/* Desktop Table */}
            <div className="table-wrap hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-40">Date & Heure</th>
                    <th className="w-48">Chauffeur</th>
                    <th className="w-20">Code TR</th>
                    <th className="!text-right w-36">Recette (Attendu)</th>
                    <th className="!text-right w-36">T. Payer (Encaissé)</th>
                    <th className="!text-right w-36">Écart (Reste)</th>
                    <th className="!text-right w-28">Versement</th>
                    <th className="!text-center w-24">Statut</th>
                    <th className="!text-center w-16 no-print">Reçu</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(t.date)}
                      </td>
                      <td>
                        <span className="font-semibold text-slate-900 truncate max-w-[190px] block" title={t.nomChauffeur}>
                          {t.nomChauffeur}
                        </span>
                      </td>
                      <td>
                        <span className="num font-bold text-indigo-700">{t.codeChauffeur}</span>
                      </td>
                      <td className="text-right num text-slate-600">
                        {formatMoney(t.recette)} TND
                      </td>
                      <td className="text-right num font-bold text-slate-900">
                        {formatMoney(t.tPayer)} TND
                      </td>
                      <td className="text-right num font-bold">
                        <span className={t.resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                          {t.resAPayer > 0 ? '+' : ''}{formatMoney(t.resAPayer)} TND
                        </span>
                      </td>
                      <td className="text-right num text-slate-500">
                        {t.versement > 0 ? `${formatMoney(t.versement)} TND` : '—'}
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
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
