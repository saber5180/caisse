'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { BilletterieHistoryEntry, CoinBreakdownItem } from '@/types/caisse';
import { useCaisseStore } from '@/lib/store';
import { formatMoney } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import {
  IconArrowLeft,
  IconBuilding,
  IconCalendar,
  IconClose,
  IconCoins,
  IconHistory,
  IconPrinter,
  IconSearch,
  IconTrash,
} from '@/components/Icons';

export default function BilletterieHistoriquePage() {
  const currentUser = useCaisseStore((state) => state.currentUser);
  const isSuperviseur = currentUser?.role === 'superviseur';
  const isSupervisorOrAdmin =
    currentUser?.role === 'superviseur' || currentUser?.role === 'admin';

  const [history, setHistory] = useState<BilletterieHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [caisseFilter, setCaisseFilter] = useState<'ALL' | 'CRNU' | 'CRSF' | 'CRTN'>('ALL');
  const [selectedEntry, setSelectedEntry] = useState<BilletterieHistoryEntry | null>(null);
  const [printEntry, setPrintEntry] = useState<BilletterieHistoryEntry | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const caisseParam = (params.get('caisse') || '').toUpperCase();
      if (caisseParam === 'CRNU' || caisseParam === 'CRSF' || caisseParam === 'CRTN') {
        setCaisseFilter(caisseParam);
      }
    }
    const handleAfterPrint = () => {
      setPrintEntry(null);
    };
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  const filterOutOldCoin = (items: CoinBreakdownItem[] = []) =>
    items.filter((item) => Math.abs(item.valeur - 0.02) > 0.001);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/caisse/billetterie/history', { cache: 'no-store' });
      const json = await res.json();
      if (res.ok && json.success) {
        setHistory(json.data || []);
      }
    } catch (e) {
      console.error('Fetch history error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleDelete = async (id: string) => {
    if (isSuperviseur) return;
    if (!confirm('Supprimer définitivement cet enregistrement de clôture ?')) return;
    try {
      const res = await fetch(`/api/caisse/billetterie/history?id=${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        if (selectedEntry?.id === id) setSelectedEntry(null);
        if (printEntry?.id === id) setPrintEntry(null);
      }
    } catch {
      alert('Erreur lors de la suppression');
    }
  };

  const handleTriggerPrint = (entry: BilletterieHistoryEntry) => {
    setSelectedEntry(null);
    setPrintEntry(entry);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Calcul des totaux de clôture individuels par caisse (CRNU, CRSF, CRTN) et du montant global (Spécification 5)
  const totalsByCaisse = useMemo(() => {
    const computeFor = (code: 'CRNU' | 'CRSF' | 'CRTN') => {
      const entries = history.filter(
        (h) => (h.caisseCode || h.caissierNom || '').toUpperCase() === code
      );
      return {
        code,
        count: entries.length,
        totalPhysique: entries.reduce((sum, h) => sum + h.ttPhysique, 0),
        totalCoupures: entries.reduce((sum, h) => sum + h.totalCoupures, 0),
        totalVer: entries.reduce((sum, h) => sum + h.ver, 0),
      };
    };
    return {
      CRNU: computeFor('CRNU'),
      CRSF: computeFor('CRSF'),
      CRTN: computeFor('CRTN'),
    };
  }, [history]);

  const globalTotalCloture = history.reduce((sum, h) => sum + h.ttPhysique, 0);
  const globalTotalCoupures = history.reduce((sum, h) => sum + h.totalCoupures, 0);
  const globalTotalVer = history.reduce((sum, h) => sum + h.ver, 0);

  const filtered = useMemo(() => {
    return history.filter((item) => {
      const code = (item.caisseCode || item.caissierNom || '').toUpperCase();
      const matchCaisse = caisseFilter === 'ALL' ? true : code === caisseFilter;

      const q = search.toLowerCase().trim();
      if (!q) return matchCaisse;
      const dateStr = new Date(item.dateCloture).toLocaleString('fr-FR').toLowerCase();
      const caissier = (item.caissierNom || '').toLowerCase();
      const caisseName = (item.caisseName || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();
      const idStr = (item.id || '').toLowerCase();
      return (
        matchCaisse &&
        (dateStr.includes(q) ||
          caissier.includes(q) ||
          caisseName.includes(q) ||
          code.toLowerCase().includes(q) ||
          notes.includes(q) ||
          idStr.includes(q))
      );
    });
  }, [history, caisseFilter, search]);

  return (
    <div className="mx-auto max-w-6xl pb-20 sm:pb-8">
      {/* ==================== PRINTABLE DOCUMENT TEMPLATE (VISIBLE ONLY DURING PRINT) ==================== */}
      {printEntry && (
        <div className="printable-document hidden print:block text-slate-900 bg-white">
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-bold text-sm">
                  {printEntry.caisseCode || 'CC'}
                </span>
                <span className="text-lg font-black tracking-tight uppercase">
                  Caisse Chauffeurs — {printEntry.caisseName || printEntry.caisseCode || 'Clôture'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 font-medium">
                Procès-Verbal Officiel de Clôture Journalière de Billetterie
              </p>
              <p className="text-[11px] text-slate-400">
                Caisse / Opérateur :{' '}
                <strong>{printEntry.caisseCode || printEntry.caissierNom || 'Responsable de caisse'}</strong>
              </p>
            </div>

            <div className="text-right">
              <span className="inline-block rounded-md bg-slate-900 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">
                Réf: {printEntry.id}
              </span>
              <p className="mt-2 text-xs font-mono font-bold">
                Date de Clôture : {new Date(printEntry.dateCloture).toLocaleString('fr-FR')}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Détail des Coupures Physiques Dénombrées ({printEntry.caisseCode || printEntry.caissierNom})
            </h4>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="py-2 px-3 font-bold uppercase">Coupure / Type</th>
                  <th className="py-2 px-3 font-bold uppercase text-center">Quantité Dénombrée</th>
                  <th className="py-2 px-3 font-bold uppercase text-right">Sous-Total (TND)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono">
                {filterOutOldCoin(printEntry.items).map((item: CoinBreakdownItem, idx: number) => (
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
                    Total des Coupures Physiques en Caisse (MT Espèce) :
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-sm text-slate-900">
                    {formatMoney(printEntry.totalCoupures)} TND
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-2xl border-2 border-slate-900 bg-slate-50 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-2 mb-3">
              Rapprochement Financier Définitif
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Total Coupures Physiques (MT Espèce) :</span>
                  <span className="font-mono font-bold">{formatMoney(printEntry.totalCoupures)} TND</span>
                </div>
                <div className="flex justify-between">
                  <span>SRF Monnaie (&le; 5T) :</span>
                  <span className="font-mono">{formatMoney(printEntry.srfPieces)} TND</span>
                </div>
                {printEntry.srfMoins > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>SRF - (Retenues) :</span>
                    <span className="font-mono">-{formatMoney(printEntry.srfMoins)} TND</span>
                  </div>
                )}
                {printEntry.ver > 0 && (
                  <div className="flex justify-between text-indigo-700">
                    <span>Versements Réalisés (VER) :</span>
                    <span className="font-mono font-bold">+{formatMoney(printEntry.ver)} TND</span>
                  </div>
                )}
              </div>

              <div className="space-y-1 border-l border-slate-300 pl-4">
                <div className="flex justify-between font-bold text-slate-900">
                  <span>TT (Total Physique de Clôture) :</span>
                  <span className="font-mono text-sm">{formatMoney(printEntry.ttPhysique)} TND</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Recette Attendue :</span>
                  <span className="font-mono">{formatMoney(printEntry.recetteTheorique)} TND</span>
                </div>
                <div className="flex justify-between font-bold text-sm pt-1 border-t border-slate-300">
                  <span>Écart de Caisse :</span>
                  <span className={`font-mono ${printEntry.ecartReste >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {printEntry.ecartReste > 0 ? '+' : ''}{formatMoney(printEntry.ecartReste)} TND
                  </span>
                </div>
              </div>
            </div>
            {printEntry.notes && (
              <div className="mt-3 pt-2 border-t border-slate-200 text-xs italic text-slate-600">
                Observation : {printEntry.notes}
              </div>
            )}
          </div>

          <div className="mt-10 grid grid-cols-2 gap-8 pt-4">
            <div className="border-t border-slate-400 pt-3 text-center">
              <p className="text-xs font-bold text-slate-900">Signature du Caissier Dépositaire</p>
              <div className="h-16" />
            </div>
            <div className="border-t border-slate-400 pt-3 text-center">
              <p className="text-xs font-bold text-slate-900">Visa du Superviseur / Responsable Financier</p>
              <div className="h-16" />
            </div>
          </div>
        </div>
      )}

      {/* ==================== INTERACTIVE SCREEN ==================== */}
      <div className="print:hidden">
        <PageHeader
          title="Historique de Clôture des Caisses (CRNU · CRSF · CRTN)"
          subtitle="Total de clôture individuel par caisse, montant global cumulé et détail complet de chaque clôture"
          icon={<IconHistory className="h-5 w-5" />}
          accent="amber"
          actions={
            <div className="flex w-full items-center gap-2 sm:w-auto">
              {!isSuperviseur && (
                <Link
                  href="/billetterie"
                  className="btn-ghost flex-1 sm:flex-none !py-2 text-xs sm:text-sm"
                >
                  <IconArrowLeft className="h-4 w-4" />
                  Retour au Comptage
                </Link>
              )}
              <button
                onClick={fetchHistory}
                className="btn-primary flex-1 sm:flex-none !py-2 text-xs sm:text-sm font-bold shadow-md"
              >
                Actualiser
              </button>
            </div>
          }
        />

        {/* Spécification 5 : Montant Global de Clôture + Total Individuel par Caisse (CRNU, CRSF, CRTN) */}
        <div className="mb-6 space-y-4">
          {/* Montant Global Cumulé */}
          <div className="card-dark bg-grid-pattern p-5 sm:p-6 text-white">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-amber-300 ring-1 ring-amber-400/30">
                  Cumul Global des Clôtures
                </span>
                <h2 className="mt-2 text-lg font-extrabold text-white sm:text-xl">
                  Montant Global de Clôture (Toutes Caisses Cumulées)
                </h2>
                <p className="text-xs text-slate-400">
                  Total cumulé des {history.length} clôture{history.length > 1 ? 's' : ''} archivée{history.length > 1 ? 's' : ''} (CRNU + CRSF + CRTN)
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3.5 text-right backdrop-blur-sm">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Global Clôture
                </span>
                <span className="font-mono text-2xl font-black text-amber-400 sm:text-3xl">
                  {formatMoney(globalTotalCloture)} <span className="text-xs text-slate-300">TND</span>
                </span>
                <div className="mt-1 flex items-center justify-end gap-3 text-[11px] text-slate-300">
                  <span>
                    Espèces: <strong className="font-mono text-emerald-300">{formatMoney(globalTotalCoupures)}</strong>
                  </span>
                  <span>
                    Versements: <strong className="font-mono text-sky-300">{formatMoney(globalTotalVer)}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Totaux Individuels par Caisse : CRNU, CRSF et CRTN */}
          {isSupervisorOrAdmin && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {(['CRNU', 'CRSF', 'CRTN'] as const).map((code) => {
                const item = totalsByCaisse[code];
                const isSelected = caisseFilter === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setCaisseFilter(isSelected ? 'ALL' : code)}
                    className={`card p-4 text-left transition-all ${
                      isSelected
                        ? 'ring-2 ring-indigo-600 bg-indigo-50/30'
                        : 'hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`flex h-8 w-8 items-center justify-center rounded-xl font-mono text-xs font-black text-white ${
                            code === 'CRNU'
                              ? 'bg-indigo-600'
                              : code === 'CRSF'
                              ? 'bg-emerald-600'
                              : 'bg-sky-600'
                          }`}
                        >
                          {code}
                        </span>
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">
                            Total Clôture {code}
                          </p>
                          <p className="text-[10px] font-medium text-slate-400">
                            {item.count} clôture{item.count > 1 ? 's' : ''} enregistrée{item.count > 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-indigo-600">
                        {isSelected ? 'Filtre actif ✓' : 'Filtrer →'}
                      </span>
                    </div>

                    <p className="mt-3 font-mono text-xl font-black text-slate-900">
                      {formatMoney(item.totalPhysique)}{' '}
                      <span className="text-xs font-normal text-slate-400">TND</span>
                    </p>

                    <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                      <span>
                        Esp: <strong className="font-mono text-emerald-700">{formatMoney(item.totalCoupures)}</strong>
                      </span>
                      <span>
                        Ver: <strong className="font-mono text-indigo-700">{formatMoney(item.totalVer)}</strong>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="card-pro p-4 mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par caisse (CRNU, CRSF, CRTN), date, référence ou note..."
              className="input !pl-9 text-xs sm:text-sm font-medium"
            />
          </div>

          {isSupervisorOrAdmin && (
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {(['ALL', 'CRNU', 'CRSF', 'CRTN'] as const).map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCaisseFilter(code)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition-all ${
                    caisseFilter === code
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {code === 'ALL' ? 'Toutes' : code}
                </button>
              ))}
            </div>
          )}

          <span className="badge-slate font-mono text-xs self-center">
            {filtered.length} clôture{filtered.length > 1 ? 's' : ''}
          </span>
        </div>

        {/* List of Closings */}
        {loading ? (
          <div className="card-pro p-12 text-center text-sm text-slate-400">
            Chargement de l&apos;historique des clôtures...
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-pro p-12 text-center">
            <IconCoins className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-slate-800">
              Aucun enregistrement de clôture trouvé
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
              Les clôtures journalières validées par les caisses CRNU, CRSF et CRTN apparaissent ici avec leur détail complet.
            </p>
          </div>
        ) : (
          <div className="card-pro overflow-hidden">
            {/* Mobile Responsive Cards View (sm:hidden) */}
            <div className="divide-y divide-slate-100 sm:hidden">
              {filtered.map((item) => {
                const code = (item.caisseCode || item.caissierNom || 'CAISSE').toUpperCase();
                return (
                  <div key={item.id} className="p-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-black text-white">
                            {code}
                          </span>
                          <span className="font-bold text-slate-900 text-xs">
                            {new Date(item.dateCloture).toLocaleDateString('fr-FR', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {new Date(item.dateCloture).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 font-medium">
                          Caisse : <strong className="text-slate-700">{item.caisseName || code}</strong>
                        </p>
                      </div>

                      <span
                        className={`inline-block px-2.5 py-1 rounded-full font-mono text-[11px] font-bold shrink-0 ${
                          item.ecartReste >= 0
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {item.ecartReste > 0 ? '+' : ''}
                        {formatMoney(item.ecartReste)} TND
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs mb-3 border border-slate-100">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Total Clôture (TT)
                        </span>
                        <strong className="num text-sm text-slate-900 font-black">
                          {formatMoney(item.ttPhysique)} TND
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Recette Attendue
                        </span>
                        <strong className="num text-sm text-slate-700">
                          {formatMoney(item.recetteTheorique)} TND
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          MT Espèce (Coupures)
                        </span>
                        <span className="num text-xs font-semibold text-emerald-700">
                          {formatMoney(item.totalCoupures)} TND
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Versements (VER)
                        </span>
                        <span className="num text-xs font-semibold text-indigo-700">
                          {item.ver > 0 ? `+${formatMoney(item.ver)}` : '0.000'} TND
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedEntry(item)}
                        className="btn-ghost flex-1 !py-1.5 text-xs font-bold text-slate-700 border border-slate-200"
                      >
                        Détail Complet
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTriggerPrint(item)}
                        className="btn-ghost !py-1.5 !px-3 text-xs font-bold text-indigo-600 border border-indigo-200 bg-indigo-50/50"
                        title="Imprimer PV"
                      >
                        <IconPrinter className="h-4 w-4" />
                      </button>
                      {!isSuperviseur && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item.id)}
                          className="btn-ghost !py-1.5 !px-3 text-xs text-rose-500 hover:bg-rose-50 border border-rose-200"
                          title="Supprimer"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                      )}
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
                    <th>Caisse</th>
                    <th>Date & Heure</th>
                    <th className="!text-right">MT Espèce (Coupures)</th>
                    <th className="!text-right">Versements</th>
                    <th className="!text-right">Total Clôture (TT)</th>
                    <th className="!text-right">Recette Attendue</th>
                    <th className="!text-right">Écart / Reste</th>
                    <th className="!text-center">Détail & Impression</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => {
                    const code = (item.caisseCode || item.caissierNom || 'CAISSE').toUpperCase();
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td>
                          <div className="flex items-center gap-2">
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
                            <span className="text-xs font-semibold text-slate-600">
                              {item.archivedTransactions?.length || 0} reçu(s)
                            </span>
                          </div>
                        </td>

                        <td>
                          <div className="flex items-center gap-2">
                            <IconCalendar className="h-4 w-4 text-slate-400" />
                            <div>
                              <p className="font-bold text-slate-900 text-xs">
                                {new Date(item.dateCloture).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                })}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {new Date(item.dateCloture).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="text-right num font-bold text-xs text-emerald-700">
                          {formatMoney(item.totalCoupures)} TND
                        </td>

                        <td className="text-right num font-semibold text-xs text-indigo-700">
                          {item.ver > 0 ? `+${formatMoney(item.ver)} TND` : '0.000 TND'}
                        </td>

                        <td className="text-right num font-black text-xs text-slate-900">
                          {formatMoney(item.ttPhysique)} TND
                        </td>

                        <td className="text-right num font-bold text-xs text-slate-600">
                          {formatMoney(item.recetteTheorique)} TND
                        </td>

                        <td className="text-right">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full font-mono text-xs font-bold ${
                              item.ecartReste >= 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {item.ecartReste > 0 ? '+' : ''}
                            {formatMoney(item.ecartReste)} TND
                          </span>
                        </td>

                        <td className="text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedEntry(item)}
                              className="btn-ghost !px-2.5 !py-1.5 text-slate-700 hover:text-indigo-700 border border-slate-200"
                              title="Voir le détail complet de la clôture"
                            >
                              <span className="text-xs font-bold">Détail Complet</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleTriggerPrint(item)}
                              className="btn-ghost !p-1.5 text-indigo-600 hover:bg-indigo-50"
                              title="Imprimer le PV de Clôture"
                            >
                              <IconPrinter className="h-4 w-4" />
                            </button>
                            {!isSuperviseur && (
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="btn-ghost !p-1.5 text-rose-500 hover:bg-rose-50"
                                title="Supprimer"
                              >
                                <IconTrash className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Breakdown Details Modal (Mounted in Portal, Fully Responsive & Scrollable, STRICTLY HIDDEN ON PRINT) */}
        {mounted &&
          selectedEntry &&
          createPortal(
            <div
              role="dialog"
              aria-modal="true"
              className="no-print print:hidden fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 overflow-hidden"
            >
              <div
                className="no-print print:hidden fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
                onClick={() => setSelectedEntry(null)}
              />

              <div className="no-print print:hidden relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl z-10 overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[88vh] border border-slate-200/80">
                <div className="shrink-0 flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 sm:px-6 py-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 px-2 items-center justify-center rounded-lg bg-slate-900 text-white font-mono font-black text-xs">
                        {selectedEntry.caisseCode || selectedEntry.caissierNom || 'PV'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900">
                        Détail Complet de Clôture — {selectedEntry.caisseName || selectedEntry.caisseCode || 'Caisse'}
                      </h3>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Clôturé le {new Date(selectedEntry.dateCloture).toLocaleString('fr-FR')} · Réf: {selectedEntry.id}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedEntry(null)}
                    className="btn-icon !h-8 !w-8 hover:bg-slate-200"
                    aria-label="Fermer"
                  >
                    <IconClose className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-emerald-50/60 p-2.5 sm:p-3 rounded-2xl border border-emerald-200">
                      <span className="text-[10px] text-emerald-700 uppercase font-bold block">
                        MT Espèce (Coupures)
                      </span>
                      <strong className="num text-xs sm:text-sm text-emerald-900">
                        {formatMoney(selectedEntry.totalCoupures)} TND
                      </strong>
                    </div>
                    <div className="bg-indigo-50/60 p-2.5 sm:p-3 rounded-2xl border border-indigo-200">
                      <span className="text-[10px] text-indigo-700 uppercase font-bold block">
                        Versements (VER)
                      </span>
                      <strong className="num text-xs sm:text-sm text-indigo-900">
                        {formatMoney(selectedEntry.ver)} TND
                      </strong>
                    </div>
                    <div className="bg-slate-900 text-white p-2.5 sm:p-3 rounded-2xl">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block">
                        Total Clôture (TT)
                      </span>
                      <strong className="num text-xs sm:text-sm text-amber-400">
                        {formatMoney(selectedEntry.ttPhysique)} TND
                      </strong>
                    </div>
                    <div
                      className={`p-2.5 sm:p-3 rounded-2xl border ${
                        selectedEntry.ecartReste >= 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <span className="text-[10px] uppercase font-bold block">Écart / Reste</span>
                      <strong className="num text-xs sm:text-sm">
                        {selectedEntry.ecartReste > 0 ? '+' : ''}
                        {formatMoney(selectedEntry.ecartReste)} TND
                      </strong>
                    </div>
                  </div>

                  {/* Mobile Coupures Cards */}
                  <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white sm:hidden overflow-hidden">
                    {filterOutOldCoin(selectedEntry.items).map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2.5 w-2.5 rounded-full ${
                              item.isBillet ? 'bg-indigo-500' : 'bg-amber-500'
                            }`}
                          />
                          <span className="font-semibold text-slate-900">{item.label}</span>
                        </div>
                        <div className="text-right">
                          <span className="badge-slate font-mono text-[11px] font-bold mr-2">
                            {item.nombre} pcs
                          </span>
                          <strong className="num text-slate-900">
                            {formatMoney(item.nombre * item.valeur)} TND
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop 11 Denominations Table */}
                  <div className="rounded-2xl border border-slate-200 overflow-hidden hidden sm:block bg-white">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-700 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3 font-bold uppercase text-[11px]">Coupure</th>
                          <th className="py-2.5 px-3 font-bold uppercase text-[11px] text-center">
                            Quantité
                          </th>
                          <th className="py-2.5 px-3 font-bold uppercase text-[11px] text-right">
                            Sous-Total (TND)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {filterOutOldCoin(selectedEntry.items).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2 px-3 font-sans font-medium text-slate-800 text-xs">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    item.isBillet ? 'bg-indigo-500' : 'bg-amber-500'
                                  }`}
                                />
                                <span>{item.label}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-center font-bold text-slate-900 text-xs">
                              <span className="inline-block px-2 py-0.5 rounded-lg bg-slate-100 font-mono text-[11px]">
                                {item.nombre}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900 text-xs">
                              {formatMoney(item.nombre * item.valeur)} TND
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedEntry.notes && (
                    <div className="rounded-2xl bg-slate-50 p-3 text-xs border border-slate-200">
                      <span className="font-bold text-slate-600 block mb-0.5">Observation :</span>
                      <p className="text-slate-800">{selectedEntry.notes}</p>
                    </div>
                  )}
                </div>

                <div className="shrink-0 flex items-center justify-between border-t border-slate-100 bg-slate-50/90 px-4 sm:px-6 py-3">
                  <span className="text-[11px] font-mono text-slate-400">
                    Réf: {selectedEntry.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedEntry(null)}
                      className="btn-ghost !py-2 text-xs"
                    >
                      Fermer
                    </button>
                    <button
                      onClick={() => handleTriggerPrint(selectedEntry)}
                      className="btn-primary !py-2 text-xs font-bold shadow-md"
                    >
                      <IconPrinter className="h-4 w-4" />
                      Imprimer le PV
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
