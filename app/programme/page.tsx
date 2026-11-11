'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useCaisseStore } from '@/lib/store';
import { getStatusBadge, getUnpaidCaisses, formatDate } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import {
  IconAlert,
  IconBolt,
  IconCalendar,
  IconCheck,
  IconTruck,
  IconUpload,
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
  const importProgramme = useCaisseStore((state) => state.importProgramme);
  const markProgramEntryPaid = useCaisseStore((state) => state.markProgramEntryPaid);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [historySearch, setHistorySearch] = useState('');

  const handleExcelFile = (file: File) => {
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      setImportMsg({ type: 'error', text: 'Format invalide. Utilisez un fichier .xlsx, .xls ou .csv.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const rows: { tr: string; circuit: string }[] = [];
        wb.SheetNames.forEach((sn) => {
          const matrix = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sn], { header: 1, defval: '' });
          let trCol = -1;
          let progCol = -1;
          let start = 0;
          for (let i = 0; i < Math.min(matrix.length, 15); i++) {
            const cells = (matrix[i] || []).map((c) => String(c).trim().toUpperCase());
            const t = cells.findIndex((c) => c === 'TR' || c.includes('CODE') || c === 'N° TR' || c === 'NUMERO TR');
            const p = cells.findIndex((c) => c.includes('CIRCUIT') || c.includes('PROGRAMME') || c.includes('PROG'));
            if (t !== -1 && p !== -1) {
              trCol = t;
              progCol = p;
              start = i + 1;
              break;
            }
          }
          if (trCol === -1) {
            trCol = 0;
            progCol = 1;
          }
          for (let i = start; i < matrix.length; i++) {
            const tr = String(matrix[i]?.[trCol] ?? '').trim();
            const circuit = String(matrix[i]?.[progCol] ?? '').trim();
            if (tr && circuit && /^[A-Za-z]*\d+$/.test(tr)) rows.push({ tr, circuit });
          }
        });
        if (rows.length === 0) {
          setImportMsg({
            type: 'error',
            text: 'Aucune ligne valide trouvée. Le fichier doit contenir une colonne "TR" et une colonne "Circuit / Programme".',
          });
          return;
        }
        const { matched, unmatched } = importProgramme(rows);
        setImportMsg({
          type: matched > 0 ? 'success' : 'error',
          text: `${matched} chauffeur(s) mis à jour avec le programme du jour sur ${rows.length} ligne(s) du fichier.${
            unmatched.length ? ` TR introuvables : ${unmatched.slice(0, 15).join(', ')}${unmatched.length > 15 ? '…' : ''}` : ''
          }`,
        });
      } catch (err) {
        setImportMsg({ type: 'error', text: 'Erreur de lecture du fichier : ' + (err as Error).message });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const driversWithHistory = drivers.filter(
    (d) => (d.programmeHistorique?.length || 0) > 0 || getUnpaidCaisses(d).length > 0
  );
  const historyFiltered = driversWithHistory.filter((d) => {
    const q = historySearch.trim().toLowerCase();
    return !q || d.nom.toLowerCase().includes(q) || d.tr.toLowerCase().includes(q);
  });
  const totalUnpaidCaisses = driversWithHistory.reduce((s, d) => s + getUnpaidCaisses(d).length, 0);

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

      {/* Import Excel du programme du jour */}
      <div className="card mb-5 p-4 sm:p-5 border-indigo-200 bg-indigo-50/40">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-indigo-900">Importer le programme du jour (Excel)</h3>
            <p className="mt-1 text-xs text-indigo-800/80 leading-relaxed">
              Colonnes attendues : <strong>TR</strong> et <strong>Circuit / Programme</strong>. À chaque import
              (à partir de 12:30), l&apos;ancien programme de chaque chauffeur est archivé dans l&apos;historique
              ci-dessous avec son état (payé / non payé).
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.xlsm,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleExcelFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary w-full sm:w-auto !py-2.5 text-xs sm:text-sm font-bold"
            >
              <IconUpload className="h-4 w-4" />
              Importer un fichier Excel
            </button>
          </div>
        </div>
        {importMsg && (
          <div
            className={`mt-3 rounded-xl border px-3 py-2 text-xs font-semibold ${
              importMsg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {importMsg.text}
          </div>
        )}
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

        {filteredDrivers.length === 0 ? (
          <EmptyState
            icon={<IconCalendar className="h-6 w-6 text-sky-500" />}
            title="Aucun chauffeur à programmer"
            description="Cette caisse ne comporte pas de chauffeur pour ce circuit. Ajoutez des chauffeurs pour commencer l'affectation."
          >
            <Link href="/chauffeurs" className="btn-primary !px-3 !py-1.5 !text-xs font-bold mt-2">
              Aller aux Chauffeurs
            </Link>
          </EmptyState>
        ) : (
          <>
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
                    <th className="w-48">Nom Chauffeur</th>
                    <th className="w-36">Statut Actuel</th>
                    <th className="w-24 !text-center">Dette</th>
                    <th>Circuit Attribué (Programme du jour)</th>
                    <th className="w-32 !text-right">Statut Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <span className="num font-bold text-slate-900">{d.tr}</span>
                      </td>
                      <td>
                        <div className="font-semibold text-slate-900 truncate max-w-[200px]" title={d.nom}>
                          {d.nom}
                        </div>
                      </td>
                      <td>
                        <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                      </td>
                      <td className="text-center">
                        {d.caissesDues > 0 ? (
                          <span className="badge-solid-rose font-bold">Dû (1)</span>
                        ) : (
                          <span className="text-slate-300 font-medium">0</span>
                        )}
                      </td>
                      <td>
                        <select
                          value={d.programmeJour || d.circuitActuel || 'STAND-BY'}
                          onChange={(e) => assignCircuit(d.id, e.target.value)}
                          className="select !w-full max-w-xs !py-1 !pl-3 !pr-8 !text-xs font-semibold text-slate-800"
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
          </>
        )}
      </div>

      {/* Historique des anciens programmes + caisses non payées */}
      <div className="card mt-5 overflow-hidden">
        <div className="card-header bg-slate-50/70 flex-wrap gap-2">
          <h2 className="card-title text-sm flex items-center gap-2">
            <IconAlert className="h-4 w-4 text-rose-500" />
            Historique des Programmes ({driversWithHistory.length} chauffeurs)
          </h2>
          <div className="flex items-center gap-2">
            <span className={totalUnpaidCaisses > 0 ? 'badge-solid-rose text-[11px]' : 'badge-slate text-[11px]'}>
              {totalUnpaidCaisses} caisse(s) non payée(s)
            </span>
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Chercher TR / nom..."
              className="input !min-h-9 !py-1 !text-xs w-44"
            />
          </div>
        </div>

        {historyFiltered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Aucun historique. Importez un fichier Excel pour commencer le suivi des programmes.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {historyFiltered.map((d) => {
              const unpaid = getUnpaidCaisses(d);
              return (
                <div key={d.id} className="p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="badge-indigo font-mono text-xs">TR {d.tr}</span>
                      <p className="text-sm font-bold text-slate-900 truncate">{d.nom}</p>
                      <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                    </div>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        unpaid.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {unpaid.length > 0 ? `${unpaid.length} caisse(s) non payée(s)` : 'Tout est payé'}
                    </span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {d.programmeJour && d.programmeJour !== 'STAND-BY' && (
                      <div className="rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs">
                        <span className="font-bold text-sky-800">Aujourd&apos;hui : {d.programmeJour}</span>
                        <span className="ml-1.5 text-sky-700/80">
                          {d.statut === 'PAYE' ? '✓ payé' : 'à payer'}
                        </span>
                      </div>
                    )}
                    {(d.programmeHistorique || []).map((e) => (
                      <div
                        key={e.id}
                        className={`flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs ${
                          e.paid
                            ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                        }`}
                      >
                        <span className="font-semibold">{e.circuit}</span>
                        <span className="opacity-70">{formatDate(e.date)}</span>
                        <span className="font-bold">{e.paid ? '✓ Payé' : '✗ Non payé'}</span>
                        {!e.paid && (
                          <button
                            type="button"
                            onClick={() => markProgramEntryPaid(d.id, e.id)}
                            className="rounded-lg bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-emerald-500"
                          >
                            Marquer payé
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
