'use client';

import { useState } from 'react';
import { useCaisseStore } from '@/lib/store';
import { getStatusBadge } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import {
  IconBolt,
  IconCalendar,
  IconCheck,
  IconTruck,
} from '@/components/Icons';

const KNOWN_CIRCUITS = [
  'SFAX 1',
  'SFAX 2',
  'SFAX 3',
  'SFAX 4',
  'SFAX 5',
  'SFAX 6',
  'SFAX 7',
  'SFAX 8',
  'SURGELE SFAX 1',
  'SURGELE SFAX 2',
  'SURGELE SFAX 3',
  'SURGELE SFAX 4',
  'DJERBA 1',
  'DJERBA 2',
  'KEBELLI',
  'ZARZIS',
  'MEDNINE',
  'GABES 1',
  'GABES 2',
  'KAIROUAN 1',
  'KAIROUAN 2',
  'TUNIS 6',
  'SAHEL 1',
  'SAHEL 6',
  'SIDI BOUZID 1',
  'STAND-BY',
];

export default function ProgrammePage() {
  const drivers = useCaisseStore((state) => state.drivers);
  const assignCircuit = useCaisseStore((state) => state.assignCircuit);
  const executeBascule1230 = useCaisseStore((state) => state.executeBascule1230);

  const [filterCircuit, setFilterCircuit] = useState('');

  const filteredDrivers = drivers.filter((d) => {
    if (!filterCircuit) return true;
    return (d.programmeJour || d.circuitActuel || 'STAND-BY') === filterCircuit;
  });

  const handleBascule = () => {
    if (
      confirm(
        '⚠️ Confirmation de la BASCULE DE 12:30 :\n\n- Toutes les tournées en cours non payées passeront en dette (caissesDues = 1) et statut "NON PAYÉ".\n- Les chauffeurs payés seront libérés en "PAS DE CAISSE".\n- Les délais d\'alerte seront réinitialisés à l\'heure courante.\n\nVoulez-vous continuer ?'
      )
    ) {
      executeBascule1230();
    }
  };

  return (
    <>
      <PageHeader
        title="Programme des Tournées"
        subtitle="Affectation des circuits journaliers et bascule automatique de mi-journée"
        icon={<IconCalendar className="h-5 w-5" />}
        accent="sky"
        actions={
          <button
            onClick={handleBascule}
            className="btn-amber w-full sm:w-auto min-h-11 shadow-md font-bold px-4 text-xs sm:text-sm"
            title="Équivalent à la macro 'A' en cellule A1"
          >
            <IconBolt className="h-5 w-5 shrink-0" />
            <span>Exécuter Bascule de 12:30</span>
          </button>
        }
      />

      {/* Explication de la Bascule */}
      <div className="card mb-5 p-4 sm:p-5 border-amber-200 bg-amber-50/50">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <IconBolt className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-amber-900">
              Fonctionnement de la Bascule de 12:30 (Macro &quot;A&quot;)
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-amber-800/90">
              Chaque jour à 12h30, la bascule libère les chauffeurs ayant réglé leur caisse en{' '}
              <strong>PAS DE CAISSE</strong> et transforme automatiquement les tournées du matin non encore encaissées en{' '}
              <strong>DETTE FORMELLE (Statut NON PAYÉ)</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Filtre par Circuit */}
      <div className="card mb-5 p-3.5 sm:p-4">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <IconTruck className="h-4 w-4 text-slate-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Filtrer par circuit :
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFilterCircuit('')}
              className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all ${
                filterCircuit === ''
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tous
            </button>
            {KNOWN_CIRCUITS.slice(0, 7).map((c) => (
              <button
                key={c}
                onClick={() => setFilterCircuit(c)}
                className={`rounded-xl px-2 py-1 text-xs font-medium transition-all ${
                  filterCircuit === c
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 ring-1 ring-slate-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tableau d'Affectation des Circuits */}
      <div className="card overflow-hidden">
        <div className="card-header bg-slate-50/70">
          <h2 className="card-title text-sm">
            Affectation des Tournées ({filteredDrivers.length} chauffeurs)
          </h2>
          <span className="badge-slate text-[11px]">Enregistrement direct</span>
        </div>

        {/* Mobile Card View (md:hidden) */}
        <div className="divide-y divide-slate-100 md:hidden">
          {filteredDrivers.map((d) => (
            <div key={d.id} className="p-3.5 hover:bg-slate-50/60 transition-colors">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="badge-indigo font-mono text-xs">TR {d.tr}</span>
                  <p className="text-sm font-bold text-slate-900">{d.nom}</p>
                </div>
                <span className={getStatusBadge(d.statut)}>{d.statut}</span>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                  Circuit Affecté
                </label>
                <select
                  value={d.programmeJour || d.circuitActuel || 'STAND-BY'}
                  onChange={(e) => assignCircuit(d.id, e.target.value)}
                  className="select !h-10 text-xs font-bold text-slate-800 bg-white"
                >
                  <option value="STAND-BY">STAND-BY (Sans circuit)</option>
                  {KNOWN_CIRCUITS.filter((c) => c !== 'STAND-BY').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View (hidden md:block) */}
        <div className="table-wrap hidden md:block">
          <table className="data-table">
            <thead>
              <tr>
                <th className="w-16">TR</th>
                <th>Nom Chauffeur</th>
                <th>Statut Actuel</th>
                <th>Dette</th>
                <th>Circuit Attribué (Programme du jour)</th>
                <th className="!text-right">Statut Sync</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.map((d) => (
                <tr key={d.id}>
                  <td>
                    <span className="num font-bold text-slate-900">{d.tr}</span>
                  </td>
                  <td>
                    <div className="font-semibold text-slate-900">{d.nom}</div>
                  </td>
                  <td>
                    <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                  </td>
                  <td className="text-center">
                    {d.caissesDues > 0 ? (
                      <span className="badge-solid-rose font-bold">Dû (1)</span>
                    ) : (
                      <span className="text-slate-300">0</span>
                    )}
                  </td>
                  <td>
                    <select
                      value={d.programmeJour || d.circuitActuel || 'STAND-BY'}
                      onChange={(e) => assignCircuit(d.id, e.target.value)}
                      className="select !w-56 !py-1 !pl-3 !pr-8 !text-xs font-semibold text-slate-800"
                    >
                      <option value="STAND-BY">STAND-BY (Sans circuit)</option>
                      {KNOWN_CIRCUITS.filter((c) => c !== 'STAND-BY').map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="text-right">
                    <span className="text-xs font-semibold text-emerald-600 flex items-center justify-end gap-1">
                      <IconCheck className="h-3.5 w-3.5" />
                      Synchronisé
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
