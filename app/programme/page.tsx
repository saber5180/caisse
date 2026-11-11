'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { useCaisseStore } from '@/lib/store';
import {
  calculateRetardFrom1230,
  formatDate,
  getStatusBadge,
  getUnpaidCaisses,
  ProgrammeImportError,
} from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import {
  IconAlert,
  IconBolt,
  IconCalendar,
  IconCheck,
  IconClose,
  IconSearch,
  IconSync,
  IconTruck,
  IconUpload,
} from '@/components/Icons';

const BASE_CIRCUITS = [
  'SFAX 1',
  'SFAX 2',
  'SFAX 3',
  'SFAX 4',
  'SFAX 5',
  'SFAX 6',
  'SAFX 6',
  'SFAX 7',
  'SFAX 8',
  'SURGELE SUD 1',
  'SURGELE SUD 2',
  'SURGELE SUD 3',
  'SURGELE SUD 4',
  'SURGELE SUD 5',
  'DJERBA 1',
  'DJERBA 2',
  'GABES 1',
  'GABES 2',
  'KEBELLI',
  'ZARZIS',
  'MEDNINE',
  'KAIROUAN 1',
  'KAIROUAN 2',
  'KAIROUAN 3',
  'KASSRINE 1',
  'KASSRINE 2',
  'KASSRINE 3',
  'KASSRINE 4',
  'SIDI BOUZID 1',
  'SIDI BOUZID 3',
  'GAFSA 1',
  'GAFSA 2',
  'GAFSA 3',
  'SAHEL 1',
  'SAHEL 2',
  'SAHEL 3',
  'SAHEL 4',
  'SAHEL 5',
  'SAHEL 6',
  'SAHEL 7',
  'SAHEL 8',
  'SAHEL 10',
  'SAHEL 11',
  'SAHEL 12',
  'SAHEL 13',
  'NORD WEST 1',
  'NORD WEST 2',
  'NORD WEST 4',
  'NORD WEST 5',
  'NORD WEST 6',
  'SURGELE NORD WEST 1',
  'SURGELE NORD WEST 2',
  'SURGELE NORD WEST 4',
  'SURGELE BIZERTE 1',
  'SURGELE BIZERTE 2',
  'SURGELE NABEUL 1',
  'BIZERT 1',
  'BIZERT 2',
  'BIZERT 3',
  'TUNIS 1',
  'TUNIS 2',
  'TUNIS 3',
  'TUNIS 4',
  'TUNIS 5',
  'TUNIS 6',
  'TUNIS 7',
  'TUNIS 8',
  'TUNIS 9',
  'TUNIS 10',
  'TUNIS 11',
  'NABEUL',
  'NABEUL 1',
  'NABEUL 2',
  'NABEUL 3',
  'STAND-BY',
];

/**
 * Extrait les lignes { nom, circuit, tr } depuis un classeur Excel comme celui fourni :
 * Colonnes supportées : "Nom & Prénom du Chauffeur" | "PROGRAMME DE CHAUFFEUR" | "Code TR"
 */
