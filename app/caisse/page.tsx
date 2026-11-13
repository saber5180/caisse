'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCaisseStore, computeDeskTotals } from '@/lib/store';
import { formatMoney, generateId, cleanScannerTr, getUnpaidCaisses, formatDate } from '@/lib/utils';
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
  const selectDriverById = useCaisseStore((state) => state.selectDriverById);
  const updateDriverStatus = useCaisseStore((state) => state.updateDriverStatus);
  const markProgramEntryPaid = useCaisseStore((state) => state.markProgramEntryPaid);
  const validateCurrentSale = useCaisseStore((state) => state.validateCurrentSale);
  const resetDesk = useCaisseStore((state) => state.resetDesk);

  const scannerInputRef = useRef<HTMLInputElement>(null);
  const hasAppliedInitialTr = useRef(false);
  const [printModalData, setPrintModalData] = useState<ReceiptData | null>(null);
  const [showDriverDropdown, setShowDriverDropdown] = useState(false);
  const [activeUnpaidEntryId, setActiveUnpaidEntryId] = useState<string>('CURRENT');

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  // Filtrer les chauffeurs valides (sans chauffeur global "0")
  const validDrivers = drivers.filter((d) => d.tr !== '0' && d.id !== 'DRV-GLOBAL-0');

  // Recherche en direct UNIQUEMENT parmi les chauffeurs ayant au moins une caisse NON PAYÉE (ne jamais afficher les caisses PAYE)
  const searchTerm = deskTrInput.trim().replace(/^tr\s*/i, '').toUpperCase();
  const normalizedSearchTr = cleanScannerTr(searchTerm).toUpperCase();

  const matchingDrivers = searchTerm
    ? validDrivers
        .filter((d) => {
          // Ne jamais afficher au guichet un chauffeur dont toutes les caisses sont déjà payées
          const hasUnpaid =
            d.statut === 'NON PAYE' || getUnpaidCaisses(d, validDrivers).length > 0;
          if (!hasUnpaid) return false;

          const dTrClean = cleanScannerTr(d.tr).toUpperCase();
          const dTrRaw = d.tr.toUpperCase();
          const dNom = d.nom.toUpperCase();
          return (
            dTrClean.includes(normalizedSearchTr) ||
            dTrRaw.includes(searchTerm) ||
            dNom.includes(searchTerm)
          );
        })
        .sort((a, b) => {
          const aExact = cleanScannerTr(a.tr).toUpperCase() === normalizedSearchTr ? 0 : 1;
          const bExact = cleanScannerTr(b.tr).toUpperCase() === normalizedSearchTr ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;
          return 0;
        })
    : [];

  // Liste strictement limitée aux caisses NON PAYÉES du Code TR sélectionné (aucune caisse PAYE affichée)
  const selectedTrUnpaidCaisses = selectedDriver
    ? getUnpaidCaisses(selectedDriver, validDrivers)
    : [];

  // Nettoyer tout ancien chauffeur par défaut ("0") au montage, ou appliquer uniquement ?tr=... s'il est dans l'URL
  useEffect(() => {
    if (initialTr && initialTr !== '0') {
      if (!hasAppliedInitialTr.current && validDrivers.length > 0) {
        hasAppliedInitialTr.current = true;
        setDeskTrInput(initialTr);
        selectDriverByTr(initialTr);
      }
    } else if (!initialTr && (deskTrInput === '0' || selectedDriverId === 'DRV-GLOBAL-0')) {
      selectDriverById(null);
    }
  }, [initialTr, validDrivers.length, deskTrInput, selectedDriverId, setDeskTrInput, selectDriverByTr, selectDriverById]);

  const handlePickDriver = (driverId: string, forceNonPaye = false, entryId = 'CURRENT') => {
    if (forceNonPaye) {
      updateDriverStatus(driverId, 'NON PAYE');
    }
    setActiveUnpaidEntryId(entryId);
    selectDriverById(driverId);
    setShowDriverDropdown(false);
    setTimeout(() => {
      const recEl = document.getElementById('desk-recette') as HTMLInputElement | null;
      if (recEl) {
        recEl.focus();
        recEl.select();
      }
    }, 50);
  };

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

  const handleNavKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentId: string) => {
    // 1. Navigation avec Tabulation ou Entrée
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();

      if (currentId === 'scanner-tr') {
        const clean = cleanScannerTr(deskTrInput);
        if (clean) {
          selectDriverByTr(clean);
          setShowDriverDropdown(false);
        }
      }

      const navSequence = [
        'scanner-tr',
        'desk-recette',
        ...deskRows.flatMap((_, idx) => [`entree-${idx}`, `sortie-${idx}`]),
        'versement-banque',
        'versement-coffre',
        'btn-valider-vente',
      ];

      const curIdx = navSequence.indexOf(currentId);
      if (curIdx !== -1) {
        const nextIdx = e.shiftKey
          ? (curIdx - 1 + navSequence.length) % navSequence.length
          : (curIdx + 1) % navSequence.length;
        const targetId = navSequence[nextIdx];
        const nextEl = document.getElementById(targetId) as HTMLElement | null;
        if (nextEl) {
          nextEl.focus();
          if ('select' in nextEl && typeof (nextEl as any).select === 'function') {
            (nextEl as HTMLInputElement).select();
          }
        }
      }
      return;
    }

    // 2. Flèches de direction pour naviguer entre colonnes/lignes SANS changer la valeur numérique
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentId.startsWith('entree-')) {
        const idx = parseInt(currentId.replace('entree-', ''), 10);
        if (!isNaN(idx)) {
          const target = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
          if (target >= 0 && target < deskRows.length) {
            const el = document.getElementById(`entree-${target}`) as HTMLInputElement | null;
            if (el) { el.focus(); el.select(); }
          } else if (e.key === 'ArrowDown') {
            const el = document.getElementById('versement-banque') as HTMLInputElement | null;
            if (el) { el.focus(); el.select(); }
          } else if (e.key === 'ArrowUp') {
            const el = document.getElementById('desk-recette') as HTMLInputElement | null;
            if (el) { el.focus(); el.select(); }
          }
        }
      } else if (currentId.startsWith('sortie-')) {
        const idx = parseInt(currentId.replace('sortie-', ''), 10);
        if (!isNaN(idx)) {
          const target = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
          if (target >= 0 && target < deskRows.length) {
            const el = document.getElementById(`sortie-${target}`) as HTMLInputElement | null;
            if (el) { el.focus(); el.select(); }
          } else if (e.key === 'ArrowDown') {
            const el = document.getElementById('versement-coffre') as HTMLInputElement | null;
            if (el) { el.focus(); el.select(); }
          } else if (e.key === 'ArrowUp') {
            const el = document.getElementById('desk-recette') as HTMLInputElement | null;
            if (el) { el.focus(); el.select(); }
          }
        }
      } else if (currentId === 'desk-recette') {
        if (e.key === 'ArrowDown') {
          const el = document.getElementById('entree-0') as HTMLInputElement | null;
          if (el) { el.focus(); el.select(); }
        }
      } else if (currentId === 'versement-banque') {
        if (e.key === 'ArrowDown') {
          const el = document.getElementById('versement-coffre') as HTMLInputElement | null;
          if (el) { el.focus(); el.select(); }
        } else if (e.key === 'ArrowUp') {
          const el = document.getElementById(`entree-${deskRows.length - 1}`) as HTMLInputElement | null;
          if (el) { el.focus(); el.select(); }
        }
      } else if (currentId === 'versement-coffre') {
        if (e.key === 'ArrowUp') {
          const el = document.getElementById(`sortie-${deskRows.length - 1}`) as HTMLInputElement | null;
          if (el) { el.focus(); el.select(); }
        }
      }
      return;
    }

    if (e.key === 'ArrowRight') {
      if (currentId.startsWith('entree-')) {
        e.preventDefault();
        const idx = currentId.replace('entree-', '');
        const el = document.getElementById(`sortie-${idx}`) as HTMLInputElement | null;
        if (el) { el.focus(); el.select(); }
      }
      return;
    }

    if (e.key === 'ArrowLeft') {
      if (currentId.startsWith('sortie-')) {
        e.preventDefault();
        const idx = currentId.replace('sortie-', '');
        const el = document.getElementById(`entree-${idx}`) as HTMLInputElement | null;
        if (el) { el.focus(); el.select(); }
      }
      return;
    }
  };

  const handleScannerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = cleanScannerTr(deskTrInput);
    if (clean) {
      selectDriverByTr(clean);
      setShowDriverDropdown(false);
      const recEl = document.getElementById('desk-recette') as HTMLInputElement | null;
      if (recEl) {
        recEl.focus();
        recEl.select();
      }
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
    const entryToMark = activeUnpaidEntryId;
    const txn = validateCurrentSale(entryToMark);
    if (txn) {
      setActiveUnpaidEntryId('CURRENT');
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
        <div className="card-pro relative p-4 sm:p-5 md:col-span-1">
          <label className="label flex items-center justify-between">
            <span>Scanner / Chercher Chauffeur (TR ou Nom)</span>
            <span className="badge-slate font-mono text-[10px]">C1</span>
          </label>
          <form onSubmit={handleScannerSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="scanner-tr"
                ref={scannerInputRef}
                type="text"
                autoComplete="off"
                value={deskTrInput}
                onFocus={() => setShowDriverDropdown(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  // Supprime automatiquement les "0" en début de code numérique (ex: "037" -> "37")
                  const cleaned = val.replace(/^0+(?=\d)/, '');
                  setDeskTrInput(cleaned);
                  setShowDriverDropdown(true);
                  if (!cleaned.trim()) {
                    selectDriverById(null);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowDriverDropdown(false), 180);
                }}
                onKeyDown={(e) => handleNavKeyDown(e, 'scanner-tr')}
                placeholder="Tapez TR (ex: 37) ou nom..."
                className="input num !pl-9 !pr-8 uppercase font-bold"
              />
              {deskTrInput && (
                <button
                  type="button"
                  onClick={() => {
                    selectDriverById(null);
                    setShowDriverDropdown(true);
                    scannerInputRef.current?.focus();
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="Vider le champ"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              )}

              {/* Dropdown de suggestion uniquement pendant la saisie d'un code TR ou nom (uniquement caisses NON PAYÉES) */}
              {showDriverDropdown && searchTerm && matchingDrivers.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Caisses non payées trouvées ({matchingDrivers.length})</span>
                    <span>Cliquez pour choisir</span>
                  </div>
                  {matchingDrivers.slice(0, 12).map((d) => {
                    const unpaidCount = getUnpaidCaisses(d, validDrivers).length;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handlePickDriver(d.id);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition ${
                          selectedDriverId === d.id
                            ? 'bg-indigo-50 text-indigo-950 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="badge-indigo font-mono text-[11px] font-bold shrink-0">
                            TR {d.tr}
                          </span>
                          <span className="truncate font-semibold text-slate-900">{d.nom}</span>
                        </div>
                        <span className="ml-2 shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                          {unpaidCount > 1 ? `${unpaidCount} NON PAYÉES` : 'NON PAYÉ'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button type="submit" className="btn-primary !px-3 font-bold">
              OK
            </button>
          </form>
          <p className="mt-2 text-[11px] text-slate-400">
            Scannez au lecteur optique ou tapez le code TR / nom puis Entrée.
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
                  {selectedDriver.montantBordereau ? (
                    <>
                      {' '}· Bordereau :{' '}
                      <strong className="text-indigo-600 num">
                        {formatMoney(selectedDriver.montantBordereau)} TND
                      </strong>
                    </>
                  ) : null}
                </p>
                {selectedDriver.reclamation && (
                  <p className="mt-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 inline-block">
                    {selectedDriver.reclamation}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedDriver.statut !== 'NON PAYE' && (
                  <button
                    type="button"
                    onClick={() => handlePickDriver(selectedDriver.id, true)}
                    className="rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition"
                  >
                    Passer en NON PAYÉ & Travailler
                  </button>
                )}
                <span className="badge-solid-emerald px-3 py-1 text-xs font-bold shadow-sm">
                  Chauffeur Pointé
                </span>
                <button
                  type="button"
                  onClick={() => {
                    selectDriverById(null);
                    scannerInputRef.current?.focus();
                  }}
                  className="btn-ghost !px-2.5 !py-1.5 text-xs text-slate-500 hover:text-rose-600"
                  title="Désélectionner ce chauffeur"
                >
                  <IconClose className="h-3.5 w-3.5" />
                  <span>Changer</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-400 text-xs sm:text-sm py-4">
              Scannez ou tapez un code chauffeur (TR) pour afficher sa caisse et travailler dessus.
            </div>
          )}
        </div>
      </div>

      {/* Caisses NON PAYÉES UNIQUEMENT du Chauffeur Sélectionné (ne jamais afficher les caisses PAYÉES) */}
      {selectedDriver && (
        <div className="mt-4 card-pro p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse" />
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800">
                Caisses Non Payées du Code TR #{selectedDriver.tr} — {selectedDriver.nom} ({selectedTrUnpaidCaisses.length})
              </h3>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Seules les caisses <strong>NON PAYÉES</strong> sont affichées · Cliquez sur une caisse pour travailler dessus
            </span>
          </div>

          {selectedTrUnpaidCaisses.length === 0 ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
              <span>
                Aucune caisse non payée à afficher pour <strong>{selectedDriver.nom} (TR {selectedDriver.tr})</strong> (les caisses payées sont masquées).
              </span>
              <button
                type="button"
                onClick={() => handlePickDriver(selectedDriver.id, true, 'CURRENT')}
                className="rounded-xl bg-rose-600 hover:bg-rose-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition"
              >
                Ouvrir en NON PAYÉ pour travailler dessus
              </button>
            </div>
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {selectedTrUnpaidCaisses.map((u, idx) => {
                const isSelectedEntry =
                  selectedDriverId === u.driverId && activeUnpaidEntryId === u.id;
                return (
                  <div
                    key={`${u.driverId}-${u.id}-${idx}`}
                    onClick={() => handlePickDriver(u.driverId, true, u.id)}
                    className={`cursor-pointer rounded-2xl border p-3.5 transition-all ${
                      isSelectedEntry
                        ? 'border-indigo-600 bg-indigo-50/90 ring-2 ring-indigo-500/20 shadow-sm'
                        : 'border-rose-200 bg-rose-50/50 hover:border-rose-400 hover:bg-rose-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-mono text-xs font-black px-2 py-0.5 rounded-lg ${
                            isSelectedEntry
                              ? 'bg-indigo-600 text-white'
                              : 'bg-rose-600 text-white'
                          }`}
                        >
                          TR {u.tr}
                        </span>
                        <span className="text-xs font-extrabold text-slate-900 truncate">
                          {u.circuit}
                        </span>
                      </div>
                      <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                        NON PAYÉ
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-slate-600">
                      <span>
                        Date : <strong className="text-slate-900">{u.date ? formatDate(u.date) : 'Aujourd’hui'}</strong>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${
                          u.isOverdue
                            ? 'bg-rose-200/80 text-rose-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {u.retardText}
                      </span>
                    </div>

                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-200/70 pt-2">
                      <span className="text-[11px] font-semibold text-indigo-700">
                        {isSelectedEntry
                          ? '✓ Caisse sélectionnée pour encaissement'
                          : 'Cliquez pour régler cette caisse'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
                  id="desk-recette"
                  type="number"
                  step="0.001"
                  min={0}
                  value={deskRecette === 0 ? '' : deskRecette}
                  onChange={(e) => setDeskRecette(parseFloat(e.target.value) || 0)}
                  onKeyDown={(e) => handleNavKeyDown(e, 'desk-recette')}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
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
                id="btn-valider-vente"
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
              const isOneTnd = row.denomination === 1;
              const stepVal = isOneTnd ? '0.1' : '1';

              return (
                <div key={idx} className="p-3.5 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-900 border border-slate-200">
                      <span>{row.denomination} TND</span>
                      {row.denomination === 5 && idx === 3 && (
                        <span className="rounded-md bg-indigo-600 px-1.5 py-0.5 font-mono text-[10px] font-black text-white">
                          B · Billet
                        </span>
                      )}
                      {row.denomination === 5 && idx === 4 && (
                        <span className="rounded-md bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-black text-white">
                          P · Pièce
                        </span>
                      )}
                      {isOneTnd && <span className="text-[10px] text-indigo-600 font-normal ml-1">(pas 0.1)</span>}
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
                        step={stepVal}
                        min={0}
                        value={row.entree === 0 ? '' : row.entree}
                        onChange={(e) => {
                          const val = isOneTnd
                            ? (parseFloat(e.target.value) || 0)
                            : (parseInt(e.target.value, 10) || 0);
                          setDeskEntree(idx, val);
                        }}
                        onKeyDown={(e) => handleNavKeyDown(e, `entree-${idx}`)}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
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
                        step={stepVal}
                        min={0}
                        value={row.sortie === 0 ? '' : row.sortie}
                        onChange={(e) => {
                          const val = isOneTnd
                            ? (parseFloat(e.target.value) || 0)
                            : (parseInt(e.target.value, 10) || 0);
                          setDeskSortie(idx, val);
                        }}
                        onKeyDown={(e) => handleNavKeyDown(e, `sortie-${idx}`)}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
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
                  const isOneTnd = row.denomination === 1;
                  const stepVal = isOneTnd ? '0.1' : '1';

                  return (
                    <tr key={idx}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <span className="num font-bold text-slate-900 text-sm">
                            {row.denomination} TND
                          </span>
                          {row.denomination === 5 && idx === 3 && (
                            <span
                              className="inline-flex items-center rounded-md bg-indigo-600 px-1.5 py-0.5 font-mono text-[10px] font-black text-white shadow-sm"
                              title="5 TND Billet (versé automatiquement en Billetterie)"
                            >
                              B · Billet
                            </span>
                          )}
                          {row.denomination === 5 && idx === 4 && (
                            <span
                              className="inline-flex items-center rounded-md bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-black text-white shadow-sm"
                              title="5 TND Pièce (comptage manuel en Billetterie)"
                            >
                              P · Pièce
                            </span>
                          )}
                          {isOneTnd && (
                            <span className="badge-slate font-mono text-[10px] text-indigo-600 bg-indigo-50 border-indigo-200">
                              pas 0.1
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <input
                          id={`entree-${idx}`}
                          type="number"
                          step={stepVal}
                          min={0}
                          value={row.entree === 0 ? '' : row.entree}
                          onChange={(e) => {
                            const val = isOneTnd
                              ? (parseFloat(e.target.value) || 0)
                              : (parseInt(e.target.value, 10) || 0);
                            setDeskEntree(idx, val);
                          }}
                          onKeyDown={(e) => handleNavKeyDown(e, `entree-${idx}`)}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          placeholder="0"
                          className="input num !w-24 !min-h-9 !py-1 !text-center text-sm font-bold text-emerald-800 bg-emerald-50/40 border-emerald-200"
                        />
                      </td>
                      <td className="text-center">
                        <input
                          id={`sortie-${idx}`}
                          type="number"
                          step={stepVal}
                          min={0}
                          value={row.sortie === 0 ? '' : row.sortie}
                          onChange={(e) => {
                            const val = isOneTnd
                              ? (parseFloat(e.target.value) || 0)
                              : (parseInt(e.target.value, 10) || 0);
                            setDeskSortie(idx, val);
                          }}
                          onKeyDown={(e) => handleNavKeyDown(e, `sortie-${idx}`)}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
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
                      id="versement-banque"
                      type="number"
                      step="0.001"
                      min={0}
                      value={deskVersementBanque === 0 ? '' : deskVersementBanque}
                      onChange={(e) => setDeskVersementBanque(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => handleNavKeyDown(e, 'versement-banque')}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
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
                      id="versement-coffre"
                      type="number"
                      step="0.001"
                      min={0}
                      value={deskVersementCoffre === 0 ? '' : deskVersementCoffre}
                      onChange={(e) => setDeskVersementCoffre(parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => handleNavKeyDown(e, 'versement-coffre')}
                      onFocus={(e) => e.target.select()}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
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
