'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCaisseStore } from '@/lib/store';
import { Driver, DriverStatus } from '@/types/caisse';
import { formatDate, getStatusBadge } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import {
  IconAlert,
  IconClose,
  IconPlus,
  IconSearch,
  IconTrash,
  IconTruck,
} from '@/components/Icons';

export default function ChauffeursPage() {
  const drivers = useCaisseStore((state) => state.drivers);
  const updateDriverStatus = useCaisseStore((state) => state.updateDriverStatus);
  const deleteDriver = useCaisseStore((state) => state.deleteDriver);
  const addDriver = useCaisseStore((state) => state.addDriver);
  const resetAllDriversStatus = useCaisseStore((state) => state.resetAllDriversStatus);

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<DriverStatus | 'ALL'>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newDriverNom, setNewDriverNom] = useState('');
  const [newDriverTr, setNewDriverTr] = useState('');
  const [newDriverCircuit, setNewDriverCircuit] = useState('');

  const filtered = drivers.filter((d) => {
    const matchStatus = filterStatus === 'ALL' ? true : d.statut === filterStatus;
    const q = search.trim().toLowerCase();
    const matchSearch = q
      ? d.nom.toLowerCase().includes(q) ||
        d.tr.toLowerCase().includes(q) ||
        (d.programmeJour && d.programmeJour.toLowerCase().includes(q))
      : true;
    return matchStatus && matchSearch;
  });

  const countByStatus = (status: DriverStatus) => drivers.filter((d) => d.statut === status).length;

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDriverNom.trim() || !newDriverTr.trim()) return;

    addDriver({
      nom: newDriverNom.trim(),
      tr: newDriverTr.trim(),
      statut: 'NON PAYE',
      dateDerniere: new Date().toISOString(),
      caissesDues: 1,
      programmeJour: newDriverCircuit.trim(),
      circuitActuel: newDriverCircuit.trim(),
    });

    setNewDriverNom('');
    setNewDriverTr('');
    setNewDriverCircuit('');
    setShowAddModal(false);
  };

  return (
    <>
      <PageHeader
        title="Mouvement des Chauffeurs"
        subtitle="Suivi des statuts, règlements, circuits attribués et alertes d'impayés"
        icon={<IconTruck className="h-5 w-5" />}
        accent="rose"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <button
              onClick={() => {
                if (confirm('Voulez-vous passer TOUS les chauffeurs en statut "NON PAYÉ" ?')) {
                  resetAllDriversStatus('NON PAYE');
                }
              }}
              className="btn-danger flex-1 sm:flex-none !py-2 text-xs"
              title="Réinitialiser tout en NON PAYÉ (Touche S)"
            >
              Reset Tout en NON PAYÉ
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="btn-primary flex-1 sm:flex-none !py-2 text-xs sm:text-sm font-bold"
            >
              <IconPlus className="h-4 w-4" />
              Nouveau Chauffeur
            </button>
          </div>
        }
      />

      {/* Barre de Filtres et Recherche */}
      <div className="card mb-5 p-3.5 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setFilterStatus('ALL')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                filterStatus === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tous ({drivers.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('NON PAYE')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                filterStatus === 'NON PAYE'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Non Payés ({countByStatus('NON PAYE')})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('PAYE')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                filterStatus === 'PAYE'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              Payés ({countByStatus('PAYE')})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus('PAS DE CAISSE')}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                filterStatus === 'PAS DE CAISSE'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Sans Caisse ({countByStatus('PAS DE CAISSE')})
            </button>
          </div>

          {/* Recherche */}
          <div className="relative w-full md:w-72">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher nom, TR, circuit..."
              className="input !pl-8 !text-xs !min-h-9"
            />
          </div>
        </div>
      </div>

      {/* Tableau ou Cartes des Chauffeurs */}
      <div className="card overflow-hidden">
        <div className="card-header bg-slate-50/70">
          <h2 className="card-title text-sm">
            {filtered.length} Chauffeur{filtered.length > 1 ? 's' : ''}
          </h2>
          <span className="text-xs text-slate-400">
            Total {drivers.length} dans le système
          </span>
        </div>

        {drivers.length === 0 ? (
          <EmptyState
            icon={<IconTruck className="h-7 w-7 text-indigo-500" />}
            title="Aucun chauffeur dans cette caisse"
            description="Cette caisse dispose de sa propre base indépendante. Ajoutez vos chauffeurs ou importez votre fichier Excel."
          >
            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="btn-primary !px-3 !py-1.5 !text-xs font-bold"
              >
                <IconPlus className="h-4 w-4" />
                Nouveau Chauffeur
              </button>
              <Link href="/excel" className="btn-ghost !px-3 !py-1.5 !text-xs font-semibold">
                Importer depuis Excel
              </Link>
            </div>
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<IconTruck className="h-6 w-6" />}
            title="Aucun chauffeur correspondant"
            description="Modifiez vos critères de recherche ou réinitialisez les filtres."
          />
        ) : (
          <>
            {/* Mobile Card View (md:hidden) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filtered.map((d) => {
                const isNonPaye = d.statut === 'NON PAYE';

                return (
                  <div
                    key={d.id}
                    className={`p-4 transition-colors ${
                      isNonPaye ? 'bg-rose-50/40' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="badge-indigo font-mono text-xs">TR {d.tr}</span>
                          <p className="text-sm font-bold text-slate-900 truncate">{d.nom}</p>
                        </div>
                        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-500">
                          <span className="badge-slate font-medium text-[11px]">
                            {d.programmeJour || d.circuitActuel || 'STAND-BY'}
                          </span>
                          {d.caissesDues > 0 && (
                            <span className="badge-solid-rose text-[10px]">
                              {d.caissesDues} Caisse Due
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status Dropdown */}
                      <select
                        value={d.statut}
                        onChange={(e) => updateDriverStatus(d.id, e.target.value as DriverStatus)}
                        className={`select !w-auto !py-1 !pl-2 !pr-7 !text-[11px] font-bold ${getStatusBadge(
                          d.statut
                        )}`}
                      >
                        <option value="NON PAYE">NON PAYÉ</option>
                        <option value="PAYE">PAYÉ</option>
                        <option value="PAS DE CAISSE">PAS DE CAISSE</option>
                      </select>
                    </div>

                    {/* Delay or Alert Banner */}
                    {d.reclamation && (
                      <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50/80 px-2.5 py-1 text-xs font-semibold text-rose-700 flex items-center gap-1.5">
                        <IconAlert className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                        <span className="truncate">{d.reclamation}</span>
                      </div>
                    )}

                    {/* Actions row */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-400">
                      <span>Dernier: {formatDate(d.dateDerniere)}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Supprimer le chauffeur ${d.nom} ?`)) {
                              deleteDriver(d.id);
                            }
                          }}
                          className="btn-icon !h-8 !w-8 text-slate-400 hover:text-rose-600"
                        >
                          <IconTrash className="h-4 w-4" />
                        </button>
                        <Link
                          href={`/caisse?tr=${d.tr}`}
                          className="btn-primary !px-3 !py-1.5 !text-xs font-bold"
                        >
                          Encaisser
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (hidden md:block) */}
            <div className="table-wrap hidden md:block">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-16">TR</th>
                    <th>Nom du Chauffeur</th>
                    <th>Circuit / Programme</th>
                    <th>Statut</th>
                    <th>Dette</th>
                    <th>Dernier Événement</th>
                    <th>Réclamation / Délai</th>
                    <th className="!text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((d) => {
                    const isNonPaye = d.statut === 'NON PAYE';

                    return (
                      <tr key={d.id} className={isNonPaye ? 'row-alert' : ''}>
                        <td>
                          <span className="num font-bold text-slate-900">{d.tr}</span>
                        </td>
                        <td>
                          <div className="font-semibold text-slate-900">{d.nom}</div>
                        </td>
                        <td>
                          <span className="badge-slate font-medium">
                            {d.programmeJour || d.circuitActuel || 'STAND-BY'}
                          </span>
                        </td>
                        <td>
                          <select
                            value={d.statut}
                            onChange={(e) => updateDriverStatus(d.id, e.target.value as DriverStatus)}
                            className={`select !w-auto !py-1 !pl-2.5 !pr-7 !text-xs font-bold ${getStatusBadge(
                              d.statut
                            )}`}
                          >
                            <option value="NON PAYE">NON PAYÉ</option>
                            <option value="PAYE">PAYÉ</option>
                            <option value="PAS DE CAISSE">PAS DE CAISSE</option>
                          </select>
                        </td>
                        <td className="text-center">
                          {d.caissesDues > 0 ? (
                            <span className="badge-solid-rose font-bold">{d.caissesDues} Caisse</span>
                          ) : (
                            <span className="text-slate-300">0</span>
                          )}
                        </td>
                        <td className="text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(d.dateDerniere)}
                        </td>
                        <td>
                          <span
                            className={`text-xs font-semibold ${
                              isNonPaye ? 'text-rose-700 font-bold' : 'text-slate-600'
                            }`}
                          >
                            {d.reclamation}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/caisse?tr=${d.tr}`}
                              className="btn-primary !px-2.5 !py-1 !text-xs font-bold"
                            >
                              Encaisser
                            </Link>
                            <button
                              onClick={() => {
                                if (confirm(`Supprimer le chauffeur ${d.nom} ?`)) {
                                  deleteDriver(d.id);
                                }
                              }}
                              className="btn-icon"
                              title="Supprimer"
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

      {/* Modal Ajout Chauffeur */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          />
          <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Ajouter un Chauffeur</h3>
              <button onClick={() => setShowAddModal(false)} className="btn-icon">
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="label">Nom & Prénom</label>
                <input
                  type="text"
                  required
                  value={newDriverNom}
                  onChange={(e) => setNewDriverNom(e.target.value)}
                  placeholder="Ex: HICHEM BEN SALEM"
                  className="input uppercase text-sm"
                />
              </div>

              <div>
                <label className="label">Code Barres / TR (Unique)</label>
                <input
                  type="text"
                  required
                  value={newDriverTr}
                  onChange={(e) => setNewDriverTr(e.target.value)}
                  placeholder="Ex: 110"
                  className="input num uppercase text-sm"
                />
              </div>

              <div>
                <label className="label">Circuit Initial</label>
                <input
                  type="text"
                  value={newDriverCircuit}
                  onChange={(e) => setNewDriverCircuit(e.target.value)}
                  placeholder="Ex: SFAX 1, DJERBA..."
                  className="input uppercase text-sm"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-ghost !text-xs !py-2"
                >
                  Annuler
                </button>
                <button type="submit" className="btn-primary !text-xs !py-2 font-bold">
                  Créer le Chauffeur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
