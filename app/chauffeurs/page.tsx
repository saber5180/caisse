'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCaisseStore } from '@/lib/store';
import { Driver, DriverStatus } from '@/types/caisse';
import { formatDate } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import {
  IconAlert,
  IconArrowRight,
  IconCalculator,
  IconCheck,
  IconClose,
  IconCoins,
  IconEdit,
  IconPlus,
  IconSearch,
  IconSheet,
  IconSync,
  IconTrash,
  IconTruck,
} from '@/components/Icons';

const SUGGESTED_CIRCUITS = [
  'SFAX 1',
  'SFAX 2',
  'SFAX 3',
  'SFAX 4',
  'SURGELE SFAX 1',
  'DJERBA 1',
  'DJERBA 2',
  'GABES 1',
  'TUNIS 6',
  'SAHEL 1',
  'KAIROUAN 1',
  'STAND-BY',
];

function StatusBadgeSelect({
  value,
  onChange,
}: {
  value: DriverStatus;
  onChange: (val: DriverStatus) => void;
}) {
  const isNonPaye = value === 'NON PAYE';
  const isPaye = value === 'PAYE';

  const colorStyles = isNonPaye
    ? 'border-rose-300/90 bg-rose-50 text-rose-700 hover:bg-rose-100/80 focus:ring-rose-500/25'
    : isPaye
    ? 'border-emerald-300/90 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80 focus:ring-emerald-500/25'
    : 'border-amber-300/90 bg-amber-50 text-amber-800 hover:bg-amber-100/80 focus:ring-amber-500/25';

  const dotColor = isNonPaye
    ? 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
    : isPaye
    ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]'
    : 'bg-amber-500';

  return (
    <div className="relative inline-flex items-center">
      <span className={`pointer-events-none absolute left-2.5 h-2 w-2 rounded-full ${dotColor}`} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DriverStatus)}
        className={`cursor-pointer appearance-none rounded-xl border py-1.5 pl-6 pr-7 text-xs font-extrabold tracking-tight shadow-sm transition-all focus:outline-none focus:ring-2 ${colorStyles}`}
      >
        <option value="NON PAYE" className="bg-white font-semibold text-slate-900">
          NON PAYÉ
        </option>
        <option value="PAYE" className="bg-white font-semibold text-slate-900">
          PAYÉ
        </option>
        <option value="PAS DE CAISSE" className="bg-white font-semibold text-slate-900">
          PAS DE CAISSE
        </option>
      </select>
      <span className="pointer-events-none absolute right-2 text-current opacity-65">
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="m19 9-7 7-7-7" />
        </svg>
      </span>
    </div>
  );
}

