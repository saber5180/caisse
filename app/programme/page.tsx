'use client';

import { Fragment, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Driver } from '@/types/caisse';
import { useCaisseStore } from '@/lib/store';
import {
  calculateRetardFrom1230,
  formatDate,
  isJourPaye,
  programmeStatusLabel,
  ProgrammeImportError,
  withPaidCaisse,
} from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import SheetModal from '@/components/SheetModal';
import {
  IconAlert,
  IconCalendar,
  IconCheck,
  IconClose,
  IconSearch,
  IconSync,
  IconTruck,
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

function isStandbyCircuit(value?: string | null): boolean {
  const prog = (value || '').trim().toUpperCase();
  return !prog || prog === 'STAND-BY' || prog === 'STANDBY';
}

/** Circuit encore ouvert. Il reste affiché après minuit, jusqu'au clic sur Bascule. */
function isLiveDayProgramme(d: {
  programmeJour?: string;
  circuitActuel?: string;
  programmeDate?: string;
}): boolean {
  const prog = (d.programmeJour || d.circuitActuel || '').trim();
  return !isStandbyCircuit(prog);
}

function historyUnpaidCount(driver: Driver) {
  return (driver.programmeHistorique || []).filter((entry) => !entry.paid).length;
}

function dayListStatut(driver: Driver, isStandby: boolean, overdue: boolean) {
  if (isJourPaye(driver)) return withPaidCaisse('PAYÉ', driver.caissePaye);
  if (isStandby) return historyUnpaidCount(driver) > 0 ? 'NON PAYÉ' : 'SANS CAISSE';
  if (!overdue) return 'EN COURS';
  return 'NON PAYÉ';
}

function DayStatutBadge({ label }: { label: string }) {
  const cls = label.startsWith('PAYÉ')
    ? 'badge-solid-emerald'
    : label === 'EN COURS'
    ? 'badge bg-sky-50 text-sky-800 ring-1 ring-sky-200'
    : label === 'NON PAYÉ'
    ? 'badge-solid-rose'
    : 'badge-solid-amber';
  return <span className={`${cls} shrink-0`}>{label}</span>;
}

export default function ProgrammePage() {
  const drivers = useCaisseStore((state) => state.drivers);
  const currentUser = useCaisseStore((state) => state.currentUser);
  const assignCircuit = useCaisseStore((state) => state.assignCircuit);
  const placeDriverOnDayProgramme = useCaisseStore((state) => state.placeDriverOnDayProgramme);
  const executeBascule1230 = useCaisseStore((state) => state.executeBascule1230);
  const importProgramme = useCaisseStore((state) => state.importProgramme);
  const loadDefaultProgrammeExcel = useCaisseStore((state) => state.loadDefaultProgrammeExcel);
  const markProgramEntryPaid = useCaisseStore((state) => state.markProgramEntryPaid);
  const deleteProgramEntry = useCaisseStore((state) => state.deleteProgramEntry);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterCircuit, setFilterCircuit] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'UNPAID' | 'ALL'>('ALL');
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipePassword, setWipePassword] = useState('');
  const [wipeError, setWipeError] = useState('');
  const [wipeBusy, setWipeBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [importErrors, setImportErrors] = useState<ProgrammeImportError[]>([]);
  const [openList, setOpenList] = useState<'day' | 'standby'>('day');
  const [addOpen, setAddOpen] = useState(false);
  const [addDriverId, setAddDriverId] = useState('');
  const [addCircuit, setAddCircuit] = useState('');
  const [addQuery, setAddQuery] = useState('');

  const caisseCode = (currentUser?.caisseCode || currentUser?.username || '').toUpperCase();
  const canManageProgramme = caisseCode !== 'CRSF' && caisseCode !== 'CRTN';
  const canRectify = currentUser?.role !== 'superviseur';

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

  // Programme du jour uniquement : pas les STAND-BY, pas les programmes des jours précédents
  const dayDrivers = useMemo(
    () => drivers.filter((d) => isLiveDayProgramme(d)),
    [drivers]
  );

  const activeProgrammeDrivers = dayDrivers;

  const standbyDrivers = useMemo(
    () =>
      drivers.filter((d) => {
        const p = (d.programmeJour || '').trim().toUpperCase();
        return !p || p === 'STAND-BY';
      }),
    [drivers]
  );

  // Filtrage de la liste du Programme du Jour (jamais les stand-by ni les jours précédents)
  const filteredDrivers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dayDrivers.filter((d) => {
      const prog = (d.programmeJour || d.circuitActuel || 'STAND-BY').trim().toUpperCase();
      const matchCircuit = !filterCircuit || filterCircuit === '__ACTIVE__'
        ? true
        : prog === filterCircuit;
      const matchSearch = !q
        ? true
        : d.nom.toLowerCase().includes(q) ||
          d.tr.toLowerCase().includes(q) ||
          prog.toLowerCase().includes(q);
      return matchCircuit && matchSearch;
    });
  }, [dayDrivers, filterCircuit, searchQuery]);

  const standbyListed = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return standbyDrivers.filter((d) => {
      if (!q) return true;
      return d.nom.toLowerCase().includes(q) || d.tr.toLowerCase().includes(q);
    });
  }, [standbyDrivers, searchQuery]);

  const shownDrivers = openList === 'standby' ? standbyListed : filteredDrivers;

  const rectifiableDrivers = useMemo(() => {
    const q = addQuery.trim().toLowerCase();
    return drivers
      .filter((d) => {
        const prog = (d.programmeJour || '').trim().toUpperCase();
        const standby = !prog || prog === 'STAND-BY' || prog === 'STANDBY';
        return (standby || d.statut === 'PAS DE CAISSE') && !isLiveDayProgramme(d);
      })
      .filter((d) => {
        if (!q) return true;
        return d.nom.toLowerCase().includes(q) || d.tr.toLowerCase().includes(q);
      })
      .sort((a, b) => a.tr.localeCompare(b.tr, undefined, { numeric: true }));
  }, [drivers, addQuery]);

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
      statusLabel: string;
      retardText: string;
      isOverdue: boolean;
    }[] = [];

    drivers.forEach((d) => {
      // 1. Anciens programmes dans programmeHistorique
      (d.programmeHistorique || []).forEach((h) => {
        const retard = calculateRetardFrom1230(h.date);
        const statusLabel = programmeStatusLabel(h);
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
          statusLabel,
          retardText: h.paid ? statusLabel : statusLabel + (retard.isOverdue ? ` · ${retard.text}` : ''),
          isOverdue: !h.paid && retard.isOverdue,
        });
      });

      // Le programme du jour reste dans le tableau 1. Ici : uniquement les impayés antérieurs
      // et les STAND-BY NON PAYÉ qui n'ont pas encore de ligne d'historique.
      const liveToday = isLiveDayProgramme(d);
      const unpaidHist = (d.programmeHistorique || []).some((h) => !h.paid);
      if (d.statut === 'NON PAYE' && !liveToday && !unpaidHist) {
        const prog = (d.programmeJour || d.circuitActuel || '').trim();
        const standby = isStandbyCircuit(prog);
        const refDate = d.programmeDate || d.dateDerniere;
        const retard = calculateRetardFrom1230(refDate);
        list.push({
          key: `${d.id}-PREV-UNPAID`,
          driverId: d.id,
          entryId: standby ? 'STANDBY-UNPAID' : 'PREV-UNPAID',
          tr: d.tr,
          nom: d.nom,
          circuit: standby ? 'STAND-BY' : prog || 'ANCIENNE CAISSE',
          date: refDate,
          paid: false,
          isCurrent: false,
          statusLabel: 'Non payée (J-1)',
          retardText: `Non payée (J-1)${retard.isOverdue ? ` · ${retard.text}` : ''}`,
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

  // Regroupement par jour (chaque jour reste séparé), jours récents d'abord
  const historyGroups = useMemo(() => {
    const dayKey = (iso: string) => {
      const dt = new Date(iso);
      if (isNaN(dt.getTime())) return '0000-00-00';
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    };
    const map = new Map<string, typeof historyRows>();
    historyRows.forEach((r) => {
      const k = dayKey(r.date);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([day, rows]) => {
        const sorted = [...rows].sort(
          (a, b) =>
            Number(a.paid) - Number(b.paid) ||
            a.tr.localeCompare(b.tr, undefined, { numeric: true })
        );
        const dt = new Date(day + 'T12:00:00');
        const label = isNaN(dt.getTime())
          ? 'Date inconnue'
          : dt.toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
        return { day, label, rows: sorted, unpaid: sorted.filter((r) => !r.paid).length };
      });
  }, [historyRows]);
  const totalUnpaidHistoryCount = useMemo(
    () =>
      drivers.reduce((sum, d) => sum + historyUnpaidCount(d), 0),
    [drivers]
  );

  const handleExcelFile = (file: File) => {
    if (drivers.some((d) => isLiveDayProgramme(d))) {
      setImportMsg({
        type: 'error',
        text: 'La journée en cours est encore ouverte. Cliquez sur Bascule, confirmez, puis importez le fichier Excel de 12h30. L’import ne change pas la journée tout seul.',
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

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
    if (confirm('Voulez-vous vraiment basculer vers la nouvelle journée ?')) {
      executeBascule1230();
    }
  };

  const confirmWipe = async () => {
    if (!wipePassword.trim()) {
      setWipeError('Mot de passe administrateur requis.');
      return;
    }
    if (
      !confirm(
        'Voulez-vous vraiment supprimer TOUS les chauffeurs, programmes et historiques de caisses ?'
      )
    ) {
      return;
    }
    setWipeBusy(true);
    setWipeError('');
    try {
      const res = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: wipePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setWipeError(data.error || 'Mot de passe administrateur refusé.');
        return;
      }
      loadDefaultProgrammeExcel();
      setImportErrors([]);
      setWipeOpen(false);
      setWipePassword('');
      setImportMsg({
        type: 'success',
        text: 'Tous les chauffeurs, programmes et historiques de transactions ont été supprimés (base 100% vide).',
      });
    } catch (err) {
      setWipeError((err as Error).message || 'Vérification impossible.');
    } finally {
      setWipeBusy(false);
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
          <div className="flex items-center gap-4 text-sm">
            {canRectify && (
              <button
                type="button"
                onClick={() => {
                  setAddDriverId('');
                  setAddCircuit('');
                  setAddQuery('');
                  setAddOpen(true);
                }}
                className="font-semibold text-indigo-800 underline decoration-indigo-300 underline-offset-4 hover:decoration-indigo-800"
              >
                Ajouter un chauffeur
              </button>
            )}
            {canManageProgramme && (
              <>
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
                  className="font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                >
                  Importer Excel
                </button>
                <button
                  type="button"
                  onClick={handleBascule}
                  className="font-semibold text-amber-800 underline decoration-amber-300 underline-offset-4 hover:decoration-amber-800"
                  title="Bascule manuelle vers la nouvelle journée"
                >
                  Bascule
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Bandeau d'Import Excel & Règle de Calcul du Retard après 12:30 Demain */}
      <div className="mb-6 border-y border-slate-200 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Feuille du jour · échéance demain 12:30
            </p>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
              Colonnes lues dans Excel : nom, programme, code TR. La journée ne passe en non payé qu&apos;après 12:30 le lendemain.
            </p>
          </div>
          {canManageProgramme && (
            <button
              type="button"
              onClick={() => {
                setWipeError('');
                setWipePassword('');
                setWipeOpen(true);
              }}
              className="self-start text-xs font-medium text-rose-700 underline decoration-rose-200 underline-offset-4 hover:decoration-rose-700 lg:self-end"
            >
              Vider chauffeurs et historiques
            </button>
          )}
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
      <div className="mb-8 grid grid-cols-2 gap-x-6 gap-y-4 border-b border-slate-200 pb-6 sm:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setOpenList('day');
            setFilterCircuit('');
          }}
          className="text-left"
        >
          <p className="font-mono text-3xl font-medium tracking-tight text-slate-900 underline decoration-slate-300 underline-offset-4">
            {dayDrivers.length}
          </p>
          <p className={`mt-1 text-xs underline underline-offset-4 ${filterCircuit === '' && openList === 'day' ? 'font-semibold text-slate-900 decoration-slate-900' : 'text-slate-500 decoration-slate-300'}`}>
            Programme du jour
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenList('day');
            setFilterCircuit('__ACTIVE__');
          }}
          className="text-left"
        >
          <p className="font-mono text-3xl font-medium tracking-tight text-sky-800 underline decoration-sky-200 underline-offset-4">
            {activeProgrammeDrivers.length}
          </p>
          <p className={`mt-1 text-xs underline underline-offset-4 ${filterCircuit === '__ACTIVE__' && openList === 'day' ? 'font-semibold text-sky-900 decoration-sky-700' : 'text-slate-500 decoration-slate-300'}`}>
            En tournée
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            setOpenList('standby');
            setFilterCircuit('');
          }}
          className="text-left"
        >
          <p className="font-mono text-3xl font-medium tracking-tight text-amber-800 underline decoration-amber-300 underline-offset-4">
            {standbyDrivers.length}
          </p>
          <p className={`mt-1 text-xs underline underline-offset-4 ${openList === 'standby' ? 'font-semibold text-amber-900 decoration-amber-700' : 'text-slate-500 decoration-slate-300'}`}>
            Stand-by
          </p>
        </button>
        <button
          type="button"
          onClick={() => {
            setHistoryFilter('UNPAID');
            document.getElementById('programme-history')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
          className="text-left"
        >
          <p className="font-mono text-3xl font-medium tracking-tight text-rose-800 underline decoration-rose-200 underline-offset-4">
            {totalUnpaidHistoryCount}
          </p>
          <p className="mt-1 text-xs text-slate-500 underline decoration-slate-300 underline-offset-4">
            Impayées, historique seul
          </p>
        </button>
      </div>

      {/* =====================================================================
          SECTION 1 : LISTE COMPLÈTE DU PROGRAMME DU JOUR (AVEC RETARDS APRÈS 12:30 DEMAIN)
      ===================================================================== */}
      <div className="card overflow-hidden">
        <div className="card-header flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border-b border-slate-100">
          <div>
            <h2 className="card-title text-sm sm:text-base font-extrabold text-slate-900">
              {openList === 'standby'
                ? `Stand-by (${shownDrivers.length})`
                : `1. Liste du Programme du Jour (${shownDrivers.length} sur ${dayDrivers.length} chauffeurs)`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Uniquement le programme de la journée en cours. Après la bascule de 12:30, cette liste reste vide jusqu&apos;au prochain import.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <select
              value={filterCircuit}
              onChange={(e) => setFilterCircuit(e.target.value)}
              className="select !min-h-10 !py-1.5 !text-xs font-bold sm:w-52 bg-slate-50/80"
            >
              <option value="">Programme du jour ({dayDrivers.length})</option>
              <option value="__ACTIVE__">Tournées actives ({activeProgrammeDrivers.length})</option>
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

        {shownDrivers.length === 0 ? (
          <EmptyState
            icon={<IconCalendar className="h-6 w-6 text-sky-500" />}
            title="Aucun programme pour cette journée"
            description="La liste du jour est vide. Elle se remplit à l'import Excel et redevient vide après la bascule de 12:30."
          />
        ) : (
          <>
            {/* Responsive Cards View for Mobile & Tablet / Compact Screens (xl:hidden) */}
            <div className="grid grid-cols-1 gap-3 p-3.5 sm:p-4 md:grid-cols-2 max-h-[600px] overflow-y-auto xl:hidden bg-slate-50/40">
              {shownDrivers.map((d) => {
                const prog = (d.programmeJour || d.circuitActuel || 'STAND-BY').trim() || 'STAND-BY';
                const isStandby = prog.toUpperCase() === 'STAND-BY';
                const retardInfo = calculateRetardFrom1230(d.programmeDate || d.dateDerniere);
                const historyUnpaid = historyUnpaidCount(d);
                const dayStatut = dayListStatut(d, isStandby, retardInfo.isOverdue);

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
                        <DayStatutBadge label={dayStatut} />
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
                            ) : isJourPaye(d) ? (
                              <span className="text-xs font-bold text-emerald-600">{withPaidCaisse('✓ Caisse réglée', d.caissePaye)}</span>
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
                            {historyUnpaid > 0 ? (
                              <span className="badge-solid-rose font-bold text-[10px]">
                                {historyUnpaid} non payée{historyUnpaid > 1 ? 's' : ''}
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
                        className="text-xs font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                      >
                        Guichet
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
                  {shownDrivers.map((d) => {
                    const prog = (d.programmeJour || d.circuitActuel || 'STAND-BY').trim() || 'STAND-BY';
                    const isStandby = prog.toUpperCase() === 'STAND-BY';
                    const retardInfo = calculateRetardFrom1230(d.programmeDate || d.dateDerniere);
                    const historyUnpaid = historyUnpaidCount(d);
                const dayStatut = dayListStatut(d, isStandby, retardInfo.isOverdue);

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
                          ) : isJourPaye(d) ? (
                            <span className="text-xs font-bold text-emerald-600">
                              {withPaidCaisse('✓ Caisse du jour réglée', d.caissePaye)}
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
                          {historyUnpaid > 0 ? (
                            <span className="badge-solid-rose font-bold text-[11px]">
                              {historyUnpaid} non payée{historyUnpaid > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="badge-emerald font-bold text-[11px]">0 impayé</span>
                          )}
                        </td>
                        <td className="!py-3">
                          <DayStatutBadge label={dayStatut} />
                        </td>
                        <td className="!py-3 text-right">
                          <Link
                            href={`/caisse?tr=${encodeURIComponent(d.tr)}`}
                            className="text-xs font-semibold text-slate-900 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-900"
                          >
                            Guichet
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
      <div id="programme-history" className="mt-10 overflow-hidden scroll-mt-24">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="card-title text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
              <IconAlert className="h-5 w-5 text-rose-600 shrink-0" />
              <span>2. Historique des Programmes &amp; Caisses Non Payées ({historyRows.length})</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Programmes antérieurs non payés et stand-by non payés. Le programme du jour n&apos;apparaît pas dans ce tableau.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-4 text-xs">
              <button
                type="button"
                onClick={() => setHistoryFilter('UNPAID')}
                className={
                  historyFilter === 'UNPAID'
                    ? 'font-semibold text-rose-800 underline decoration-rose-300 underline-offset-4'
                    : 'text-slate-500 hover:text-slate-800'
                }
              >
                Impayées
              </button>
              <button
                type="button"
                onClick={() => setHistoryFilter('ALL')}
                className={
                  historyFilter === 'ALL'
                    ? 'font-semibold text-slate-900 underline decoration-slate-400 underline-offset-4'
                    : 'text-slate-500 hover:text-slate-800'
                }
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
<div className="max-h-[520px] space-y-4 overflow-y-auto bg-rose-50/10 p-3.5 sm:p-4 lg:hidden">
{historyGroups.map((g) => (<div key={g.day}><div className="mb-2 flex flex-col gap-1 rounded-xl bg-slate-900 px-3.5 py-2 text-white sm:flex-row sm:items-center sm:justify-between"><span className="text-xs font-extrabold uppercase tracking-wider">{g.label}</span><span className="text-[11px] font-bold text-slate-300">{g.rows.length} ligne(s) · {g.unpaid} non payée(s)</span></div><div className="grid grid-cols-1 gap-3 md:grid-cols-2">{g.rows.map((row) => (
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
                      <span className="badge-solid-emerald text-[10px]">{row.statusLabel}</span>
                    ) : (
                      <span className="badge-solid-rose text-[10px]">{row.statusLabel}</span>
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
                          className="text-[11px] font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4"
                        >
                          Encaisser
                        </Link>
                        <button
                          type="button"
                          onClick={() => markProgramEntryPaid(row.driverId, row.entryId)}
                          className="text-[11px] font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4"
                        >
                          ✓ Payé
                        </button>
                      </div>
                    )}
                    <button type="button" title="Supprimer ce programme" onClick={() => { if (confirm(`Supprimer ce programme ?`)) deleteProgramEntry(row.driverId, row.entryId); }} className="text-[11px] font-medium text-rose-700 underline decoration-rose-200 underline-offset-4">Supprimer</button>
                  </div>
                </div>
))}</div></div>))}
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
{historyGroups.map((g) => (<Fragment key={g.day}><tr className="bg-slate-900 text-white"><td colSpan={7} className="!py-2.5 !px-4"><div className="flex items-center justify-between"><span className="text-xs font-extrabold uppercase tracking-wider">📅 {g.label}</span><span className="text-[11px] font-bold text-slate-300">{g.rows.length} ligne(s) · {g.unpaid} non payée(s)</span></div></td></tr>{g.rows.map((row) => (
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
                          <span className="badge-solid-emerald text-xs">{row.statusLabel}</span>
                        ) : (
                          <span className="badge-solid-rose text-xs">{row.statusLabel}</span>
                        )}
                      </td>
                      <td className="!py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!row.paid && (
                            <>
                              <Link
                                href={`/caisse?tr=${encodeURIComponent(row.tr)}`}
                                className="text-[11px] font-semibold text-slate-800 underline decoration-slate-300 underline-offset-4"
                              >
                                Encaisser
                              </Link>
                              <button
                                type="button"
                                onClick={() => markProgramEntryPaid(row.driverId, row.entryId)}
                                className="text-[11px] font-semibold text-emerald-800 underline decoration-emerald-300 underline-offset-4"
                              >
                                ✓ Payé
                              </button>
                            </>
                          )}
                          <button type="button" title="Supprimer ce programme" onClick={() => { if (confirm(`Supprimer ce programme ?`)) deleteProgramEntry(row.driverId, row.entryId); }} className="text-[11px] font-medium text-rose-700 underline decoration-rose-200 underline-offset-4">Supprimer</button>
                        </div>
                      </td>
                    </tr>
))}</Fragment>))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {addOpen && (
        <SheetModal
          title="Ajouter un chauffeur au programme du jour"
          subtitle="Uniquement un chauffeur Stand-by ou sans caisse. Choisissez son circuit pour la rectification."
          onClose={() => setAddOpen(false)}
          accent="indigo"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setAddOpen(false)}>
                Annuler
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!addDriverId || !addCircuit}
                onClick={() => {
                  placeDriverOnDayProgramme(addDriverId, addCircuit);
                  setAddOpen(false);
                  setOpenList('day');
                  setFilterCircuit('');
                }}
              >
                Ajouter au programme
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder="Chercher un Stand-by ou sans caisse..."
                className="input !pl-9"
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              {rectifiableDrivers.length === 0 ? (
                <p className="p-4 text-sm text-slate-500">Aucun chauffeur Stand-by ou sans caisse.</p>
              ) : (
                rectifiableDrivers.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setAddDriverId(d.id)}
                    className={`flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left last:border-b-0 ${
                      addDriverId === d.id ? 'bg-indigo-50' : 'hover:bg-slate-50'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{d.nom}</span>
                      <span className="text-[11px] text-slate-500">
                        {d.statut === 'PAS DE CAISSE' ? 'Sans caisse' : 'Stand-by'}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs text-slate-500">TR {d.tr}</span>
                  </button>
                ))
              )}
            </div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-500">
              Programme du jour
              <select
                value={addCircuit}
                onChange={(e) => setAddCircuit(e.target.value)}
                className="select mt-1"
              >
                <option value="">Choisir un circuit</option>
                {allCircuits
                  .filter((c) => c !== 'STAND-BY')
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </label>
          </div>
        </SheetModal>
      )}

      {wipeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <h3 className="text-base font-extrabold text-slate-900">Vider tous les chauffeurs et historiques</h3>
            <p className="mt-2 text-sm text-slate-600">
              Cette suppression est définitive. Saisissez le mot de passe administrateur, puis confirmez.
            </p>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Mot de passe administrateur
            </label>
            <input
              type="password"
              value={wipePassword}
              onChange={(e) => setWipePassword(e.target.value)}
              className="input mt-1"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmWipe();
              }}
            />
            {wipeError && <p className="mt-2 text-sm font-semibold text-rose-600">{wipeError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setWipeOpen(false)}
                disabled={wipeBusy}
              >
                Annuler
              </button>
              <button
                type="button"
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"
                onClick={confirmWipe}
                disabled={wipeBusy}
              >
                {wipeBusy ? 'Vérification…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
