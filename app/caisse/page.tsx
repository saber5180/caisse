'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCaisseStore, computeDeskTotals } from '@/lib/store';
import { formatMoney, generateId } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import PrintReceiptModal, { ReceiptData } from '@/components/PrintReceiptModal';
import {
  IconCalculator,
  IconCheck,
  IconClose,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconTruck,
} from '@/components/Icons';

function CaisseContent() {
  const searchParams = useSearchParams();
  const initialTr = searchParams.get('tr') || '';

  const currentUser = useCaisseStore((state) => state.currentUser);
  const drivers = useCaisseStore((state) => state.drivers);
  const deskRows = useCaisseStore((state) => state.deskRows);
  const deskRecette = useCaisseStore((state) => state.deskRecette);
  const deskVersement = useCaisseStore((state) => state.deskVersement);
  const deskVersementBanque = useCaisseStore((state) => state.deskVersementBanque);
  const deskVersementCoffre = useCaisseStore((state) => state.deskVersementCoffre);
  const deskTrInput = useCaisseStore((state) => state.deskTrInput);
  const selectedDriverId = useCaisseStore((state) => state.selectedDriverId);

  const setDeskEntree = useCaisseStore((state) => state.setDeskEntree);
  const setDeskSortie = useCaisseStore((state) => state.setDeskSortie);
  const setDeskRecette = useCaisseStore((state) => state.setDeskRecette);
  const setDeskVersement = useCaisseStore((state) => state.setDeskVersement);
  const setDeskVersementBanque = useCaisseStore((state) => state.setDeskVersementBanque);
  const setDeskVersementCoffre = useCaisseStore((state) => state.setDeskVersementCoffre);
  const setDeskTrInput = useCaisseStore((state) => state.setDeskTrInput);
  const selectDriverByTr = useCaisseStore((state) => state.selectDriverByTr);
  const validateCurrentSale = useCaisseStore((state) => state.validateCurrentSale);
  const resetDesk = useCaisseStore((state) => state.resetDesk);

  const scannerInputRef = useRef<HTMLInputElement>(null);
  const [printModalData, setPrintModalData] = useState<ReceiptData | null>(null);

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  // Auto-select TR if query param present
  useEffect(() => {
    if (initialTr) {
      setDeskTrInput(initialTr);
      selectDriverByTr(initialTr);
    }
  }, [initialTr, setDeskTrInput, selectDriverByTr]);

  // Compute live totals
  const { tPayer, resAPayer } = computeDeskTotals(deskRows, deskVersement, deskRecette);

  // Hotkey listener for 'v', 'p', 'r' when not typing in inputs
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
        handleOpenPrintPreview();
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

  const handleOpenPrintPreview = () => {
    setPrintModalData({
      receiptNo: generateId('REC'),
      nom: selectedDriver?.nom || 'Comptoir Direct',
      tr: selectedDriver?.tr || deskTrInput || '—',
      circuit: selectedDriver?.programmeJour || 'STAND-BY',
      recette: deskRecette,
      tPayer,
      resAPayer,
      versement: deskVersement,
      versementBanque: deskVersementBanque,
      versementCoffre: deskVersementCoffre,
      rows: deskRows,
      date: new Date().toLocaleString('fr-FR'),
      caisseName: currentUser?.displayName,
      cashierName: currentUser?.username,
    });
  };

  const handleValidate = () => {
    const txn = validateCurrentSale();
    if (txn) {
      setPrintModalData({
        receiptNo: txn.id,
        nom: txn.nomChauffeur || 'Comptoir Direct',
        tr: txn.codeChauffeur || '',
        circuit: selectedDriver?.programmeJour || 'STAND-BY',
        recette: txn.recette,
        tPayer: txn.tPayer,
        resAPayer: txn.resAPayer,
        versement: txn.versement,
        versementBanque: deskVersementBanque,
        versementCoffre: deskVersementCoffre,
        rows: deskRows,
        date: new Date().toLocaleString('fr-FR'),
        caisseName: currentUser?.displayName,
        cashierName: currentUser?.username,
      });
    }
  };

  // Status accent
  let balanceStatusText = 'Équilibre';
  let balancePillBg = 'bg-slate-800 text-slate-200 border-slate-700';
  let balanceGlowClass = '';
  if (resAPayer > 0.001) {
    balanceStatusText = 'Excédent / Trop-Perçu';
    balancePillBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
    balanceGlowClass = 'shadow-glow-emerald';
  } else if (resAPayer < -0.001) {
    balanceStatusText = 'Déficit / Manque à Payer';
    balancePillBg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
    balanceGlowClass = 'shadow-glow-rose';
  }

  return (
    <div className="mx-auto max-w-5xl pb-24 sm:pb-8">
      {/* Page Header Pro */}
      <PageHeader
        title="Guichet de Caisse"
        subtitle="Encaissement direct, décompte par coupures et décharge officielle"
        icon={<IconCalculator className="h-5 w-5" />}
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              onClick={resetDesk}
              className="btn-ghost flex-1 sm:flex-none !py-2 text-xs sm:text-sm"
              title="Raccourci: R"
            >
              <IconTrash className="h-4 w-4 text-slate-400" />
              <span>Nettoyer [R]</span>
            </button>
            <button
              onClick={handleOpenPrintPreview}
              className="btn-ghost flex-1 sm:flex-none !py-2 text-xs sm:text-sm font-semibold"
              title="Raccourci: P"
            >
              <IconPrinter className="h-4 w-4 text-indigo-600" />
              <span>Imprimer Reçu [P]</span>
            </button>
            <button
              onClick={handleValidate}
              className="btn-success w-full sm:w-auto !py-2.5 text-xs sm:text-sm font-bold shadow-md"
              title="Raccourci: V"
            >
              <IconCheck className="h-4 w-4" />
              <span>Valider la Vente [V]</span>
            </button>
          </div>
        }
      />

      {/* FinTech Terminal Topbar: Scanner + Selected Driver */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Scanner Barcode Box */}
        <div className="card-pro p-4 sm:p-5 md:col-span-1">
          <label className="label flex items-center justify-between">
            <span>Scanner Code Chauffeur (TR)</span>
            <span className="badge-slate font-mono text-[10px]">C1</span>
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
                className="input num !pl-9 uppercase font-bold"
              />
            </div>
            <button type="submit" className="btn-primary !px-3 font-bold">
              OK
            </button>
          </form>
          <p className="mt-2 text-[11px] text-slate-400">
            Scannez au lecteur optique ou tapez le code TR puis Entrée.
          </p>
        </div>

        {/* Selected Driver Banner */}
        <div className="card-pro p-4 sm:p-5 md:col-span-2">
          {selectedDriver ? (
            <div className="flex flex-col justify-between h-full sm:flex-row sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge-indigo font-mono text-xs font-bold">
                    TR {selectedDriver.tr}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">{selectedDriver.nom}</h3>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Circuit : <strong className="text-slate-800">{selectedDriver.programmeJour || 'STAND-BY'}</strong> · Statut :{' '}
                  <strong className={selectedDriver.statut === 'NON PAYE' ? 'text-rose-600' : 'text-emerald-600'}>
                    {selectedDriver.statut}
                  </strong>
                </p>
                {selectedDriver.reclamation && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 inline-block">
                    {selectedDriver.reclamation}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="badge-solid-emerald px-3 py-1 text-xs font-bold shadow-sm">
                  Chauffeur Pointé
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs sm:text-sm py-4">
              Scannez ou sélectionnez un chauffeur pour lier l&apos;encaissement.
            </div>
          )}
        </div>
      </div>

      {/* Main Terminal Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Terminal Financial Monitor Card (Order 1 on mobile, Order 2 on desktop) */}
        <div className="space-y-4 lg:col-span-1 lg:order-2">
          <div className={`rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-6 text-white shadow-xl transition-all duration-300 ${balanceGlowClass}`}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Situation Financière
              </span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${balancePillBg}`}>
                {balanceStatusText}
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {/* T. PAYER */}
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <span className="text-xs text-slate-300 font-medium">T. PAYER (Encaissé)</span>
                <span className="num text-2xl font-black tracking-tight text-white">
                  {formatMoney(tPayer)} <span className="text-xs font-normal text-slate-400">TND</span>
                </span>
              </div>

              {/* RECETTE */}
              <div className="border-b border-slate-800/80 pb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-300 font-medium">RECETTE (Attendu)</label>
                  <span className="num text-base font-bold text-indigo-300">
                    {formatMoney(deskRecette)} <span className="text-xs text-slate-400 font-normal">TND</span>
                  </span>
                </div>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={deskRecette === 0 ? '' : deskRecette}
                  onChange={(e) => setDeskRecette(parseFloat(e.target.value) || 0)}
                  placeholder="0.000 TND"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm font-bold text-white placeholder-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              {/* RES. A PAYER */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  RES. A PAYER
                </span>
                <span className={`num text-2xl sm:text-3xl font-black tracking-tight ${
                  resAPayer > 0 ? 'text-emerald-400' : resAPayer < 0 ? 'text-rose-400' : 'text-slate-200'
                }`}>
                  {resAPayer > 0 ? '+' : ''}{formatMoney(resAPayer)} <span className="text-xs font-normal text-slate-400">TND</span>
                </span>
              </div>
            </div>

            {/* Direct Action Buttons inside terminal card */}
            <div className="mt-6 space-y-2">
              <button
                onClick={handleValidate}
                className="btn w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black shadow-lg shadow-emerald-500/20 !py-3"
              >
                <IconCheck className="h-5 w-5" />
                Valider la Vente [Touche V]
              </button>
              <button
                onClick={handleOpenPrintPreview}
                className="btn w-full bg-white/10 hover:bg-white/20 text-white font-semibold text-xs !py-2.5"
              >
                <IconPrinter className="h-4 w-4" />
                Aperçu Reçu / Facture [Touche P]
              </button>
            </div>
          </div>

          {/* Quick Hotkey Box (Desktop) */}
          <div className="card-pro p-4 hidden lg:block text-xs text-slate-500">
            <p className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-2">
              Raccourcis Clavier Rapides
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span>Valider et Archiver</span>
                <kbd className="bg-slate-100 rounded px-1.5 py-0.5 font-mono text-slate-700 border">V</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Imprimer Reçu</span>
                <kbd className="bg-slate-100 rounded px-1.5 py-0.5 font-mono text-slate-700 border">P</kbd>
              </div>
              <div className="flex justify-between items-center">
                <span>Remettre à zéro</span>
                <kbd className="bg-slate-100 rounded px-1.5 py-0.5 font-mono text-slate-700 border">R</kbd>
              </div>
            </div>
          </div>
        </div>

        {/* Coupures Table & Mobile Cards */}
        <div className="card-pro overflow-hidden lg:col-span-2 lg:order-1">
          <div className="card-header bg-slate-50/80">
            <div>
              <h2 className="card-title text-sm">Entrées & Sorties par Coupure</h2>
              <p className="text-[11px] text-slate-400">Saisissez les montants reçus et rendus</p>
            </div>
            <span className="badge-indigo font-mono text-xs">Tableau dynamique</span>
          </div>

          {/* Mobile Denomination Cards View (sm:hidden) */}
          <div className="divide-y divide-slate-100 sm:hidden">
            {deskRows.map((row, idx) => {
              const netLigne = row.entree * row.denomination - row.sortie * row.denomination;

              return (
                <div key={idx} className="p-3.5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-900 border border-slate-200">
                      {row.denomination} TND
                    </span>
                    <span className={`num text-xs font-bold ${netLigne >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
                      Net : {formatMoney(netLigne)} TND
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-2">
                      <label className="text-[10px] font-bold uppercase text-emerald-800 block mb-1">
                        + Entrée (Reçu)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={row.entree === 0 ? '' : row.entree}
                        onChange={(e) => setDeskEntree(idx, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full rounded-lg border border-emerald-300 bg-white py-1.5 text-center text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-2">
                      <label className="text-[10px] font-bold uppercase text-rose-800 block mb-1">
                        - Sortie (Rendu)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={row.sortie === 0 ? '' : row.sortie}
                        onChange={(e) => setDeskSortie(idx, parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-full rounded-lg border border-rose-300 bg-white py-1.5 text-center text-sm font-bold text-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Mobile Versement Inputs */}
            <div className="p-4 bg-slate-50/90 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-indigo-900">
                  Versements Directs
                </span>
                <span className="num text-xs font-bold text-indigo-700">
                  Total : {formatMoney(deskVersement)} TND
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold uppercase text-indigo-800 block mb-1">
                    Versement Banque
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={0}
                    value={deskVersementBanque === 0 ? '' : deskVersementBanque}
                    onChange={(e) => setDeskVersementBanque(parseFloat(e.target.value) || 0)}
                    placeholder="0.000 TND"
                    className="input num font-bold text-xs text-indigo-800 !h-10"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase text-indigo-800 block mb-1">
                    Versement Coffre
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min={0}
                    value={deskVersementCoffre === 0 ? '' : deskVersementCoffre}
                    onChange={(e) => setDeskVersementCoffre(parseFloat(e.target.value) || 0)}
                    placeholder="0.000 TND"
                    className="input num font-bold text-xs text-indigo-800 !h-10"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Table View (hidden sm:block) */}
          <div className="table-wrap hidden sm:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-28">Coupure</th>
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
                          step="0.1"
                          min={0}
                          value={row.entree === 0 ? '' : row.entree}
                          onChange={(e) => setDeskEntree(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="input num !w-24 !min-h-9 !py-1 !text-center text-sm font-bold text-emerald-800 bg-emerald-50/40 border-emerald-200"
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="number"
                          step="0.1"
                          min={0}
                          value={row.sortie === 0 ? '' : row.sortie}
                          onChange={(e) => setDeskSortie(idx, parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="input num !w-24 !min-h-9 !py-1 !text-center text-sm font-bold text-rose-800 bg-rose-50/40 border-rose-200"
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

                {/* Versement Banque Row */}
                <tr className="bg-slate-50/80 font-semibold border-t-2 border-slate-200">
                  <td>
                    <span className="text-xs uppercase tracking-wider text-indigo-700 font-bold">
                      VER. BANQUE
                    </span>
                  </td>
                  <td colSpan={2} className="text-right pr-4">
                    <span className="text-xs text-slate-500 font-normal">
                      Versement direct Banque / Virement :
                    </span>
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      value={deskVersementBanque === 0 ? '' : deskVersementBanque}
                      onChange={(e) => setDeskVersementBanque(parseFloat(e.target.value) || 0)}
                      placeholder="0.000"
                      className="input num !w-32 !min-h-9 !py-1 !text-right text-sm font-bold text-indigo-700"
                    />
                  </td>
                </tr>

                {/* Versement Coffre Row */}
                <tr className="bg-slate-50/80 font-semibold border-t border-slate-200">
                  <td>
                    <span className="text-xs uppercase tracking-wider text-indigo-700 font-bold">
                      VER. COFFRE
                    </span>
                  </td>
                  <td colSpan={2} className="text-right pr-4">
                    <span className="text-xs text-slate-500 font-normal">
                      Versement direct Coffre-Fort :
                    </span>
                  </td>
                  <td className="text-right">
                    <input
                      type="number"
                      step="0.001"
                      min={0}
                      value={deskVersementCoffre === 0 ? '' : deskVersementCoffre}
                      onChange={(e) => setDeskVersementCoffre(parseFloat(e.target.value) || 0)}
                      placeholder="0.000"
                      className="input num !w-32 !min-h-9 !py-1 !text-right text-sm font-bold text-indigo-700"
                    />
                  </td>
                </tr>

                {/* Total Versements Directs */}
                <tr className="bg-indigo-50/60 font-bold border-t border-indigo-200 text-indigo-900">
                  <td>
                    <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-900">
                      TOTAL VERSEMENT
                    </span>
                  </td>
                  <td colSpan={2} className="text-right pr-4 text-xs font-semibold text-indigo-800">
                    Cumul Banque + Coffre :
                  </td>
                  <td className="text-right num font-black text-sm text-indigo-950">
                    {formatMoney(deskVersement)} TND
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Mobile Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md shadow-lg sm:hidden">
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400">Total Encaissé / Écart</p>
          <p className="num text-sm font-black text-slate-900">
            {formatMoney(tPayer)} /{' '}
            <span className={resAPayer >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
              {resAPayer > 0 ? '+' : ''}{formatMoney(resAPayer)}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleOpenPrintPreview}
            className="btn-ghost !py-2 !px-2.5 text-xs font-semibold"
            title="Imprimer"
          >
            <IconPrinter className="h-4 w-4" />
          </button>
          <button
            onClick={handleValidate}
            className="btn-success !py-2 !px-3.5 text-xs font-bold shadow-md"
          >
            <IconCheck className="h-4 w-4" />
            Valider
          </button>
        </div>
      </div>

      {/* High-Definition Print & Facture Modal */}
      {printModalData && (
        <PrintReceiptModal
          data={printModalData}
          onClose={() => setPrintModalData(null)}
        />
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
