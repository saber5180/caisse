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

  // SRF monnaie (somme coupures <= 5 TND)
  const srfCoinsOnly = items
    .filter((i) => !i.isBillet && i.valeur <= 5)
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

  return (
    <div className="mx-auto max-w-4xl pb-16 sm:pb-6">
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
                <span>SRF (Fonds Monnaie &le; 5T) :</span>
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
          subtitle="Dénombrement physique des pièces, billets, versements et rapprochement avec la recette"
          icon={<IconCoins className="h-5 w-5" />}
          accent="amber"
          actions={
            <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:w-auto">
              <Link
                href="/billetterie/historique"
                className="btn-ghost !py-2 text-xs sm:text-sm font-semibold justify-center"
                title="Consulter les bilans des jours passés"
              >
                <IconHistory className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Historique</span>
              </Link>
              <button
                onClick={handleReset}
                className="btn-ghost !py-2 text-xs sm:text-sm justify-center"
                title="Remettre à zéro"
              >
                <IconTrash className="h-4 w-4 text-slate-400 shrink-0" />
                <span>RàZ</span>
              </button>
              <button
                onClick={handlePrint}
                className="btn-ghost !py-2 text-xs sm:text-sm font-bold justify-center"
                title="Imprimer l'état haute définition"
              >
                <IconPrinter className="h-4 w-4 text-slate-700 shrink-0" />
                <span>Imprimer PV</span>
              </button>
              <button
                onClick={() => setShowConfirmModal(true)}
                className="btn-success col-span-2 sm:col-auto !py-2.5 text-xs sm:text-sm font-bold shadow-md justify-center"
                title="Enregistrer et clôturer définitivement cette journée de caisse"
              >
                <IconCheck className="h-4 w-4 shrink-0" />
                <span>Clôturer la Journée</span>
              </button>
            </div>
          }
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Colonne Synthèse Financière & Rapprochement (Order 1 on mobile, Order 2 on desktop) */}
          <div className="space-y-4 lg:col-span-1 lg:order-2">
            <div className="card-pro p-5 sm:p-6 shadow-pro border-amber-200/90 bg-amber-50/20">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-slate-800 border-b border-amber-200/60 pb-3">
                Rapprochement de Caisse
              </h3>

              <div className="mt-4 space-y-3.5">
                {/* Total Coupures Physiques */}
                <div className="flex items-center justify-between text-xs border-b border-slate-100 pb-2">
                  <span className="text-slate-600 font-medium">Sous-Total Billets & Pièces</span>
                  <span className="num font-bold text-slate-900 text-sm">
                    {formatMoney(totalCoupures)} TND
                  </span>
                </div>

                {/* SRF Pièces Calculé */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">SRF (Fonds Monnaie &le; 5T)</span>
                  <span className="num font-semibold text-slate-800">
                    {formatMoney(srfCoinsOnly)} TND
                  </span>
                </div>

                {/* SRF- Retenues */}
                <div>
                  <label className="label text-[11px]">SRF - (Retenues / Déductions)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={srfMoins === 0 ? '' : srfMoins}
                    onChange={(e) => setSrfMoins(parseFloat(e.target.value) || 0)}
                    placeholder="0.000"
                    className="input num !min-h-9 !py-1 text-sm font-semibold"
                  />
                </div>

                {/* VER Versements */}
                <div>
                  <label className="label text-[11px]">VER (Versements)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={ver === 0 ? '' : ver}
                    onChange={(e) => setVer(parseFloat(e.target.value) || 0)}
                    placeholder="0.000"
                    className="input num !min-h-9 !py-1 text-sm font-semibold text-emerald-700"
                  />
                </div>

                {/* TT Total Physique */}
                <div className="border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    TT (Total Physique)
                  </span>
                  <span className="num text-xl font-black text-slate-900">
                    {formatMoney(tt)} <span className="text-xs text-slate-400 font-normal">TND</span>
                  </span>
                </div>

                {/* RECETTE Théorique */}
                <div>
                  <label className="label text-[11px]">RECETTE (Ventes Théoriques)</label>
                  <input
                    type="number"
                    step="0.001"
                    value={recetteTheorique === 0 ? '' : recetteTheorique}
                    onChange={(e) => setRecetteTheorique(parseFloat(e.target.value) || 0)}
                    placeholder="0.000"
                    className="input num !min-h-10 !py-1 text-sm font-bold text-indigo-700"
                  />
                </div>

                {/* RESTE (Écart Physique vs Théorique) */}
                <div
                  className={`rounded-2xl p-4 border transition-all ${
                    reste >= 0
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      RESTE (Écart)
                    </span>
                    <span className="num text-xl sm:text-2xl font-black">
                      {reste > 0 ? '+' : ''}{formatMoney(reste)} TND
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] font-medium opacity-80">
                    {reste >= 0 ? '✓ Excédent en caisse physique' : '⚠️ Déficit en caisse physique'}
                  </p>
                </div>

                {/* Quick Save Closing Button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="btn-success w-full !py-3 text-sm font-black shadow-lg"
                  >
                    <IconCheck className="h-4 w-4" />
                    Enregistrer la Clôture du Jour
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Colonnes: Tableau des Coupures (Feuil3) */}
          <div className="card-pro overflow-hidden lg:col-span-2 lg:order-1">
            <div className="card-header bg-slate-50/80">
              <div>
                <h2 className="card-title text-sm">Détail des Coupures</h2>
                <p className="text-[11px] text-slate-400">Pièces & Billets en caisse</p>
              </div>
              <span className="badge-slate font-mono text-[11px]">11 dénominations</span>
            </div>

            {/* Mobile Denomination Cards View (sm:hidden) */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {items.map((item, idx) => {
                const montantLigne = item.nombre * item.valeur;

                return (
                  <div key={idx} className="p-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`h-2.5 w-2.5 rounded-full ${
                            item.isBillet ? 'bg-indigo-500' : 'bg-amber-500'
                          }`}
                        />
                        <span className="font-bold text-slate-900 text-xs">
                          {item.label}
                        </span>
                      </div>
                      <span className="num font-bold text-slate-900 text-xs">
                        {formatMoney(montantLigne)} TND
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setBilletterieCount(idx, Math.max(0, item.nombre - 1))}
                        className="h-10 w-10 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 shadow-sm active:bg-slate-100 text-base"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={item.nombre === 0 ? '' : item.nombre}
                        onChange={(e) =>
                          setBilletterieCount(idx, parseFloat(e.target.value) || 0)
                        }
                        placeholder="0"
                        className="input num flex-1 !h-10 !text-center text-sm font-bold text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setBilletterieCount(idx, item.nombre + 1)}
                        className="h-10 w-10 rounded-xl border border-slate-200 bg-white font-bold text-slate-700 shadow-sm active:bg-slate-100 text-base"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (hidden sm:block) */}
            <div className="table-wrap hidden sm:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Coupure / Type</th>
                    <th className="!text-center">Nombre</th>
                    <th className="!text-right">Montant (TND)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const montantLigne = item.nombre * item.valeur;

                    return (
                      <tr key={idx}>
                        <td>
                          <div className="flex items-center gap-2">
                            <span
                              className={`h-2 w-2 rounded-full ${
                                item.isBillet ? 'bg-indigo-500' : 'bg-amber-500'
                              }`}
                            />
                            <span className="font-semibold text-slate-900 text-xs sm:text-sm">
                              {item.label}
                            </span>
                          </div>
                        </td>
                        <td className="text-center">
                          <input
                            type="number"
                            step="0.1"
                            min={0}
                            value={item.nombre === 0 ? '' : item.nombre}
                            onChange={(e) =>
                              setBilletterieCount(idx, parseFloat(e.target.value) || 0)
                            }
                            placeholder="0"
                            className="input num !w-28 !min-h-9 !py-1 !text-center text-sm font-bold text-slate-900"
                          />
                        </td>
                        <td className="text-right">
                          <span className="num font-bold text-slate-900">
                            {formatMoney(montantLigne)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Confirmation Modal for Clôture de Journée */}
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowConfirmModal(false)}
            />
            <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl z-10">
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