function parseProgrammeWorkbook(wb: XLSX.WorkBook): {
  nom: string;
  circuit: string;
  tr: string;
}[] {
  const rows: { nom: string; circuit: string; tr: string }[] = [];

  wb.SheetNames.forEach((sheetName) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;
    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
    if (matrix.length === 0) return;

    let nomCol = -1;
    let progCol = -1;
    let trCol = -1;
    let startRow = 0;

    // Détection automatique de la ligne d'en-tête (ex: Col B = Nom & Prénom, Col C = PROGRAMME DE CHAUFFEUR, Col D = Code TR)
    for (let r = 0; r < Math.min(matrix.length, 15); r++) {
      const rowCells = (matrix[r] || []).map((c) =>
        String(c ?? '')
          .replace(/\u00A0/g, ' ')
          .trim()
          .toUpperCase()
      );

      let foundNom = -1;
      let foundProg = -1;
      let foundTr = -1;

      rowCells.forEach((cell, idx) => {
        if (!cell) return;
        if (
          foundProg === -1 &&
          (cell.includes('PROGRAMME') || cell.includes('CIRCUIT') || cell.includes('TOURN'))
        ) {
          foundProg = idx;
        } else if (
          foundTr === -1 &&
          (cell === 'TR' ||
            cell.includes('CODE TR') ||
            cell.includes('CODE') ||
            cell.includes('N° TR') ||
            cell.includes('MATRICULE'))
        ) {
          foundTr = idx;
        } else if (
          foundNom === -1 &&
          (cell.includes('NOM') || cell.includes('PRÉNOM') || cell.includes('PRENOM') || cell.includes('CHAUFFEUR'))
        ) {
          foundNom = idx;
        }
      });

      if (foundProg !== -1 && (foundNom !== -1 || foundTr !== -1)) {
        nomCol = foundNom;
        progCol = foundProg;
        trCol = foundTr;
        startRow = r + 1;
        break;
      }
    }

    // Si aucun en-tête explicite n'est trouvé, détecter selon la disposition standard (Col B=1, Col C=2, Col D=3 ou Col A=0, Col B=1, Col C=2)
    if (progCol === -1) {
      const sample = matrix.find((row) => (row || []).filter((c) => String(c).trim() !== '').length >= 2);
      if (sample) {
        const firstNonEmpty = sample.findIndex((c) => String(c).trim() !== '');
        if (firstNonEmpty >= 0) {
          nomCol = firstNonEmpty;
          progCol = firstNonEmpty + 1;
          trCol = firstNonEmpty + 2;
        }
      }
    }

    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r] || [];
      const rawNom = nomCol !== -1 ? String(row[nomCol] ?? '') : '';
      const rawProg = progCol !== -1 ? String(row[progCol] ?? '') : '';
      const rawTr = trCol !== -1 ? String(row[trCol] ?? '') : '';

      const nom = rawNom.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
      const circuit = rawProg.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
      const tr = rawTr.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();

      // Ignorer les lignes totalement vides ou qui répètent l'en-tête
      if (!nom && !circuit && !tr) continue;
      if (
        nom.toUpperCase().includes('NOM & PR') ||
        circuit.toUpperCase() === 'PROGRAMME DE CHAUFFEUR' ||
        tr.toUpperCase() === 'CODE TR'
      ) {
        continue;
      }

      if (nom || tr) {
        rows.push({
          nom,
          circuit: circuit || 'STAND-BY',
          tr,
        });
      }
    }
  });

  return rows;
}