function getInitials(name: string): string {
  return (name || 'CH')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export default function ChauffeursPage() {
  const drivers = useCaisseStore((state) => state.drivers);
  const updateDriverStatus = useCaisseStore((state) => state.updateDriverStatus);
  const updateDriver = useCaisseStore((state) => state.updateDriver);
  const deleteDriver = useCaisseStore((state) => state.deleteDriver);
  const addDriver = useCaisseStore((state) => state.addDriver);
  const resetAllDriversStatus = useCaisseStore((state) => state.resetAllDriversStatus);
  const loadDemoDriversTemplate = useCaisseStore((state) => state.loadDemoDriversTemplate);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<DriverStatus | 'ALL'>('ALL');
  const [filterCircuit, setFilterCircuit] = useState<string>('ALL');

  // Add / Edit Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [formNom, setFormNom] = useState('');
  const [formTr, setFormTr] = useState('');
  const [formCircuit, setFormCircuit] = useState('');
  const [formStatut, setFormStatut] = useState<DriverStatus>('NON PAYE');
  const [formSerie, setFormSerie] = useState('');
  const [formSousSerie, setFormSousSerie] = useState('');
  const [formMontantBordereau, setFormMontantBordereau] = useState<number>(0);
  const [formError, setFormError] = useState<string | null>(null);

  const nextSuggestedTr = useMemo(() => {
    const nums = drivers
      .map((d) => parseInt(d.tr, 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    if (nums.length === 0) return '1';
    return String(Math.max(...nums) + 1);
  }, [drivers]);

  const activeCircuits = useMemo(() => {
    const set = new Set<string>();
    drivers.forEach((d) => {
      const c = (d.programmeJour || d.circuitActuel || 'STAND-BY').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort();
  }, [drivers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return drivers.filter((d) => {
      const matchStatus = filterStatus === 'ALL' ? true : d.statut === filterStatus;
      const circuit = (d.programmeJour || d.circuitActuel || 'STAND-BY').trim();
      const matchCircuit = filterCircuit === 'ALL' ? true : circuit === filterCircuit;
      const matchSearch = q
        ? d.nom.toLowerCase().includes(q) ||
          d.tr.toLowerCase().includes(q) ||
          circuit.toLowerCase().includes(q)
        : true;
      return matchStatus && matchCircuit && matchSearch;
    });
  }, [drivers, filterStatus, filterCircuit, search]);

  const countNonPaye = drivers.filter((d) => d.statut === 'NON PAYE').length;
  const countPaye = drivers.filter((d) => d.statut === 'PAYE').length;
  const countPasDeCaisse = drivers.filter((d) => d.statut === 'PAS DE CAISSE').length;

  const openCreateModal = () => {
    setEditingDriver(null);
    setFormNom('');
    setFormTr(nextSuggestedTr);
    setFormCircuit('');
    setFormStatut('NON PAYE');
    setFormSerie('');
    setFormSousSerie('');
    setFormMontantBordereau(0);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (d: Driver) => {
    setEditingDriver(d);
    setFormNom(d.nom);
    setFormTr(d.tr);
    setFormCircuit(d.programmeJour || d.circuitActuel || '');
    setFormStatut(d.statut);
    setFormSerie(d.serie || '');
    setFormSousSerie(d.sousSerie || '');
    setFormMontantBordereau(d.montantBordereau || 0);
    setFormError(null);
    setModalOpen(true);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanNom = formNom.trim();
    const cleanTr = formTr.trim().toUpperCase();
    const cleanCircuit = formCircuit.trim().toUpperCase() || 'STAND-BY';

    if (!cleanNom) {
      setFormError('Veuillez saisir le nom du chauffeur.');
      return;
    }
    if (!cleanTr) {
      setFormError('Veuillez saisir un code TR unique.');
      return;
    }

    const duplicate = drivers.find(
      (d) => d.tr.trim().toUpperCase() === cleanTr && d.id !== editingDriver?.id
    );
    if (duplicate) {
      setFormError(`Le code TR "${cleanTr}" est déjà attribué à ${duplicate.nom}.`);
      return;
    }

    if (editingDriver) {
      updateDriver(editingDriver.id, {
        nom: cleanNom.toUpperCase(),
        tr: cleanTr,
        statut: formStatut,
        programmeJour: cleanCircuit,
        circuitActuel: cleanCircuit,
        serie: formSerie.trim(),
        sousSerie: formSousSerie.trim(),
        montantBordereau: formMontantBordereau,
      });
    } else {
      addDriver({
        nom: cleanNom.toUpperCase(),
        tr: cleanTr,
        statut: formStatut,
        dateDerniere: new Date().toISOString(),
        caissesDues: formStatut === 'NON PAYE' ? 1 : 0,
        programmeJour: cleanCircuit,
        circuitActuel: cleanCircuit,
        serie: formSerie.trim(),
        sousSerie: formSousSerie.trim(),
        montantBordereau: formMontantBordereau,
      });
    }

    setModalOpen(false);
  };

  return (
    <>
      <PageHeader
        title="Flotte & Mouvement des Chauffeurs"
        subtitle="Pilotage des statuts d'encaissement, attribution des circuits et surveillance des retards"
        badge={`${drivers.length} Chauffeur${drivers.length > 1 ? 's' : ''}`}
        icon={<IconTruck className="h-5 w-5" />}
        accent="rose"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {drivers.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Voulez-vous passer TOUS les chauffeurs en statut "NON PAYÉ" ?')) {
                    resetAllDriversStatus('NON PAYE');
                  }
                }}
                className="btn-ghost flex-1 sm:flex-none !py-2 !text-xs text-rose-600 hover:!border-rose-200 hover:!bg-rose-50"
              >
                <IconSync className="h-3.5 w-3.5" />
                Reset Non Payé
              </button>
            )}
            <Link
              href="/excel"
              className="btn-ghost flex-1 sm:flex-none !py-2 !text-xs"
            >
              <IconSheet className="h-4 w-4 text-slate-500" />
              Import Excel
            </Link>
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-primary w-full sm:w-auto !py-2.5 !text-xs sm:!text-sm"
            >
              <IconPlus className="h-4 w-4" />
              Nouveau Chauffeur
            </button>
          </div>
        }
      />

      {/* Interactive KPI Filter Strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setFilterStatus('ALL')}
          className={`card p-4 text-left transition-all ${
            filterStatus === 'ALL'
              ? 'ring-2 ring-indigo-600 border-indigo-300 bg-indigo-50/25'
              : 'hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              Total Flotte
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <IconTruck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-slate-900">{drivers.length}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-400">Tous les chauffeurs actifs</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('NON PAYE')}
          className={`card p-4 text-left transition-all ${
            filterStatus === 'NON PAYE'
              ? 'ring-2 ring-rose-600 border-rose-300 bg-rose-50/30'
              : 'hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-600">
              Non Payés
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
              <IconAlert className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-rose-600">{countNonPaye}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-400">Caisses en attente</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('PAYE')}
          className={`card p-4 text-left transition-all ${
            filterStatus === 'PAYE'
              ? 'ring-2 ring-emerald-600 border-emerald-300 bg-emerald-50/30'
              : 'hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
              Payés
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <IconCheck className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-emerald-700">{countPaye}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-400">Tournées clôturées</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus('PAS DE CAISSE')}
          className={`card p-4 text-left transition-all ${
            filterStatus === 'PAS DE CAISSE'
              ? 'ring-2 ring-amber-500 border-amber-300 bg-amber-50/30'
              : 'hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
              Sans Caisse
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <IconCoins className="h-4 w-4" />
            </span>
          </div>
          <p className="mt-2 font-mono text-2xl font-extrabold text-amber-700">
            {countPasDeCaisse}
          </p>
          <p className="mt-1 text-[11px] font-medium text-slate-400">Repos / Stand-by</p>
        </button>
      </div>

      {/* Filter & Search Command Bar */}
      <div className="card mb-5 p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          {/* Segmented Status Pills */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-slate-100/90 p-1">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous ({drivers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('NON PAYE')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                filterStatus === 'NON PAYE'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Non Payés ({countNonPaye})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('PAYE')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                filterStatus === 'PAYE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Payés ({countPaye})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('PAS DE CAISSE')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                filterStatus === 'PAS DE CAISSE'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'text-amber-800 hover:bg-amber-50'
              }`}
            >
              Sans Caisse ({countPasDeCaisse})
            </button>
          </div>

          {/* Right Controls: Circuit Filter + Search */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            {activeCircuits.length > 0 && (
              <select
                value={filterCircuit}
                onChange={(e) => setFilterCircuit(e.target.value)}
                className="select !min-h-10 !w-full sm:!w-44 !py-1.5 !text-xs font-semibold"
              >
                <option value="ALL">Tous les circuits</option>
                {activeCircuits.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}

            <div className="relative w-full sm:w-72">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher nom, code TR, circuit..."
                className="input !min-h-10 !py-1.5 !pl-9 !pr-8 !text-xs font-medium"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Fleet Card */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2.5">
            <h2 className="card-title">
              {filtered.length} Chauffeur{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
            </h2>
            {filterStatus !== 'ALL' && (
              <span className="badge-indigo text-[10px]">{filterStatus}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openCreateModal}
              className="btn-ghost !px-3 !py-1.5 !text-xs font-bold text-indigo-700 hover:!border-indigo-300 hover:!bg-indigo-50/50"
            >
              <IconPlus className="h-3.5 w-3.5" />
              Ajouter rapide
            </button>
          </div>
        </div>

        {drivers.length === 0 ? (
          <EmptyState
            icon={<IconTruck className="h-7 w-7" />}
            title="Votre flotte chauffeurs est vide"
            description="Ce compte dispose de sa propre base de données isolée. Créez votre premier chauffeur manuellement, importez un fichier Excel ou chargez le modèle standard."
          >
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={openCreateModal}
                className="btn-primary !px-4 !py-2.5 !text-xs font-bold"
              >
                <IconPlus className="h-4 w-4" />
                Créer un Chauffeur
              </button>
              <Link href="/excel" className="btn-ghost !px-4 !py-2.5 !text-xs font-semibold">
                <IconSheet className="h-4 w-4" />
                Importer depuis Excel
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm('Voulez-vous charger le modèle des 70 chauffeurs dans votre compte ?')
                  ) {
                    loadDemoDriversTemplate();
                  }
                }}
                className="btn-ghost !px-4 !py-2.5 !text-xs font-bold text-indigo-700 border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/70"
              >
                Charger Modèle 70 Chauffeurs
              </button>
            </div>
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconSearch className="h-6 w-6" />}
            title="Aucun chauffeur trouvé"
            description="Aucun résultat ne correspond à vos filtres actuels."
          >
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilterStatus('ALL');
                setFilterCircuit('ALL');
              }}
              className="btn-ghost !px-3.5 !py-2 !text-xs"
            >
              Réinitialiser les filtres
            </button>
          </EmptyState>
        ) : (
          <>
            {/* Mobile Card View (md:hidden) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((d) => {
                const isNonPaye = d.statut === 'NON PAYE';
                const circuit = d.programmeJour || d.circuitActuel || 'STAND-BY';

                return (
                  <div
                    key={d.id}
                    className={`p-4 transition-colors ${
                      isNonPaye ? 'bg-rose-50/35' : 'hover:bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold ${
                            isNonPaye
                              ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
                              : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80'
                          }`}
                        >
                          {getInitials(d.nom)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-slate-900">{d.nom}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-bold text-white">
                              TR {d.tr}
                            </span>
                            <span className="badge-slate text-[10.5px]">{circuit}</span>
                          </div>
                        </div>
                      </div>

                      <StatusBadgeSelect
                        value={d.statut}
                        onChange={(val) => updateDriverStatus(d.id, val)}
                      />
                    </div>

                    {d.reclamation && (
                      <div
                        className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                          isNonPaye
                            ? 'border-rose-200 bg-rose-50/90 text-rose-700'
                            : 'border-slate-200/80 bg-slate-50 text-slate-600'
                        }`}
                      >
                        {isNonPaye && <IconAlert className="h-3.5 w-3.5 shrink-0 text-rose-500" />}
                        <span className="truncate">{d.reclamation}</span>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                      <span>MAJ : {formatDate(d.dateDerniere)}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(d)}
                          className="btn-icon !h-8 !w-8"
                          title="Modifier"
                        >
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Supprimer le chauffeur ${d.nom} ?`)) {
                              deleteDriver(d.id);
                            }
                          }}
                          className="btn-icon !h-8 !w-8 hover:!bg-rose-50 hover:!text-rose-600"
                          title="Supprimer"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                          className="btn-primary !px-3 !py-1.5 !text-xs"
                        >
                          <IconCalculator className="h-3.5 w-3.5" />
                          Encaisser
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Enterprise Table View (hidden md:block) */}
            <div className="table-wrap hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-20">Code TR</th>
                    <th className="w-56">Chauffeur</th>
                    <th className="w-36">Circuit</th>
                    <th className="w-44">Statut Caisse</th>
                    <th className="w-28 !text-center">Situation</th>
                    <th>Suivi & Délai</th>
                    <th className="w-44 !text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const isNonPaye = d.statut === 'NON PAYE';
                    const circuit = d.programmeJour || d.circuitActuel || 'STAND-BY';

                    return (
                      <tr key={d.id} className={isNonPaye ? 'row-alert' : ''}>
                        <td>
                          <span className="inline-flex items-center rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-extrabold text-white shadow-sm">
                            #{d.tr}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold ${
                                isNonPaye
                                  ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-200'
                                  : 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200/80'
                              }`}
                            >
                              {getInitials(d.nom)}
                            </div>
                            <div className="min-w-0">
                              <p
                                className="max-w-[175px] truncate font-bold text-slate-900"
                                title={d.nom}
                              >
                                {d.nom}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                MAJ {formatDate(d.dateDerniere)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className="badge-slate max-w-[135px] truncate font-semibold"
                            title={circuit}
                          >
                            {circuit}
                          </span>
                        </td>
                        <td>
                          <StatusBadgeSelect
                            value={d.statut}
                            onChange={(val) => updateDriverStatus(d.id, val)}
                          />
                        </td>
                        <td className="text-center">
                          {d.caissesDues > 0 ? (
                            <span className="badge-solid-rose font-extrabold">
                              {d.caissesDues} Caisse
                            </span>
                          ) : (
                            <span className="badge-emerald">
                              <IconCheck className="h-3 w-3" />
                              En règle
                            </span>
                          )}
                        </td>
                        <td className="max-w-[250px]">
                          <div
                            title={d.reclamation}
                            className={`flex items-center gap-2 truncate text-xs ${
                              isNonPaye ? 'font-bold text-rose-700' : 'font-medium text-slate-600'
                            }`}
                          >
                            {isNonPaye && (
                              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-rose-500" />
                            )}
                            <span className="truncate">{d.reclamation}</span>
                          </div>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                              className="btn-primary !px-3 !py-1.5 !text-xs"
                            >
                              Encaisser
                              <IconArrowRight className="h-3.5 w-3.5" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => openEditModal(d)}
                              className="btn-icon"
                              title="Modifier ce chauffeur"
                            >
                              <IconEdit className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Supprimer le chauffeur ${d.nom} ?`)) {
                                  deleteDriver(d.id);
                                }
                              }}
                              className="btn-icon hover:!bg-rose-50 hover:!text-rose-600"
                              title="Supprimer ce chauffeur"
                            >
                              <IconTrash className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal Création / Édition Chauffeur */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm"
            onClick={() => setModalOpen(false)}
          />
          <div className="animate-scale-in relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            {/* Dark Executive Modal Header */}
            <div className="flex items-center justify-between bg-obsidian-mesh px-6 py-5 text-white">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-400/30">
                  <IconTruck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {editingDriver ? 'Modifier la Fiche Chauffeur' : 'Nouveau Chauffeur'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Synchronisation instantanée avec la base PostgreSQL du compte
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4 p-6">
              {formError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">
                  <IconAlert className="h-4 w-4 shrink-0 text-rose-500" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="label">Nom & Prénom du Chauffeur *</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={formNom}
                    onChange={(e) => setFormNom(e.target.value)}
                    placeholder="Ex: HICHEM BEN SALEM"
                    className="input uppercase font-semibold"
                  />
                </div>

                <div>
                  <label className="label">Code TR *</label>
                  <input
                    type="text"
                    required
                    value={formTr}
                    onChange={(e) => setFormTr(e.target.value)}
                    placeholder="Ex: 110"
                    className="input font-mono font-extrabold uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="label">Circuit / Tournée Affectée</label>
                <input
                  type="text"
                  list="circuits-preset-list"
                  value={formCircuit}
                  onChange={(e) => setFormCircuit(e.target.value)}
                  placeholder="Ex: SFAX 1, DJERBA 2, TUNIS 6 ou STAND-BY"
                  className="input uppercase font-medium"
                />
                <datalist id="circuits-preset-list">
                  {SUGGESTED_CIRCUITS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['SFAX 1', 'DJERBA 1', 'TUNIS 6', 'GABES 1', 'STAND-BY'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormCircuit(preset)}
                      className={`rounded-lg border px-2 py-1 text-[10.5px] font-bold transition-colors ${
                        formCircuit.trim().toUpperCase() === preset
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">Statut Initial de Caisse</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        val: 'NON PAYE',
                        label: 'NON PAYÉ',
                        active: 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500/20',
                      },
                      {
                        val: 'PAYE',
                        label: 'PAYÉ',
                        active:
                          'border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20',
                      },
                      {
                        val: 'PAS DE CAISSE',
                        label: 'SANS CAISSE',
                        active:
                          'border-amber-500 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20',
                      },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setFormStatut(opt.val)}
                      className={`rounded-xl border py-2.5 text-xs font-extrabold transition-all ${
                        formStatut === opt.val
                          ? opt.active
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Colonne Série</label>
                  <input
                    type="text"
                    value={formSerie}
                    onChange={(e) => setFormSerie(e.target.value)}
                    placeholder="Ex: S-01, A"
                    className="input font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="label">Colonne Sous-série</label>
                  <input
                    type="text"
                    value={formSousSerie}
                    onChange={(e) => setFormSousSerie(e.target.value)}
                    placeholder="Ex: SS-1, 01"
                    className="input font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="label">Montant des Bordereaux Saisis (TND)</label>
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={formMontantBordereau === 0 ? '' : formMontantBordereau}
                  onChange={(e) => setFormMontantBordereau(parseFloat(e.target.value) || 0)}
                  placeholder="0.000 TND"
                  className="input num font-bold text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-ghost !py-2.5 !text-xs"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary !px-5 !py-2.5 !text-xs font-extrabold">
                  <IconCheck className="h-4 w-4" />
                  {editingDriver ? 'Enregistrer les Modifications' : 'Créer le Chauffeur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
