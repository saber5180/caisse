'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCaisseStore, computeDeskTotals } from '@/lib/store';
import { formatMoney } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import {
  IconCalculator,
  IconCheck,
  IconClose,
  IconPrinter,
  IconSearch,
  IconTrash,
} from '@/components/Icons';

function CaisseContent() {
  const searchParams = useSearchParams();
  const initialTr = searchParams.get('tr') || '';

  const drivers = useCaisseStore((state) => state.drivers);
  const deskRows = useCaisseStore((state) => state.deskRows);
  const deskRecette = useCaisseStore((state) => state.deskRecette);
  const deskVersement = useCaisseStore((state) => state.deskVersement);
  const deskTrInput = useCaisseStore((state) => state.deskTrInput);
  const selectedDriverId = useCaisseStore((state) => state.selectedDriverId);

  const setDeskEntree = useCaisseStore((state) => state.setDeskEntree);
  const setDeskSortie = useCaisseStore((state) => state.setDeskSortie);
  const setDeskRecette = useCaisseStore((state) => state.setDeskRecette);
  const setDeskVersement = useCaisseStore((state) => state.setDeskVersement);
  const setDeskTrInput = useCaisseStore((state) => state.setDeskTrInput);
  const selectDriverByTr = useCaisseStore((state) => state.selectDriverByTr);
  const validateCurrentSale = useCaisseStore((state) => state.validateCurrentSale);
  const resetDesk = useCaisseStore((state) => state.resetDesk);

  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [printReceiptData, setPrintReceiptData] = useState<{
    nom: string;
    tr: string;
    tPayer: number;
    recette: number;
    resAPayer: number;
    versement: number;
    date: string;
  } | null>(null);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  // If query parameter TR provided, auto-select
  useEffect(() => {
    if (initialTr) {
      setDeskTrInput(initialTr);
      selectDriverByTr(initialTr);
    }
  }, [initialTr, setDeskTrInput, selectDriverByTr]);

  // Compute live totals
  const { tPayer, resAPayer } = computeDeskTotals(deskRows, deskVersement, deskRecette);

  // Hotkey listener for 'v', 'p', 'r' when not typing in text fields
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement?.tagName.toLowerCase();
      if (activeEl === 'input' || activeEl === 'textarea' || activeEl === 'select') {
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault();
        handleValidate();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        resetDesk();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  const handleScannerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (deskTrInput.trim()) {
      selectDriverByTr(deskTrInput.trim());
    }
  };

  const handleValidate = () => {
    const txn = validateCurrentSale();
    if (txn) {
      setPrintReceiptData({
        nom: txn.nomChauffeur || 'Comptoir',
        tr: txn.codeChauffeur || '',
        tPayer: txn.tPayer,
        recette: txn.recette,
        resAPayer: txn.resAPayer,
        versement: txn.versement,
        date: new Date().toLocaleString('fr-FR'),
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Color logic for C14/C16
  let balanceCardBg = 'bg-slate-50 border-slate-200 text-slate-800';
  let balanceStatusText = 'Équilibre';
  if (resAPayer > 0.001) {
    balanceCardBg = 'bg-emerald-600 border-emerald-700 text-white shadow-emerald-600/25';
    balanceStatusText = 'Excédent / Trop-Perçu';
  } else if (resAPayer < -0.001) {
    balanceCardBg = 'bg-rose-600 border-rose-700 text-white shadow-rose-600/25';
    balanceStatusText = 'Déficit / Manque à Payer';
  }

  return (
    <div className="mx-auto max-w-5xl pb-20 sm:pb-6">
      {/* Responsive Page Header */}
      <PageHeader
        title="Guichet de Caisse"
        subtitle="Saisie des entrées/sorties par coupure, pointage chauffeur et encaissement direct"
        icon={<IconCalculator className="h-5 w-5" />}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              onClick={resetDesk}
              className="btn-ghost flex-1 sm:flex-none !py-2 !text-xs sm:!text-sm"
              title="Raccourci: R"
            >
              <IconTrash className="h-4 w-4" />
              <span className="hidden sm:inline">Réinitialiser [R]</span>
              <span className="sm:hidden">Reset</span>
            </button>
            <button
              onClick={handlePrint}
              className="btn-ghost flex-1 sm:flex-none !py-2 !text-xs sm:!text-sm"
              title="Raccourci: P"
            >
              <IconPrinter className="h-4 w-4" />
              <span className="hidden sm:inline">Imprimer [P]</span>
              <span className="sm:hidden">Reçu</span>
            </button>
            <button
              onClick={handleValidate}
              className="btn-success w-full sm:w-auto !py-2.5 sm:!py-2 text-sm font-bold shadow-md"
              title="Raccourci: V"
            >
              <IconCheck className="h-4 w-4" />
              <span>Valider la Vente [V]</span>
            </button>
          </div>
        }
      />

      {/* Top Barcode Scanner & Driver Details */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Scanner C1 */}
        <div className="card p-4 sm:p-5 md:col-span-1">
          <label className="label flex items-center justify-between">
            <span>Scanner Code TR</span>
            <span className="badge-slate">Cellule C1</span>
          </label>
          <form onSubmit={handleScannerSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                ref={scannerInputRef}
                type="text"
                value={deskTrInput}
                onChange={(e) => setDeskTrInput(e.target.value)}
                placeholder="Ex: 37, 34, 107..."
                className="input num !pl-9 uppercase"
              />
            </div>
            <button type="submit" className="btn-primary !px-3">
              OK
            </button>
          </form>
          <p className="mt-2 text-[11px] text-slate-400">
            Pointez au scanner ou tapez le code TR puis Entrée.
          </p>
        </div>

        {/* Chauffeur Trouvé */}
        <div className="card p-4 sm:p-5 md:col-span-2">
          {selectedDriver ? (
            <div className="flex flex-col justify-between h-full sm:flex-row sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge-indigo font-mono text-xs">TR {selectedDriver.tr}</span>
                  <h3 className="text-base font-bold text-slate-900">{selectedDriver.nom}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Circuit: <strong>{selectedDriver.programmeJour || 'STAND-BY'}</strong> · Statut:{' '}
                  <strong className={selectedDriver.statut === 'NON PAYE' ? 'text-rose-600' : 'text-emerald-600'}>
                    {selectedDriver.statut}
                  </strong>
                </p>
                {selectedDriver.reclamation && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-600 bg-rose-50 px-2 py-0.5 rounded inline-block">
                    {selectedDriver.reclamation}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="badge-emerald px-3 py-1 text-xs font-bold">Chauffeur Prêt</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs sm:text-sm py-4">
              Scannez ou saisissez un code chauffeur pour lier l&apos;encaissement.
            </div>
          )}
        </div>
      </div>

      {/* Main Cash Desk Grid (Tableau de Calcule) */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne Mobile Première: Synthèse & Équilibre (C14, C15, C16) */}
        <div className="space-y-4 lg:col-span-1 lg:order-2">
          {/* Card Récapitulative Dynamique */}
          <div className={`card p-5 sm:p-6 border-2 transition-all duration-300 shadow-md ${balanceCardBg}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase font-bold tracking-wider opacity-85">
                État de Caisse en Direct
              </p>
              <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-black/15">
                {balanceStatusText}
              </span>
            </div>

            <div className="mt-5 space-y-3 sm:space-y-4">
              {/* T. PAYER */}
              <div className="flex items-center justify-between border-b border-black/10 pb-2.5">
                <span className="text-xs sm:text-sm font-medium opacity-90">T. PAYER (Encaissé)</span>
                <span className="num text-xl sm:text-2xl font-extrabold tracking-tight">
                  {formatMoney(tPayer)} <span className="text-xs font-normal">TND</span>
                </span>
              </div>

              {/* RECETTE */}
              <div className="border-b border-black/10 pb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs sm:text-sm font-medium opacity-90">
                    RECETTE (Attendu)
                  </label>
                  <span className="num text-base sm:text-lg font-bold">
                    {formatMoney(deskRecette)} <span className="text-xs font-normal">TND</span>
                  </span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={deskRecette === 0 ? '' : deskRecette}
                  onChange={(e) => setDeskRecette(parseFloat(e.target.value) || 0)}
                  placeholder="Saisir la recette..."
                  className="input num !min-h-10 !py-1 text-slate-900 bg-white font-bold text-base"
                />
              </div>

              {/* RES. A PAYER */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs sm:text-sm font-bold uppercase tracking-wider">
                  RES. A PAYER
                </span>
                <span className="num text-2xl sm:text-3xl font-black tracking-tight">
                  {resAPayer > 0 ? '+' : ''}{formatMoney(resAPayer)} <span className="text-xs font-normal">TND</span>
                </span>
              </div>
            </div>

            {/* Desktop Action Buttons inside card */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleValidate}
                className="btn w-full bg-white text-slate-900 shadow-md hover:bg-slate-100 font-bold !py-3"
              >
                <IconCheck className="h-4 w-4 text-emerald-600" />
                Valider Vente [Touche V]
              </button>

              <button
                onClick={resetDesk}
                className="btn w-full bg-black/15 text-current hover:bg-black/25 text-xs font-semibold !py-2"
              >
                <IconTrash className="h-3.5 w-3.5" />
                Nettoyer le Tableau [Touche R]
              </button>
            </div>
          </div>

          {/* Guide des Raccourcis (Desktop) */}
          <div className="card p-4 hidden lg:block">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Raccourcis Clavier
            </h4>
            <div className="mt-2 space-y-1.5 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Valider et Archiver</span>
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-slate-200">
                  V
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Imprimer Reçu</span>
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-slate-200">
                  P
                </kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>Réinitialiser</span>
                <kbd className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-800 ring-1 ring-slate-200">
                  R
                </kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Colonnes: Tableau des Coupures */}
        <div className="card overflow-hidden lg:col-span-2 lg:order-1">
          <div className="card-header bg-slate-50/70">
            <div>
              <h2 className="card-title text-sm">Entrées & Sorties par Coupure</h2>
              <p className="text-[11px] text-slate-400">Saisissez les billets/pièces encaissés et rendus</p>
            </div>
            <span className="badge-indigo">Tableau interactif</span>
          </div>

          {/* Mobile Denomination Cards View (sm:hidden) */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {deskRows.map((row, idx) => {
              const netLigne = row.entree * row.denomination - row.sortie * row.denomination;

              return (
                <div key={idx} className="p-3.5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
                      {row.denomination} TND
                    </span>
                    <span className={`num text-xs font-bold ${netLigne >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                      Net: {formatMoney(netLigne)} TND
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-emerald-700 block mb-0.5">
                        + Entrée (Reçu)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={row.entree === 0 ? '' : row.entree}
                        onChange={(e) => setDeskEntree(idx, parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        className="input num !h-10 !text-center text-sm font-semibold text-emerald-700 bg-emerald-50/40 border-emerald-200"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-rose-700 block mb-0.5">
                        - Sortie (Rendu)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={row.sortie === 0 ? '' : row.sortie}
                        onChange={(e) => setDeskSortie(idx, parseInt(e.target.value, 10) || 0)}
                        placeholder="0"
                        className="input num !h-10 !text-center text-sm font-semibold text-rose-700 bg-rose-50/40 border-rose-200"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Mobile Versement Row */}
            <div className="p-3.5 bg-slate-50/80">
              <label className="text-xs uppercase font-bold text-indigo-700 block mb-1">
                Versement direct (Banque / Coffre)
              </label>
              <input
                type="number"
                step="0.001"
                min={0}
                value={deskVersement === 0 ? '' : deskVersement}
                onChange={(e) => setDeskVersement(parseFloat(e.target.value) || 0)}
                placeholder="0.000 TND"
                className="input num !h-10 text-sm font-bold text-indigo-700"
              />
            </div>
          </div>

          {/* Desktop Table View (hidden sm:block) */}
          <div className="table-wrap hidden sm:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-24">Coupure</th>
                  <th className="!text-center">L&apos;entrée de caisse</th>
                  <th className="!text-center">Sortie de caisse</th>
                  <th className="!text-right">Montant Net (TND)</th>
                </tr>
              </thead>
              <tbody>
                {deskRows.map((row, idx) => {
                  const netLigne = row.entree * row.denomination - row.sortie * row.denomination;

                  return (
                    <tr key={idx}>
                      <td>
                        <span className="num font-bold text-slate-900 text-sm">
                          {row.denomination} TND
                        </span>
                      </td>
                      <td className="text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.entree === 0 ? '' : row.entree}
                          onChange={(e) => setDeskEntree(idx, parseInt(e.target.value, 10) || 0)}
                          placeholder="0"
                          className="input num !w-24 !min-h-9 !py-1 !text-center text-sm font-semibold text-emerald-700 bg-emerald-50/30"
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.sortie === 0 ? '' : row.sortie}
                          onChange={(e) => setDeskSortie(idx, parseInt(e.target.value, 10) || 0)}
                          placeholder="0"
                          className="input num !w-24 !min-h-9 !py-1 !text-center text-sm font-semibold text-rose-700 bg-rose-50/30"
                        />
                      </td>
                      <td className="text-right">
                        <span className={`num font-bold ${netLigne >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                          {formatMoney(netLigne)}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {/* Ligne Versement */}
                <tr className="bg-slate-50/60 font-semibold">
                  <td>
                    <span className="text-xs uppercase tracking-wider text-indigo-700 font-bold">
                      VERSEMENT
                    </span>
                  </td>
                  <td colSpan={2} className="text-right pr-4">
                    <span className="text-xs text-slate-500 font-normal">
                      Versement direct (Banque / Coffre) :
                    </span>
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      value={deskVersement === 0 ? '' : deskVersement}
                      onChange={(e) => setDeskVersement(parseFloat(e.target.value) || 0)}
                      placeholder="0.000"
                      className="input num !w-32 !min-h-9 !py-1 !text-right text-sm font-bold text-indigo-700"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-md shadow-lg sm:hidden">
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400">T. Payer / Reste</p>
          <p className="num text-sm font-black text-slate-900">
            {formatMoney(tPayer)} /{' '}
            <span className={resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {resAPayer > 0 ? '+' : ''}{formatMoney(resAPayer)}
            </span>
          </p>
        </div>
        <button
          onClick={handleValidate}
          className="btn-success !py-2 !px-4 text-xs font-bold shadow-md"
        >
          <IconCheck className="h-4 w-4" />
          Valider Vente
        </button>
      </div>

      {/* Ticket Modal de Confirmation */}
      {printReceiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setPrintReceiptData(null)}
          />
          <div className="relative w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-2">
                <IconCheck className="h-6 w-6" />
              </span>
              <h3 className="text-lg font-bold text-slate-900">Encaissement Enregistré</h3>
              <p className="text-xs text-slate-400">{printReceiptData.date}</p>
            </div>

            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 font-mono text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Chauffeur:</span>
                <span className="font-bold text-slate-900">{printReceiptData.nom}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Code TR:</span>
                <span className="font-bold text-slate-900">{printReceiptData.tr}</span>
              </div>
              <div className="border-t border-slate-200 my-1 pt-1 flex justify-between">
                <span className="text-slate-500">Recette Atten.:</span>
                <span className="font-bold">{formatMoney(printReceiptData.recette)} TND</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Total Payé:</span>
                <span className="font-bold text-emerald-700">
                  {formatMoney(printReceiptData.tPayer)} TND
                </span>
              </div>
              <div className="border-t border-slate-200 pt-1 flex justify-between font-bold">
                <span>Reste / Écart:</span>
                <span className={printReceiptData.resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatMoney(printReceiptData.resAPayer)} TND
                </span>
              </div>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => {
                  window.print();
                  setPrintReceiptData(null);
                }}
                className="btn-primary flex-1 !text-xs !py-2.5"
              >
                <IconPrinter className="h-4 w-4" />
                Imprimer le Reçu
              </button>
              <button
                onClick={() => setPrintReceiptData(null)}
                className="btn-ghost !text-xs !py-2.5"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaissePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Chargement du guichet...</div>}>
      <CaisseContent />
    </Suspense>
  );
}