export default function ProgrammePage() {
  const drivers = useCaisseStore((state) => state.drivers);
  const assignCircuit = useCaisseStore((state) => state.assignCircuit);
  const executeBascule1230 = useCaisseStore((state) => state.executeBascule1230);
  const importProgramme = useCaisseStore((state) => state.importProgramme);
  const loadDefaultProgrammeExcel = useCaisseStore((state) => state.loadDefaultProgrammeExcel);
  const markProgramEntryPaid = useCaisseStore((state) => state.markProgramEntryPaid);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterCircuit, setFilterCircuit] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'UNPAID' | 'ALL'>('UNPAID');
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [importErrors, setImportErrors] = useState<ProgrammeImportError[]>([]);

  // Construire dynamiquement la liste de TOUS les programmes (ceux de base + ceux créés via Excel)
  const allCircuits = useMemo(() => {
    const set = new Set<string>(BASE_CIRCUITS);
    drivers.forEach((d) => {
      const c = (d.programmeJour || d.circuitActuel || '').trim().toUpperCase();
      if (c) set.add(c);
      (d.programmeHistorique || []).forEach((h) => {
        if (h.circuit) set.add(h.circuit.trim().toUpperCase());
      });
    });
    const arr = Array.from(set).filter((c) => c !== 'STAND-BY').sort();
    return [...arr, 'STAND-BY'];
  }, [drivers]);

  // Compteurs du programme du jour
  const activeProgrammeDrivers = useMemo(
    () =>
      drivers.filter((d) => {
        const p = (d.programmeJour || '').trim().toUpperCase();
        return p && p !== 'STAND-BY';
      }),
    [drivers]
  );

  const standbyDrivers = useMemo(
    () =>
      drivers.filter((d) => {
        const p = (d.programmeJour || '').trim().toUpperCase();
        return !p || p === 'STAND-BY';
      }),
    [drivers]
  );

  // Filtrage de la liste du Programme du Jour
  const filteredDrivers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drivers.filter((d) => {
      const prog = (d.programmeJour || d.circuitActuel || 'STAND-BY').trim().toUpperCase();
      const matchCircuit = !filterCircuit
        ? true
        : filterCircuit === '__ACTIVE__'
        ? prog !== 'STAND-BY'
        : prog === filterCircuit;
      const matchSearch = !q
        ? true
        : d.nom.toLowerCase().includes(q) ||
          d.tr.toLowerCase().includes(q) ||
          prog.toLowerCase().includes(q);
      return matchCircuit && matchSearch;
    });
  }, [drivers, filterCircuit, searchQuery]);

  // Liste aplatie de l'historique des anciens programmes et des caisses non payées
  const historyRows = useMemo(() => {
    const list: {
      key: string;
      driverId: string;
      entryId: string;
      tr: string;
      nom: string;
      circuit: string;
      date: string;
      paid: boolean;
      isCurrent: boolean;
      retardText: string;
      isOverdue: boolean;
    }[] = [];

    drivers.forEach((d) => {
      // 1. Anciens programmes dans programmeHistorique
      (d.programmeHistorique || []).forEach((h) => {
        const retard = calculateRetardFrom1230(h.date);
        list.push({
          key: `${d.id}-${h.id}`,
          driverId: d.id,
          entryId: h.id,
          tr: d.tr,
          nom: d.nom,
          circuit: h.circuit || 'ANCIENNE CAISSE',
          date: h.date,
          paid: h.paid,
          isCurrent: false,
          retardText: h.paid ? 'Réglé' : retard.isOverdue ? `Retard : ${retard.text}` : retard.text,
          isOverdue: !h.paid && retard.isOverdue,
        });
      });

      // 2. Si le programme actuel est déjà en retard (après 12:30 demain) ou non payé
      const prog = (d.programmeJour || 'STAND-BY').trim().toUpperCase();
      if (d.statut === 'NON PAYE' && prog !== 'STAND-BY') {
        const refDate = d.programmeDate || d.dateDerniere;
        const retard = calculateRetardFrom1230(refDate);
        list.push({
          key: `${d.id}-CURRENT`,
          driverId: d.id,
          entryId: 'CURRENT',
          tr: d.tr,
          nom: d.nom,
          circuit: prog,
          date: refDate,
          paid: false,
          isCurrent: true,
          retardText: retard.isOverdue
            ? `Retard : ${retard.text}`
            : `Programme du jour (${retard.text})`,
          isOverdue: retard.isOverdue,
        });
      }
    });

    return list.filter((item) => {
      if (historyFilter === 'UNPAID' && item.paid) return false;
      const q = historySearch.trim().toLowerCase();
      if (!q) return true;
      return (
        item.nom.toLowerCase().includes(q) ||
        item.tr.toLowerCase().includes(q) ||
        item.circuit.toLowerCase().includes(q)
      );
    });
  }, [drivers, historyFilter, historySearch]);

  const totalUnpaidHistoryCount = useMemo(
    () =>
      drivers.reduce((sum, d) => sum + getUnpaidCaisses(d).length, 0),
    [drivers]
  );

  const handleExcelFile = (file: File) => {
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      setImportMsg({
        type: 'error',
        text: 'Format invalide. Veuillez sélectionner un fichier Excel (.xlsx, .xls, .xlsm) ou .csv.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const parsedRows = parseProgrammeWorkbook(wb);

        if (parsedRows.length === 0) {
          setImportMsg({
            type: 'error',
            text: 'Aucune ligne trouvée. Vérifiez que le fichier contient les colonnes "Nom & Prénom du Chauffeur", "PROGRAMME DE CHAUFFEUR" et "Code TR".',
          });
          return;
        }

        const { updatedCount, createdCount, totalProgrammes, errors } = importProgramme(parsedRows);
        setImportErrors(errors);
        if (errors.length > 0) {
          setImportMsg({
            type: 'error',
            text: `Attention : ${errors.length} erreur(s) détectée(s) et bloquée(s) dans le fichier Excel (Code TR en double ou conflit de nom sur un Code TR existant). Les ${updatedCount + createdCount} autres lignes valides ont été appliquées.`,
          });
        } else {
          setImportMsg({
            type: 'success',
            text: `Fichier Excel importé avec succès (${parsedRows.length} lignes lues) : ${updatedCount} chauffeur(s) mis à jour, ${createdCount} nouveau(x) chauffeur(s) ajouté(s), et ${totalProgrammes} programmes actifs créés ! Le retard sera calculé après 12:30 demain.`,
          });
        }
      } catch (err) {
        setImportMsg({
          type: 'error',
          text: 'Erreur lors de la lecture du fichier Excel : ' + (err as Error).message,
        });
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleBascule = () => {
    if (
      confirm(
        '⚠️ Confirmation de la BASCULE DE 12:30 :\n\n- Toutes les tournées en cours non payées passeront en retard / dette formelle (Statut "NON PAYÉ").\n- Les chauffeurs payés seront libérés en "PAS DE CAISSE".\n\nVoulez-vous continuer ?'
      )
    ) {
      executeBascule1230();
    }
  };

  return (
    <>
      <PageHeader
        title="Programme de Chauffeur & Suivi des Retards (12:30)"
        subtitle="Import Excel du programme du jour, création automatique des programmes & nouveaux chauffeurs, et historique des caisses non payées"
        badge={`${drivers.length} Chauffeurs · ${activeProgrammeDrivers.length} Tournées actives`}
        icon={<IconCalendar className="h-5 w-5" />}
        accent="sky"
        actions={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
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
              className="btn-primary flex-1 sm:flex-none min-h-11 px-4 text-xs sm:text-sm font-bold shadow-md"
            >
              <IconUpload className="h-4 w-4 shrink-0" />
              <span>Importer Excel Programme</span>
            </button>
            <button
              type="button"
              onClick={handleBascule}
              className="btn-amber flex-1 sm:flex-none min-h-11 px-4 text-xs sm:text-sm font-bold shadow-md"
              title="Exécuter la bascule de 12:30"
            >
              <IconBolt className="h-4 w-4 shrink-0" />
              <span>Bascule 12:30</span>
            </button>
          </div>
        }
      />

      {/* Bandeau d'Import Excel & Règle de Calcul du Retard après 12:30 Demain */}
      <div className="card-dark bg-grid-pattern relative mb-5 overflow-hidden p-5 sm:p-6">
        <div className="relative z-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/30 bg-indigo-500/20 px-3 py-0.5 text-[11px] font-bold text-indigo-200">
                IMPORT AUTOMATIQUE EXCEL (.XLSX)
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/20 px-3 py-0.5 text-[11px] font-bold text-amber-300">
                ÉCHÉANCE RETARD : DEMAIN 12:30
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
              Colonnes reconnues : <span className="text-indigo-300">Nom &amp; Prénom du Chauffeur</span> ·{' '}
              <span className="text-sky-300">PROGRAMME DE CHAUFFEUR</span> ·{' '}
              <span className="text-emerald-300">Code TR</span>
            </h3>
            <p className="text-xs text-slate-300/90 max-w-3xl leading-relaxed">
              Vérification automatique des doublons de Code TR et conflits de noms avant import. Création automatique des nouveaux chauffeurs et programmes, archivage des impayés en bas de page et calcul du retard après 12:30 demain.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary !py-2.5 !px-4 text-xs sm:text-sm font-bold shadow-lg"
            >
              <IconUpload className="h-4 w-4" />
              Choisir un fichier Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => {
                loadDefaultProgrammeExcel();
                setImportErrors([]);
                setImportMsg({
                  type: 'success',
                  text: 'Les 87 lignes du fichier Programme de Chauffeur ont été chargées avec création des nouveaux chauffeurs et des programmes !',
                });
              }}
              className="btn border border-white/15 bg-white/10 hover:bg-white/15 text-white !py-2.5 !px-3.5 text-xs font-bold backdrop-blur-sm"
            >
              <IconSync className="h-4 w-4" />
              Charger Programme Complet (87 lignes)
            </button>
          </div>
        </div>

        {importMsg && (
          <div
            className={`relative z-10 mt-4 flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-bold ${
              importMsg.type === 'success'
                ? 'border-emerald-400/40 bg-emerald-950/90 text-emerald-200'
                : 'border-rose-400/50 bg-rose-950/90 text-rose-200'
            }`}
          >
            <span>{importMsg.text}</span>
            <button
              type="button"
              onClick={() => setImportMsg(null)}
              className="ml-2 text-slate-300 hover:text-white"
            >
              <IconClose className="h-4 w-4" />
            </button>
          </div>
        )}

        {importErrors.length > 0 && (
          <div className="relative z-10 mt-4 rounded-2xl border-2 border-rose-400 bg-rose-950/95 p-4 text-rose-100 shadow-lg">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <div className="flex items-center gap-2">
                <IconAlert className="h-5 w-5 text-rose-400 shrink-0" />
                <h4 className="text-xs sm:text-sm font-black uppercase tracking-wider text-rose-200">
                  Erreurs détectées lors de la vérification du fichier Excel ({importErrors.length} ligne{importErrors.length > 1 ? 's' : ''} bloquée{importErrors.length > 1 ? 's' : ''})
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setImportErrors([])}
                className="text-xs font-bold text-rose-300 hover:text-white"
              >
                Fermer
              </button>
            </div>
            <ul className="space-y-1.5 text-xs font-semibold">
              {importErrors.map((err, idx) => (
                <li
                  key={idx}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/10 border border-rose-400/30 px-3 py-2 text-white"
                >
                  <span>{err.message}</span>
                  <span className="badge-solid-rose font-mono text-[10px] shrink-0">
                    {err.type === 'DUPLICATE_TR_IN_FILE'
                      ? `TR ${err.tr} EN DOUBLE`
                      : `CONFLIT NOM TR ${err.tr}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* KPI Résumé du Programme du Jour */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setFilterCircuit('')}
          className={`card p-4 text-left transition-all hover:shadow-md ${
            filterCircuit === '' ? 'ring-2 ring-indigo-600 bg-indigo-50/30' : ''
          }`}
        >
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
            Total Liste Programme
          </span>
          <p className="mt-1 font-mono text-2xl font-black text-slate-900">{drivers.length}</p>
          <p className="mt-0.5 text-[11px] text-slate-400">Chauffeurs &amp; lignes du jour</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterCircuit('__ACTIVE__')}
          className={`card p-4 text-left transition-all hover:shadow-md ${
            filterCircuit === '__ACTIVE__' ? 'ring-2 ring-sky-600 bg-sky-50/40' : ''
          }`}
        >
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-700">
            En Tournée Aujourd&apos;hui
          </span>
          <p className="mt-1 font-mono text-2xl font-black text-sky-700">
            {activeProgrammeDrivers.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Échéance demain 12:30</p>
        </button>

        <button
          type="button"
          onClick={() => setFilterCircuit('STAND-BY')}
          className={`card p-4 text-left transition-all hover:shadow-md ${
            filterCircuit === 'STAND-BY' ? 'ring-2 ring-amber-500 bg-amber-50/40' : ''
          }`}
        >
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700">
            En Stand-By
          </span>
          <p className="mt-1 font-mono text-2xl font-black text-amber-700">
            {standbyDrivers.length}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Sans tournée du jour</p>
        </button>

        <div className="card p-4 text-left border-rose-200 bg-rose-50/40">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-rose-700">
            Caisses Non Payées (Total)
          </span>
          <p className="mt-1 font-mono text-2xl font-black text-rose-600">
            {totalUnpaidHistoryCount}
          </p>
          <p className="mt-0.5 text-[11px] text-rose-700/80">Jour + Historique cumulé</p>
        </div>
      </div>

      {/* =====================================================================
          SECTION 1 : LISTE COMPLÈTE DU PROGRAMME DU JOUR (AVEC RETARDS APRÈS 12:30 DEMAIN)
      ===================================================================== */}
      <div className="card overflow-hidden">
        <div className="card-header flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border-b border-slate-100">
          <div>
            <h2 className="card-title text-sm sm:text-base font-extrabold text-slate-900">
              1. Liste du Programme du Jour ({filteredDrivers.length} sur {drivers.length} chauffeurs)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tous les programmes et chauffeurs importés du fichier Excel · Retard calculé automatiquement après 12:30 demain
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <select
              value={filterCircuit}
              onChange={(e) => setFilterCircuit(e.target.value)}
              className="select !min-h-10 !py-1.5 !text-xs font-bold sm:w-52 bg-slate-50/80"
            >
              <option value="">Tous les programmes ({drivers.length})</option>
              <option value="__ACTIVE__">Tournées actives ({activeProgrammeDrivers.length})</option>
              <option value="STAND-BY">STAND-BY ({standbyDrivers.length})</option>
              {allCircuits
                .filter((c) => c !== 'STAND-BY')
                .map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
            </select>

            <div className="relative flex-1 sm:w-64">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Chercher nom, TR, programme..."
                className="input !min-h-10 !py-1.5 !pl-9 !pr-8 !text-xs font-semibold bg-slate-50/80"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  <IconClose className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {filteredDrivers.length === 0 ? (
          <EmptyState
            icon={<IconCalendar className="h-6 w-6 text-sky-500" />}
            title="Aucun chauffeur trouvé pour ce filtre"
            description="Importez votre fichier Excel ou modifiez le filtre de recherche."
          />
        ) : (
          <>
            {/* Responsive Cards View for Mobile & Tablet / Compact Screens (xl:hidden) */}
            <div className="grid grid-cols-1 gap-3 p-3.5 sm:p-4 md:grid-cols-2 max-h-[600px] overflow-y-auto xl:hidden bg-slate-50/40">
              {filteredDrivers.map((d) => {
                const prog = (d.programmeJour || d.circuitActuel || 'STAND-BY').trim() || 'STAND-BY';
                const isStandby = prog.toUpperCase() === 'STAND-BY';
                const retardInfo = calculateRetardFrom1230(d.programmeDate || d.dateDerniere);
                const unpaidList = getUnpaidCaisses(d, drivers);

                return (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm hover:border-indigo-300 transition-all flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-black text-white">
                            TR {d.tr}
                          </span>
                          <p className="truncate text-sm font-extrabold text-slate-900" title={d.nom}>
                            {d.nom}
                          </p>
                        </div>
                        <span className={`${getStatusBadge(d.statut)} shrink-0`}>{d.statut}</span>
                      </div>

                      <div className="space-y-2 rounded-xl bg-slate-50/90 border border-slate-100 p-2.5">
                        <div>
                          <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
                            Programme de Chauffeur (Jour)
                          </label>
                          <select
                            value={prog}
                            onChange={(e) => assignCircuit(d.id, e.target.value)}
                            className={`select !min-h-9 !w-full !py-1 !pl-3 !pr-8 !text-xs font-extrabold ${
                              isStandby
                                ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                                : 'border-sky-300 bg-sky-50/80 text-sky-950'
                            }`}
                          >
                            <option value="STAND-BY">STAND-BY</option>
                            {allCircuits
                              .filter((c) => c !== 'STAND-BY')
                              .map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                          <div>
                            {isStandby ? (
                              <span className="text-xs font-medium text-slate-400">Stand-by aujourd&apos;hui</span>
                            ) : d.statut === 'PAYE' ? (
                              <span className="text-xs font-bold text-emerald-600">✓ Caisse réglée</span>
                            ) : retardInfo.isOverdue ? (
                              <span className="text-xs font-extrabold text-rose-600">
                                ⚠️ Retard : {retardInfo.text}
                              </span>
                            ) : (
                              <span className="text-xs font-bold text-sky-700">
                                🕒 {retardInfo.text}
                              </span>
                            )}
                          </div>

                          <div>
                            {unpaidList.length > 0 ? (
                              <span className="badge-solid-rose font-bold text-[10px]">
                                {unpaidList.length} non payée{unpaidList.length > 1 ? 's' : ''}
                              </span>
                            ) : (
                              <span className="badge-emerald font-bold text-[10px]">0 impayé</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end border-t border-slate-100 pt-2">
                      <Link
                        href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                        className="btn-primary !px-3 !py-1.5 !text-xs font-bold"
                      >
                        Ouvrir au Guichet →
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Pro Table View (hidden xl:block) */}
            <div className="table-wrap hidden max-h-[600px] overflow-y-auto xl:block">
              <table className="data-table">
                <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-[0_1px_0_rgba(226,232,240,1)]">
                  <tr>
                    <th className="w-24">Code TR</th>
                    <th className="min-w-[180px]">Nom &amp; Prénom du Chauffeur</th>
                    <th className="w-60">Programme de Chauffeur (Jour)</th>
                    <th className="w-56">Échéance 12:30 Demain / Retard</th>
                    <th className="w-36 !text-center">Caisses Impayées</th>
                    <th className="w-32">Statut</th>
                    <th className="w-28 !text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrivers.map((d) => {
                    const prog = (d.programmeJour || d.circuitActuel || 'STAND-BY').trim() || 'STAND-BY';
                    const isStandby = prog.toUpperCase() === 'STAND-BY';
                    const retardInfo = calculateRetardFrom1230(d.programmeDate || d.dateDerniere);
                    const unpaidList = getUnpaidCaisses(d, drivers);

                    return (
                      <tr key={d.id} className="hover:bg-indigo-50/35 transition-colors">
                        <td className="!py-3">
                          <span className="inline-flex rounded-lg bg-slate-900 px-2.5 py-1 font-mono text-xs font-extrabold text-white shadow-sm">
                            TR {d.tr}
                          </span>
                        </td>
                        <td className="!py-3">
                          <p className="font-extrabold text-slate-900 text-xs sm:text-[13px] truncate max-w-[230px]" title={d.nom}>
                            {d.nom}
                          </p>
                        </td>
                        <td className="!py-3">
                          <select
                            value={prog}
                            onChange={(e) => assignCircuit(d.id, e.target.value)}
                            className={`select !min-h-9 !w-full !py-1 !pl-3 !pr-8 !text-xs font-extrabold ${
                              isStandby
                                ? 'border-amber-200 bg-amber-50/70 text-amber-900'
                                : 'border-sky-300 bg-sky-50/80 text-sky-950'
                            }`}
                          >
                            <option value="STAND-BY">STAND-BY</option>
                            {allCircuits
                              .filter((c) => c !== 'STAND-BY')
                              .map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                          </select>
                        </td>
                        <td className="!py-3">
                          {isStandby ? (
                            <span className="text-xs font-medium text-slate-400">
                              Stand-by aujourd&apos;hui
                            </span>
                          ) : d.statut === 'PAYE' ? (
                            <span className="text-xs font-bold text-emerald-600">
                              ✓ Caisse du jour réglée
                            </span>
                          ) : retardInfo.isOverdue ? (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-rose-100 border border-rose-200 px-2.5 py-1 text-[11px] font-extrabold text-rose-700">
                              ⚠️ Retard : {retardInfo.text}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1 text-[11px] font-bold text-sky-800">
                              🕒 {retardInfo.text}
                            </span>
                          )}
                        </td>
                        <td className="!py-3 text-center">
                          {unpaidList.length > 0 ? (
                            <span className="badge-solid-rose font-bold text-[11px]">
                              {unpaidList.length} non payée{unpaidList.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="badge-emerald font-bold text-[11px]">0 impayé</span>
                          )}
                        </td>
                        <td className="!py-3">
                          <span className={getStatusBadge(d.statut)}>{d.statut}</span>
                        </td>
                        <td className="!py-3 text-right">
                          <Link
                            href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                            className="btn-primary !px-2.5 !py-1 !text-xs font-bold"
                          >
                            Guichet →
                          </Link>
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

      {/* =====================================================================
          SECTION 2 (BAS) : HISTORIQUE DES ANCIENS PROGRAMMES & CAISSES NON PAYÉES
      ===================================================================== */}
      <div className="card mt-6 overflow-hidden border-rose-200/80">
        <div className="card-header flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-rose-50/50 border-b border-rose-100">
          <div>
            <h2 className="card-title text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <IconAlert className="h-5 w-5 text-rose-600 shrink-0" />
              <span>2. Historique des Programmes &amp; Caisses Non Payées ({historyRows.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Anciens programmes regroupés par Code TR avec les caisses non payées et calcul du retard après 12:30
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex rounded-xl bg-white p-1 border border-slate-200">
              <button
                type="button"
                onClick={() => setHistoryFilter('UNPAID')}
                className={`flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  historyFilter === 'UNPAID'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Impayées uniquement
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('ALL')}
                className={`flex-1 sm:flex-none rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                  historyFilter === 'ALL'
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tout l&apos;historique
              </button>
            </div>

            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Filtrer historique (TR, nom, circuit)..."
              className="input !min-h-9 !py-1.5 !text-xs sm:w-56 bg-white"
            />
          </div>
        </div>

        {historyRows.length === 0 ? (
          <div className="py-10 text-center text-xs text-slate-400">
            Aucune caisse non payée dans l&apos;historique pour ce filtre.
          </div>
        ) : (
          <>
            {/* Mobile / Tablet Cards for History (lg:hidden) */}
            <div className="grid grid-cols-1 gap-3 p-3.5 sm:p-4 md:grid-cols-2 max-h-[520px] overflow-y-auto lg:hidden bg-rose-50/10">
              {historyRows.map((row) => (
                <div
                  key={row.key}
                  className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col justify-between gap-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 rounded-lg bg-slate-900 px-2 py-0.5 font-mono text-xs font-black text-white">
                        TR {row.tr}
                      </span>
                      <p className="truncate text-xs sm:text-sm font-extrabold text-slate-900">{row.nom}</p>
                    </div>
                    {row.paid ? (
                      <span className="badge-solid-emerald text-[10px]">PAYÉ</span>
                    ) : (
                      <span className="badge-solid-rose text-[10px]">NON PAYÉ</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="badge-indigo font-bold text-[11px]">{row.circuit}</span>
                      {row.isCurrent && (
                        <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                          Jour
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 font-medium">{formatDate(row.date)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <span
                      className={`text-xs font-bold ${
                        row.paid
                          ? 'text-emerald-600'
                          : row.isOverdue
                          ? 'text-rose-600'
                          : 'text-sky-700'
                      }`}
                    >
                      {row.retardText}
                    </span>

                    {!row.paid && (
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/caisse?tr=${encodeURIComponent(row.tr)}`}
                          className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-500"
                        >
                          Encaisser
                        </Link>
                        <button
                          type="button"
                          onClick={() => markProgramEntryPaid(row.driverId, row.entryId)}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                        >
                          ✓ Payé
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table for History (hidden lg:block) */}
            <div className="table-wrap hidden max-h-[520px] overflow-y-auto lg:block">
              <table className="data-table">
                <thead className="sticky top-0 z-10 bg-slate-50/95">
                  <tr>
                    <th className="w-24">Code TR</th>
                    <th>Chauffeur</th>
                    <th>Programme / Caisse</th>
                    <th>Date du Programme</th>
                    <th>Retard (Après 12:30 J+1)</th>
                    <th>État</th>
                    <th className="!text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {historyRows.map((row) => (
                    <tr key={row.key} className="hover:bg-slate-50/80">
                      <td className="!py-3">
                        <span className="font-mono text-xs font-black text-white bg-slate-900 px-2.5 py-1 rounded-lg">
                          TR {row.tr}
                        </span>
                      </td>
                      <td className="!py-3 font-extrabold text-slate-900 text-xs sm:text-[13px]">{row.nom}</td>
                      <td className="!py-3">
                        <span className="badge-indigo font-bold text-xs">{row.circuit}</span>
                        {row.isCurrent && (
                          <span className="ml-1.5 text-[10px] font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200">
                            Jour
                          </span>
                        )}
                      </td>
                      <td className="!py-3 text-xs text-slate-600 font-medium">{formatDate(row.date)}</td>
                      <td className="!py-3">
                        <span
                          className={`text-xs font-bold ${
                            row.paid
                              ? 'text-emerald-600'
                              : row.isOverdue
                              ? 'text-rose-600'
                              : 'text-sky-700'
                          }`}
                        >
                          {row.retardText}
                        </span>
                      </td>
                      <td className="!py-3">
                        {row.paid ? (
                          <span className="badge-solid-emerald text-xs">PAYÉ</span>
                        ) : (
                          <span className="badge-solid-rose text-xs">NON PAYÉ</span>
                        )}
                      </td>
                      <td className="!py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!row.paid && (
                            <>
                              <Link
                                href={`/caisse?tr=${encodeURIComponent(row.tr)}`}
                                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-500"
                              >
                                Encaisser
                              </Link>
                              <button
                                type="button"
                                onClick={() => markProgramEntryPaid(row.driverId, row.entryId)}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500"
                              >
                                ✓ Payé
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
