'use client';

import { useState } from 'react';
import { formatMoney } from '@/lib/utils';
import { IconCheck, IconClose, IconPrinter } from './Icons';
import { CashDeskRow } from '@/types/caisse';

export interface ReceiptData {
  receiptNo: string;
  nom: string;
  tr: string;
  circuit?: string;
  recette: number;
  tPayer: number;
  resAPayer: number;
  versement: number;
  rows?: CashDeskRow[];
  date: string;
  caisseName?: string;
  cashierName?: string;
}

export default function PrintReceiptModal({
  data,
  onClose,
}: {
  data: ReceiptData;
  onClose: () => void;
}) {
  const [printFormat, setPrintFormat] = useState<'A4' | 'TICKET'>('A4');

  const handleDirectPrint = () => {
    window.print();
  };

  const activeRows = (data.rows || []).filter((r) => r.entree > 0 || r.sortie > 0);

  return (
    <div className="printable-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/70 backdrop-blur-md transition-opacity no-print"
        onClick={onClose}
      />

      {/* Main Modal Dialog */}
      <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 z-10 my-auto overflow-hidden print:shadow-none print:ring-0 print:rounded-none print:max-w-none print:my-0 print:overflow-visible">
        {/* Modal Top Control Bar (Hidden during print) */}
        <div className="no-print flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <IconPrinter className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Aperçu Avant Impression</h3>
              <p className="text-[11px] text-slate-400">Qualité Haute Définition · Décharge Officielle</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Format toggle */}
            <div className="flex rounded-xl bg-slate-200/70 p-1 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPrintFormat('A4')}
                className={`rounded-lg px-3 py-1 transition-all ${
                  printFormat === 'A4'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Format A4 / Facture
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('TICKET')}
                className={`rounded-lg px-3 py-1 transition-all ${
                  printFormat === 'TICKET'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ticket 80mm
              </button>
            </div>

            <button onClick={onClose} className="btn-icon !h-8 !w-8">
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="p-6 sm:p-10 max-h-[75vh] overflow-y-auto print:max-h-none print:overflow-visible print:p-0">
          {printFormat === 'A4' ? (
            /* =================== FORMAT FACTURE / DÉCHARGE A4 =================== */
            <div className="printable-document border border-slate-200 rounded-2xl p-8 bg-white text-slate-900">
              {/* Official Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm">
                      CC
                    </span>
                    <span className="text-lg font-black tracking-tight text-slate-900 uppercase">
                      Caisse Chauffeurs
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500 font-medium">
                    Département Logistique & Recouvrement
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Caisse : <strong className="text-slate-700">{data.caisseName || 'Caisse Centrale'}</strong>
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-block rounded-md bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    Reçu d&apos;Encaissement
                  </span>
                  <p className="mt-2 text-xs font-mono font-bold text-slate-800">
                    {data.receiptNo}
                  </p>
                  <p className="text-[11px] text-slate-500">Date : {data.date}</p>
                </div>
              </div>

              {/* Chauffeur & Mission Information */}
              <div className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Bénéficiaire / Chauffeur
                  </span>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">{data.nom}</p>
                  <p className="text-slate-600 font-mono mt-0.5">Code TR : <strong>{data.tr}</strong></p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Tournée / Circuit
                  </span>
                  <p className="mt-0.5 text-sm font-bold text-slate-900">
                    {data.circuit || 'STAND-BY'}
                  </p>
                  <p className="text-slate-500 text-[11px] mt-0.5">
                    Opérateur : {data.cashierName || 'Caissier'}
                  </p>
                </div>
              </div>

              {/* Financial Recap Table */}
              <div className="mt-6">
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider">Désignation</th>
                      <th className="py-2.5 px-3 font-bold uppercase tracking-wider text-right">Montant (TND)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2 px-3 text-slate-700 font-medium">
                        Recette Théorique Attendue (Bons de livraison)
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {formatMoney(data.recette)} TND
                      </td>
                    </tr>
                    {data.versement > 0 && (
                      <tr>
                        <td className="py-2 px-3 text-slate-700">Versement Direct (Coffre / Banque)</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-indigo-700">
                          {formatMoney(data.versement)} TND
                        </td>
                      </tr>
                    )}
                    <tr className="bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        Total Encaissé Réel en Espèces
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700 text-sm">
                        {formatMoney(data.tPayer)} TND
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Billetterie breakdown if rows present */}
              {activeRows.length > 0 && (
                <div className="mt-4 border border-slate-100 rounded-xl p-3 bg-slate-50/50 text-[11px]">
                  <p className="font-bold text-slate-700 mb-1.5 uppercase tracking-wider text-[10px]">
                    Dépouillement des Espèces Remises :
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 font-mono text-[11px]">
                    {activeRows.map((r, i) => (
                      <span key={i} className="text-slate-600 bg-white px-2 py-1 rounded border border-slate-200">
                        {r.denomination}T : <strong>+{r.entree}</strong> {r.sortie > 0 ? `(-${r.sortie})` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Result Balance Box */}
              <div className="mt-6 rounded-2xl border-2 border-slate-900 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Situation Financière de Clôture
                    </span>
                    <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      {data.resAPayer >= 0 ? '✓ ACQUITTÉ & EN RÈGLE' : '⚠️ SOLDE DÉBITEUR / EN SUSPENS'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Reste / Écart
                    </span>
                    <p className={`text-xl font-black font-mono ${data.resAPayer >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {data.resAPayer > 0 ? '+' : ''}{formatMoney(data.resAPayer)} TND
                    </p>
                  </div>
                </div>
              </div>

              {/* Signatures Block */}
              <div className="mt-10 grid grid-cols-2 gap-8 pt-4 print-avoid-break">
                <div className="border-t border-slate-400 pt-3 text-center">
                  <p className="text-xs font-bold text-slate-900">Visa & Cachet Caisse</p>
                  <p className="text-[10px] text-slate-400 mt-1">Signature du Caissier habilité</p>
                  <div className="h-16" />
                </div>
                <div className="border-t border-slate-400 pt-3 text-center">
                  <p className="text-xs font-bold text-slate-900">Émargement Chauffeur</p>
                  <p className="text-[10px] text-slate-400 mt-1">Bon pour décharge des fonds remis</p>
                  <div className="h-16" />
                </div>
              </div>

              {/* Footer legal */}
              <div className="mt-6 border-t border-slate-200 pt-3 text-center text-[10px] text-slate-400">
                Document généré électroniquement par le Système Caisse Chauffeurs · Réf: {data.receiptNo} · Fait foi de décharge.
              </div>
            </div>
          ) : (
            /* =================== FORMAT TICKET 80MM THERMAL =================== */
            <div className="printable-document mx-auto max-w-[320px] rounded-xl border border-dashed border-slate-300 p-5 bg-white font-mono text-xs text-slate-900">
              <div className="text-center pb-3 border-b border-dashed border-slate-400">
                <p className="font-bold text-sm tracking-tight">CAISSE CHAUFFEURS</p>
                <p className="text-[10px] text-slate-500">{data.caisseName || 'Agence Principale'}</p>
                <p className="text-[10px] text-slate-400 mt-1">{data.date}</p>
                <p className="text-[11px] font-bold mt-1">REÇU N° {data.receiptNo}</p>
              </div>

              <div className="py-3 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-500">Chauffeur:</span>
                  <span className="font-bold truncate max-w-[170px]">{data.nom}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Code TR:</span>
                  <span className="font-bold">{data.tr}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Circuit:</span>
                  <span>{data.circuit || 'STAND-BY'}</span>
                </div>
              </div>

              <div className="py-3 border-b border-dashed border-slate-300 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Recette Atten:</span>
                  <span>{formatMoney(data.recette)} TND</span>
                </div>
                {data.versement > 0 && (
                  <div className="flex justify-between text-indigo-700">
                    <span>Versement:</span>
                    <span>{formatMoney(data.versement)} TND</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 pt-1">
                  <span>TOTAL PAYÉ:</span>
                  <span>{formatMoney(data.tPayer)} TND</span>
                </div>
                <div className="flex justify-between font-bold text-xs pt-1">
                  <span>Reste / Écart:</span>
                  <span className={data.resAPayer >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {data.resAPayer > 0 ? '+' : ''}{formatMoney(data.resAPayer)} TND
                  </span>
                </div>
              </div>

              <div className="pt-6 pb-2 text-center text-[10px] text-slate-400">
                <p className="font-bold uppercase text-slate-600">
                  {data.resAPayer >= 0 ? '✓ DÉCHARGE VALIDÉE' : '⚠️ DETTE ENREGISTRÉE'}
                </p>
                <p className="mt-3">Signature Chauffeur :</p>
                <div className="h-12 border-b border-slate-300 mx-4" />
                <p className="mt-4 text-[9px]">Merci pour votre collaboration</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Footer (Hidden during print) */}
        <div className="no-print flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <p className="text-xs text-slate-500">
            Astuce : Utilisez le format <strong>A4</strong> pour les décharges officielles ou <strong>Ticket 80mm</strong> pour imprimante thermique.
          </p>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="btn-ghost flex-1 sm:flex-none !py-2 text-xs"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleDirectPrint}
              className="btn-primary flex-1 sm:flex-none !py-2.5 text-xs font-bold shadow-md"
            >
              <IconPrinter className="h-4 w-4" />
              Lancer l&apos;Impression Haute Qualité
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
