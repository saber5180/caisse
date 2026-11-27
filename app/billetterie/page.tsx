'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCaisseStore } from '@/lib/store';
import { formatMoney } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import {
  IconCheck,
  IconCoins,
  IconHistory,
  IconPrinter,
  IconTrash,
} from '@/components/Icons';

export default function BilletteriePage() {
  const currentUser = useCaisseStore((state) => state.currentUser);
  const items = useCaisseStore((state) => state.billetterieItems);
  const srfMoins = useCaisseStore((state) => state.srfMoins);
  const ver = useCaisseStore((state) => state.ver);
  const recetteTheorique = useCaisseStore((state) => state.recettePhysiqueTheorique);

  const setBilletterieCount = useCaisseStore((state) => state.setBilletterieCount);
  const setSrfMoins = useCaisseStore((state) => state.setSrfMoins);
  const setVer = useCaisseStore((state) => state.setVer);
  const setRecetteTheorique = useCaisseStore((state) => state.setRecettePhysiqueTheorique);
  const cloturerJournee = useCaisseStore((state) => state.cloturerJournee);

  const [savingCloture, setSavingCloture] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [clotureNotes, setClotureNotes] = useState('');

  // Totaux
  const totalCoupures = items.reduce((sum, item) => sum + item.nombre * item.valeur, 0);

  // SRF monnaie : pièces strictement en dessous de 5 TND (la pièce de 5 TND n'entre pas)
  const srfCoinsOnly = items
    .filter((i) => !i.isBillet && i.valeur < 5)
    .reduce((sum, item) => sum + item.nombre * item.valeur, 0);

  const tt = totalCoupures + srfMoins + ver;
  const reste = tt - recetteTheorique;

  const handlePrint = () => {
    window.print();
  };

  const handleReset = () => {
    if (confirm('Réinitialiser toutes les quantités de billets et pièces à 0 ?')) {
      items.forEach((_, idx) => setBilletterieCount(idx, 0));
      setSrfMoins(0);
      setVer(0);
    }
  };

  const handleSaveCloture = async () => {
    setSavingCloture(true);
    try {
      const res = await fetch('/api/caisse/billetterie/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          totalCoupures,
          srfPieces: srfCoinsOnly,
          srfMoins,
          ver,
          ttPhysique: tt,
          recetteTheorique,
          ecartReste: reste,
          items,
          notes: clotureNotes.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        cloturerJournee();
        setSaveSuccessMsg('Clôture journalière validée avec succès ! Les transactions du journal ont été archivées et la caisse active est réinitialisée.');
        setShowConfirmModal(false);
        setClotureNotes('');
        setTimeout(() => setSaveSuccessMsg(null), 8000);
      } else {
        alert(json.error || 'Erreur lors de la sauvegarde');
      }
    } catch (err: any) {
      alert(err?.message || 'Erreur de connexion');
    } finally {
      setSavingCloture(false);
    }
  };

  const currentDateStr = new Date().toLocaleString('fr-FR');

  const handleNavKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentId: string) => {
    // Navigation avec Tab ou Entrée
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const isShift = e.shiftKey;
      const isMobile = currentId.startsWith('mobile-');
      const prefix = isMobile ? 'mobile-billetterie-nombre-' : 'billetterie-nombre-';

      const navSequence = [
        ...items.map((_, i) => `${prefix}${i}`),
        'billetterie-srf-moins',
        'billetterie-ver',
        'billetterie-recette',
      ];

      const curIdx = navSequence.indexOf(currentId);
      if (curIdx !== -1) {
        const nextIdx = isShift
          ? (curIdx - 1 + navSequence.length) % navSequence.length
          : (curIdx + 1) % navSequence.length;
        const targetId = navSequence[nextIdx];
        const nextEl = document.getElementById(targetId) as HTMLInputElement | null;
        if (nextEl) {
          nextEl.focus();
          nextEl.select();
        }
      }
      return;
    }

    // Flèches haut / bas pour naviguer verticalement entre les lignes sans altérer la valeur numérique
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const isMobile = currentId.startsWith('mobile-');
      const prefix = isMobile ? 'mobile-billetterie-nombre-' : 'billetterie-nombre-';

      if (currentId.startsWith(prefix)) {
        const rowIdx = parseInt(currentId.replace(prefix, ''), 10);
        if (!isNaN(rowIdx)) {
          const targetIdx = e.key === 'ArrowDown' ? rowIdx + 1 : rowIdx - 1;
          if (targetIdx >= 0 && targetIdx < items.length) {
            const nextEl = document.getElementById(`${prefix}${targetIdx}`) as HTMLInputElement | null;
            if (nextEl) {
              nextEl.focus();
              nextEl.select();
            }
          } else if (e.key === 'ArrowDown' && targetIdx >= items.length) {
            const nextEl = document.getElementById('billetterie-srf-moins') as HTMLInputElement | null;
            if (nextEl) {
              nextEl.focus();
              nextEl.select();
            }
          }
        }
      } else if (currentId === 'billetterie-srf-moins') {
        const targetId = e.key === 'ArrowDown' ? 'billetterie-ver' : `${prefix}${items.length - 1}`;
        const el = document.getElementById(targetId) as HTMLInputElement | null;
        if (el) { el.focus(); el.select(); }
      } else if (currentId === 'billetterie-ver') {
        const targetId = e.key === 'ArrowDown' ? 'billetterie-recette' : 'billetterie-srf-moins';
        const el = document.getElementById(targetId) as HTMLInputElement | null;
        if (el) { el.focus(); el.select(); }
      } else if (currentId === 'billetterie-recette') {
        if (e.key === 'ArrowUp') {
          const el = document.getElementById('billetterie-ver') as HTMLInputElement | null;
          if (el) { el.focus(); el.select(); }
        }
      }
    }
  };

  return (
    <div className="w-full pb-16 sm:pb-8">
      {/* ===================== PRINTABLE A4 OFFICIAL DOCUMENT ===================== */}
      <div className="printable-document hidden print:block text-slate-900 bg-white">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm">
                CC
              </span>
              <span className="text-lg font-black tracking-tight uppercase">
                Caisse Chauffeurs
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 font-medium">
              Procès-Verbal de Comptage Physique de Caisse & Coffre
            </p>
            <p className="text-[11px] text-slate-400">
              Caisse : <strong>{currentUser?.displayName || 'Caisse Centrale'}</strong> · Caissier : {currentUser?.username || 'Opérateur'}
            </p>
          </div>

          <div className="text-right">
            <span className="inline-block rounded-md bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
              Feuille de Caisse Feuil3
            </span>
            <p className="mt-2 text-xs font-mono font-bold">
              DATE : {currentDateStr}
            </p>
          </div>
        </div>

        {/* Tableau Récapitulatif des 11 Dénominations */}
        <div className="mt-6">
          <table className="w-full text-left text-xs border border-slate-200">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300">
                <th className="py-2 px-3 font-bold uppercase">Coupure / Type</th>
                <th className="py-2 px-3 font-bold uppercase text-center">Quantité Dénombrée</th>
                <th className="py-2 px-3 font-bold uppercase text-right">Sous-Total (TND)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 font-mono">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-1.5 px-3 font-sans font-medium text-slate-800">
                    {item.label}
                  </td>
                  <td className="py-1.5 px-3 text-center font-bold text-slate-900">
                    {item.nombre}
                  </td>
                  <td className="py-1.5 px-3 text-right font-bold text-slate-900">
                    {formatMoney(item.nombre * item.valeur)} TND
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-100 font-bold border-t-2 border-slate-900 font-sans">
                <td colSpan={2} className="py-2 px-3 uppercase text-slate-800">
                  Total des Coupures Physiques en Caisse :
                </td>
                <td className="py-2 px-3 text-right font-mono text-sm text-slate-900">
                  {formatMoney(totalCoupures)} TND
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Synthèse Rapprochement Box */}
        <div className="mt-6 rounded-2xl border-2 border-slate-900 bg-slate-50 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2 mb-3">
            Rapprochement Financier
          </h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span>Total Coupures :</span>
                <span className="font-mono font-bold">{formatMoney(totalCoupures)} TND</span>
              </div>
              <div className="flex justify-between">
                <span>SRF (Fonds Monnaie &lt; 5T) :</span>
                <span className="font-mono">{formatMoney(srfCoinsOnly)} TND</span>
              </div>
              {srfMoins > 0 && (
                <div className="flex justify-between text-rose-700">
                  <span>SRF - (Retenues / Déductions) :</span>
                  <span className="font-mono">-{formatMoney(srfMoins)} TND</span>
                </div>
              )}
              {ver > 0 && (
                <div className="flex justify-between text-indigo-700">
                  <span>Versements en Coffre / Banque :</span>
                  <span className="font-mono font-bold">+{formatMoney(ver)} TND</span>
                </div>
              )}
            </div>

            <div className="space-y-1 border-l border-slate-300 pl-4">
              <div className="flex justify-between text-slate-900 font-bold">
                <span>Total Physique (TT) :</span>
                <span className="font-mono text-sm">{formatMoney(tt)} TND</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Recette Théorique Attendue :</span>
                <span className="font-mono">{formatMoney(recetteTheorique)} TND</span>
              </div>
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-300">
                <span>Écart / Reste :</span>
                <span className={`font-mono ${reste >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {reste > 0 ? '+' : ''}{formatMoney(reste)} TND
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Double Signature Zone */}
        <div className="mt-10 grid grid-cols-2 gap-8 pt-4">
          <div className="border-t border-slate-400 pt-3 text-center">
            <p className="text-xs font-bold text-slate-900">Signature du Caissier Dépositaire</p>
            <div className="h-16" />
          </div>
          <div className="border-t border-slate-400 pt-3 text-center">
            <p className="text-xs font-bold text-slate-900">Visa du Responsable Financier</p>
            <div className="h-16" />
          </div>
        </div>
      </div>

      {/* ===================== INTERACTIVE SCREEN UI ===================== */}
      <div className="print:hidden">
        {saveSuccessMsg && (
          <div className="mb-4 flex items-center justify-between rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-emerald-900 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500 text-white font-bold">
                ✓
              </span>
              <div>
                <p className="text-sm font-bold">{saveSuccessMsg}</p>
                <p className="text-xs text-emerald-700">Vous pouvez consulter, imprimer ou exporter ce bilan à tout moment.</p>
              </div>
            </div>
            <Link
              href="/billetterie/historique"
              className="btn bg-emerald-600 hover:bg-emerald-700 text-white !py-1.5 !px-3 text-xs font-bold"
            >
              Voir l&apos;Historique →
            </Link>
          </div>
        )}

        <PageHeader
          title="Comptage Billetterie"
          subtitle="Saisie des billets et pièces en caisse, versements et clôture de journée"
          icon={<IconCoins className="h-5 w-5" />}
          accent="indigo"
          actions={
            <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto sm:flex-wrap">
              <Link
                href="/billetterie/historique"
                className="btn-ghost !py-2 text-xs font-semibold justify-center"
                title="Consulter les bilans des jours passés"
              >
                <IconHistory className="h-4 w-4 text-slate-500 shrink-0" />
                <span>Historique</span>
              </Link>
              <button
                onClick={handleReset}
                className="btn-ghost !py-2 text-xs font-semibold justify-center"
                title="Remettre à zéro"
              >
                <IconTrash className="h-4 w-4 text-slate-500 shrink-0" />
                <span>Vider</span>
              </button>
              <button
                onClick={handlePrint}
                className="btn-ghost !py-2 text-xs font-semibold justify-center"
                title="Imprimer le procès-verbal A4"
              >
                <IconPrinter className="h-4 w-4 text-sky-600 shrink-0" />
                <span>Imprimer PV</span>
              </button>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="btn-success col-span-2 sm:col-auto !py-2 text-xs font-bold justify-center"
                title="Enregistrer et clôturer définitivement cette journée de caisse"
              >
                <IconCheck className="h-4 w-4 shrink-0" />
                <span>Clôturer la journée</span>
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 items-start">
          {/* Colonne Rapprochement & Clôture */}
          <div className="xl:col-span-4 xl:order-2 xl:sticky xl:top-20">
            <div className="card p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Rapprochement journalier
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Calcul automatique des espèces et écarts
                  </p>
                </div>
                <span className="badge-indigo font-mono text-[10px]">CAISSE</span>
              </div>

              {/* Résumé rapide Espèces + Monnaie SRF */}
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Total coupures
                  </span>
                  <span className="mt-1 block num text-sm sm:text-base font-bold text-slate-900">
                    {formatMoney(totalCoupures)} <span className="text-[10px] font-normal text-slate-500">TND</span>
                  </span>
                </div>
                <div className="rounded-xl border border-sky-200/80 bg-sky-50/60 p-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                    Monnaie SRF (&lt; 5T)
                  </span>
                  <span className="mt-1 block num text-sm sm:text-base font-bold text-sky-900">
                    {formatMoney(srfCoinsOnly)} <span className="text-[10px] font-normal text-sky-700">TND</span>
                  </span>
                </div>
              </div>

              {/* Champs de rapprochement : 3 colonnes sur tablette, 1 colonne sur mobile et grand écran */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <div>
                  <label htmlFor="billetterie-srf-moins" className="label">
                    SRF − (Retenues / Déductions)
                  </label>
                  <input
                    id="billetterie-srf-moins"
                    type="number"
                    step="0.001"
                    value={srfMoins === 0 ? '' : srfMoins}
                    onChange={(e) => setSrfMoins(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) => handleNavKeyDown(e, 'billetterie-srf-moins')}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.000"
                    className="input num font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label htmlFor="billetterie-ver" className="label !text-sky-700">
                    VER (Versements Banque / Coffre)
                  </label>
                  <input
                    id="billetterie-ver"
                    type="number"
                    step="0.001"
                    value={ver === 0 ? '' : ver}
                    onChange={(e) => setVer(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) => handleNavKeyDown(e, 'billetterie-ver')}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.000"
                    className="input num font-bold text-sky-800 border-sky-200 bg-sky-50/30"
                  />
                </div>

                <div>
                  <label htmlFor="billetterie-recette" className="label">
                    Recette attendue (Théorique)
                  </label>
                  <input
                    id="billetterie-recette"
                    type="number"
                    step="0.001"
                    value={recetteTheorique === 0 ? '' : recetteTheorique}
                    onChange={(e) => setRecetteTheorique(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) => handleNavKeyDown(e, 'billetterie-recette')}
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    placeholder="0.000"
                    className="input num font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Total Physique + Solde / Écart */}
              <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-white">
                  <span className="text-xs font-semibold text-slate-300">
                    Total physique (TT)
                  </span>
                  <span className="num text-lg font-extrabold text-white">
                    {formatMoney(tt)} <span className="text-[11px] font-normal text-slate-400">TND</span>
                  </span>
                </div>

                <div
                  className={`rounded-xl border px-4 py-3 transition-colors ${
                    reste >= 0
                      ? 'border-emerald-200 bg-emerald-50/80 text-emerald-900'
                      : 'border-rose-200 bg-rose-50/80 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide">
                      Écart / Reste
                    </span>
                    <span className="num text-lg font-extrabold">
                      {reste > 0 ? '+' : ''}{formatMoney(reste)} TND
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium opacity-80">
                    {reste >= 0 ? 'Caisse équilibrée ou excédentaire' : 'Manquant constaté par rapport à la recette'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="btn-success w-full !py-3 text-sm font-bold"
                >
                  <IconCheck className="h-4 w-4" />
                  Valider la clôture du jour
                </button>
              </div>
            </div>
          </div>

          {/* Colonne Coupures & Monnaie */}
          <div className="card overflow-hidden xl:col-span-8 xl:order-1">
            <div className="card-header">
              <div>
                <h2 className="card-title">Détail des billets et pièces</h2>
                <p className="text-[11px] text-slate-500">
                  Navigation rapide avec Tab, Entrée ou les flèches Haut / Bas
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 font-mono text-xs font-bold text-sky-800">
                  {formatMoney(totalCoupures)} TND
                </span>
                <span className="badge-slate font-mono text-[10.5px]">11 COUPURES</span>
              </div>
            </div>

            {/* Vue Mobile Compacte (sm:hidden) */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {items.map((item, idx) => {
                const montantLigne = item.nombre * item.valeur;

                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2.5 px-3.5 py-2.5 hover:bg-slate-50/70"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold ${
                            item.isBillet
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {item.isBillet ? 'B' : 'P'}
                        </span>
                        <span className="truncate text-xs font-bold text-slate-900">
                          {item.label}
                        </span>
                      </div>
                      <p className="mt-0.5 pl-7 num text-[11px] font-semibold text-slate-500">
                        Sous-total : <strong className="text-slate-800">{formatMoney(montantLigne)} TND</strong>
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBilletterieCount(idx, Math.max(0, item.nombre - 1))}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 active:bg-slate-100"
                      >
                        −
                      </button>
                      <input
                        id={`mobile-billetterie-nombre-${idx}`}
                        type="number"
                        step="0.1"
                        min={0}
                        value={item.nombre === 0 ? '' : item.nombre}
                        onChange={(e) =>
                          setBilletterieCount(idx, parseFloat(e.target.value) || 0)
                        }
                        onKeyDown={(e) => handleNavKeyDown(e, `mobile-billetterie-nombre-${idx}`)}
                        onFocus={(e) => e.target.select()}
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                        placeholder="0"
                        className="input num !h-9 !min-h-9 !w-20 !px-2 !py-1 !text-center text-sm font-bold text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setBilletterieCount(idx, item.nombre + 1)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-bold text-slate-700 active:bg-slate-100"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vue Tablette & Bureau (hidden sm:block) */}
            <div className="table-wrap hidden sm:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Coupure</th>
                    <th className="!text-center">Quantité</th>
                    <th className="!text-right">Sous-total (TND)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const montantLigne = item.nombre * item.valeur;

                    return (
                      <tr key={idx} className={montantLigne > 0 ? 'bg-sky-50/25' : ''}>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                                item.isBillet
                                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {item.isBillet ? 'Billet' : 'Pièce'}
                            </span>
                            <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                              {item.label}
                            </span>
                          </div>
                        </td>
                        <td className="text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setBilletterieCount(idx, Math.max(0, item.nombre - 1))}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
                            >
                              −
                            </button>
                            <input
                              id={`billetterie-nombre-${idx}`}
                              type="number"
                              step="0.1"
                              min={0}
                              value={item.nombre === 0 ? '' : item.nombre}
                              onChange={(e) =>
                                setBilletterieCount(idx, parseFloat(e.target.value) || 0)
                              }
                              onKeyDown={(e) => handleNavKeyDown(e, `billetterie-nombre-${idx}`)}
                              onFocus={(e) => e.target.select()}
                              onClick={(e) => (e.target as HTMLInputElement).select()}
                              placeholder="0"
                              className="input num !w-24 !h-8 !min-h-8 !py-1 !text-center text-sm font-bold text-slate-900"
                            />
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => setBilletterieCount(idx, item.nombre + 1)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="text-right">
                          <span className={`num font-bold ${montantLigne > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                            {formatMoney(montantLigne)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50/90">
                    <td colSpan={2} className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-700">
                      Sous-total billets &amp; pièces comptés
                    </td>
                    <td className="px-4 py-3 text-right num text-sm font-extrabold text-slate-900">
                      {formatMoney(totalCoupures)} TND
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Confirmation Modal for Clôture de Journée */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowConfirmModal(false)}
            />
            <div className="relative z-10 max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6">
              <h3 className="text-base font-bold text-slate-900 mb-2">
                Confirmer la Clôture de Journée
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Cette action va enregistrer l&apos;état exact du comptage physique et du rapprochement dans l&apos;historique journalier.
              </p>

              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 mb-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Coupures :</span>
                  <strong className="num text-slate-900">{formatMoney(totalCoupures)} TND</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Versements (VER) :</span>
                  <strong className="num text-indigo-700">{formatMoney(ver)} TND</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Physique (TT) :</span>
                  <strong className="num text-slate-900">{formatMoney(tt)} TND</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Recette Attendue :</span>
                  <strong className="num text-slate-900">{formatMoney(recetteTheorique)} TND</strong>
                </div>
                <div className="flex justify-between pt-1 border-t border-slate-200 font-bold">
                  <span>Écart / Reste :</span>
                  <span className={`num ${reste >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {reste > 0 ? '+' : ''}{formatMoney(reste)} TND
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="label text-xs">Note ou observation (facultatif)</label>
                <textarea
                  rows={2}
                  value={clotureNotes}
                  onChange={(e) => setClotureNotes(e.target.value)}
                  placeholder="Ex: Écart de 0.200 TND justifié par arrondi monnaie..."
                  className="input !h-auto py-2 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  className="btn-ghost !py-2 text-xs"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={savingCloture}
                  onClick={handleSaveCloture}
                  className="btn-success !py-2 text-xs font-bold"
                >
                  {savingCloture ? 'Enregistrement...' : 'Confirmer & Enregistrer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
