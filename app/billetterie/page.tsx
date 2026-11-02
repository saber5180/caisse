'use client';

import { useCaisseStore } from '@/lib/store';
import { formatMoney } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import {
  IconCoins,
  IconPrinter,
  IconTrash,
} from '@/components/Icons';

export default function BilletteriePage() {
  const items = useCaisseStore((state) => state.billetterieItems);
  const srfMoins = useCaisseStore((state) => state.srfMoins);
  const ver = useCaisseStore((state) => state.ver);
  const recetteTheorique = useCaisseStore((state) => state.recettePhysiqueTheorique);

  const setBilletterieCount = useCaisseStore((state) => state.setBilletterieCount);
  const setSrfMoins = useCaisseStore((state) => state.setSrfMoins);
  const setVer = useCaisseStore((state) => state.setVer);
  const setRecetteTheorique = useCaisseStore((state) => state.setRecettePhysiqueTheorique);

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

  return (
    <div className="mx-auto max-w-4xl pb-16 sm:pb-6">
      <PageHeader
        title="Comptage Billetterie"
        subtitle="Dénombrement physique des pièces, billets, versements et rapprochement avec la recette"
        icon={<IconCoins className="h-5 w-5" />}
        accent="amber"
        actions={
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button
              onClick={handleReset}
              className="btn-ghost flex-1 sm:flex-none !py-2 text-xs sm:text-sm"
              title="Remettre à zéro"
            >
              <IconTrash className="h-4 w-4" />
              Réinitialiser
            </button>
            <button
              onClick={handlePrint}
              className="btn-primary flex-1 sm:flex-none !py-2 text-xs sm:text-sm font-bold"
              title="Imprimer l'état"
            >
              <IconPrinter className="h-4 w-4" />
              Imprimer
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne Synthèse Financière & Rapprochement (Order 1 on mobile, Order 2 on desktop) */}
        <div className="space-y-4 lg:col-span-1 lg:order-2">
          <div className="card p-5 sm:p-6 shadow-sm border-amber-200 bg-amber-50/20">
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-800 border-b border-amber-100 pb-3">
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
            </div>
          </div>
        </div>

        {/* Colonnes: Tableau des Coupures (Feuil3) */}
        <div className="card overflow-hidden lg:col-span-2 lg:order-1">
          <div className="card-header bg-slate-50/70">
            <div>
              <h2 className="card-title text-sm">Détail des Coupures</h2>
              <p className="text-[11px] text-slate-400">Pièces & Billets en caisse</p>
            </div>
            <span className="badge-slate font-mono text-[11px]">12 dénominations</span>
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
                      className="h-9 w-9 rounded-lg border border-slate-200 bg-white font-bold text-slate-600 active:bg-slate-100"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={item.nombre === 0 ? '' : item.nombre}
                      onChange={(e) =>
                        setBilletterieCount(idx, parseInt(e.target.value, 10) || 0)
                      }
                      placeholder="0"
                      className="input num flex-1 !h-9 !text-center text-sm font-bold text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setBilletterieCount(idx, item.nombre + 1)}
                      className="h-9 w-9 rounded-lg border border-slate-200 bg-white font-bold text-slate-600 active:bg-slate-100"
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
                          min={0}
                          value={item.nombre === 0 ? '' : item.nombre}
                          onChange={(e) =>
                            setBilletterieCount(idx, parseInt(e.target.value, 10) || 0)
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
    </div>
  );
}
