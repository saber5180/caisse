'use client';

import { useCaisseStore } from '@/lib/store';
import { formatDate, formatDateTime, formatMoney } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import {
  IconDownload,
  IconPrinter,
  IconReceipt,
} from '@/components/Icons';
import * as XLSX from 'xlsx';

export default function JournalPage() {
  const transactions = useCaisseStore((state) => state.transactions);

  const totalRecette = transactions.reduce((sum, t) => sum + t.recette, 0);
  const totalPaye = transactions.reduce((sum, t) => sum + t.tPayer, 0);
  const totalEcart = totalPaye - totalRecette;

  const handleExport = () => {
    const data = transactions.map((t) => ({
      'Date & Heure': formatDateTime(t.date),
      'Code Chauffeur (TR)': t.codeChauffeur,
      'Nom Chauffeur': t.nomChauffeur,
      'Recette Théorique (TND)': t.recette,
      'Total Payé Réel (TND)': t.tPayer,
      'Écart / Reste (TND)': t.resAPayer,
      'Versement (TND)': t.versement,
      'Statut': t.status,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ETAT DE CAISSE');
    XLSX.writeFile(wb, `etat_de_caisse_${Date.now()}.xlsx`);
  };

  return (
    <>
      <PageHeader
        title="Journal des Transactions"
        subtitle="Historique complet des encaissements archivés par chauffeur et session"
        icon={<IconReceipt className="h-5 w-5" />}
        accent="emerald"
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              onClick={() => window.print()}
              disabled={transactions.length === 0}
              className="btn-ghost flex-1 sm:flex-none min-h-11 justify-center text-xs sm:text-sm font-semibold"
            >
              <IconPrinter className="h-4 w-4" />
              Imprimer l&apos;État
            </button>
            <button
              onClick={handleExport}
              disabled={transactions.length === 0}
              className="btn-primary flex-1 sm:flex-none min-h-11 justify-center text-xs sm:text-sm font-bold shadow-md"
            >
              <IconDownload className="h-4 w-4" />
              Exporter (.xlsx)
            </button>
          </div>
        }
      />

      {/* Résumé Financier du Journal */}
      <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3 mb-5">
        <div className="card p-4 sm:p-5">
          <p className="label !mb-1 text-[11px]">Total Recettes Théoriques</p>
          <p className="num text-lg sm:text-xl font-bold text-slate-800">
            {formatMoney(totalRecette)} <span className="text-xs text-slate-400 font-normal">TND</span>
          </p>
        </div>
        <div className="card p-4 sm:p-5">
          <p className="label !mb-1 text-[11px]">Total Payé Réel</p>
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

      {/* Tableau ou Cartes des Transactions */}
      <div className="card overflow-hidden">
        <div className="card-header bg-slate-50/70">
          <h2 className="card-title text-sm">
            {transactions.length} Transaction{transactions.length > 1 ? 's' : ''} Enregistrée{transactions.length > 1 ? 's' : ''}
          </h2>
          <span className="badge-emerald font-semibold text-[11px]">Archivage sécurisé</span>
        </div>

        {transactions.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title="Aucune transaction"
            description="Les transactions validées depuis le guichet de caisse apparaîtront ici."
          />
        ) : (
          <>
            {/* Mobile Card View (md:hidden) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {transactions.map((t) => (
                <div key={t.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="badge-indigo font-mono text-xs">TR {t.codeChauffeur}</span>
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
                    <span className={`num font-bold ${t.resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      Écart: {t.resAPayer > 0 ? '+' : ''}{formatMoney(t.resAPayer)} TND
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="table-wrap hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date & Heure</th>
                    <th>Chauffeur</th>
                    <th>TR</th>
                    <th className="!text-right">Recette (Attendu)</th>
                    <th className="!text-right">T. Payer (Encaissé)</th>
                    <th className="!text-right">Écart (Reste)</th>
                    <th className="!text-right">Versement</th>
                    <th className="!text-center">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="text-xs text-slate-500 whitespace-nowrap">
                        {formatDateTime(t.date)}
                      </td>
                      <td>
                        <span className="font-semibold text-slate-900">{t.nomChauffeur}</span>
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
