'use client';

import { useState } from 'react';
import { useCaisseStore } from '@/lib/store';
import { ProgrammeImportError } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import {
  IconAlert,
  IconCheck,
  IconDownload,
  IconFile,
  IconSheet,
  IconUpload,
} from '@/components/Icons';
import * as XLSX from 'xlsx';

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

export default function ExcelPage() {
  const currentUser = useCaisseStore((state) => state.currentUser);
  const drivers = useCaisseStore((state) => state.drivers);
  const transactions = useCaisseStore((state) => state.transactions);
  const billetterieItems = useCaisseStore((state) => state.billetterieItems);
  const importProgramme = useCaisseStore((state) => state.importProgramme);
  const canImportExcel =
    currentUser?.role === 'admin' ||
    (currentUser?.caisseCode || '').toUpperCase() === 'CRNU' ||
    (currentUser?.username || '').toLowerCase() === 'crnu';

  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [importErrors, setImportErrors] = useState<ProgrammeImportError[]>([]);

  const processFile = async (file: File) => {
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      setFeedback({ type: 'error', text: 'Format de fichier invalide. Utilisez un fichier .xlsx, .xls, .xlsm ou .csv.' });
      return;
    }

    setUploading(true);
    setFeedback(null);
    setImportErrors([]);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const wb = XLSX.read(data, { type: 'array' });
          const parsedRows = parseProgrammeWorkbook(wb);

          if (parsedRows.length > 0) {
            const { updatedCount, createdCount, totalProgrammes, errors } = importProgramme(parsedRows);
            setImportErrors(errors);
            if (errors.length > 0) {
              setFeedback({
                type: 'error',
                text: `Attention : ${errors.length} erreur(s) détectée(s) et bloquée(s) (Code TR en double ou conflit de nom sur un Code TR existant). ${updatedCount} chauffeur(s) mis à jour, ${createdCount} créé(s).`,
              });
            } else {
              setFeedback({
                type: 'success',
                text: `${parsedRows.length} lignes importées avec succès : ${updatedCount} chauffeur(s) mis à jour, ${createdCount} nouveau(x) chauffeur(s) créé(s), et ${totalProgrammes} programme(s) du jour créés ! Retard calculé après 12:30 demain.`,
              });
            }
          } else {
            setFeedback({
              type: 'error',
              text: 'Aucune donnée valide trouvée dans le fichier Excel. Colonnes attendues : Nom & Prénom du Chauffeur, PROGRAMME DE CHAUFFEUR, Code TR.',
            });
          }
        } catch (err) {
          setFeedback({
            type: 'error',
            text: 'Erreur lors du traitement du fichier : ' + (err as Error).message,
          });
        } finally {
          setUploading(false);
        }
      };

      reader.readAsArrayBuffer(file);
    } catch (err) {
      setFeedback({ type: 'error', text: (err as Error).message });
      setUploading(false);
    }
  };

  const exportMouvement = () => {
    const data = drivers.map((d) => ({
      'Code Chauffeur (TR)': d.tr,
      'Nom de Chauffeur': d.nom,
      'Statut': d.statut,
      'Circuit / Programme': d.programmeJour,
      'Caisses Dues': d.caissesDues,
      'Réclamation / Alerte': d.reclamation,
      'Dernière Transaction': d.dateDerniere,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'MOUVEMENT DE CHAUFFEUR');
    XLSX.writeFile(wb, `mouvement_chauffeurs_${Date.now()}.xlsx`);
  };

  const exportBilletterie = () => {
    const data = billetterieItems.map((item) => ({
      'Dénomination': item.label,
      'Type': item.isBillet ? 'Billet' : 'Pièce',
      'Valeur Unitaire (TND)': item.valeur,
      'Quantité Comptée': item.nombre,
      'Total Montant (TND)': item.nombre * item.valeur,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BILLETTERIE');
    XLSX.writeFile(wb, `comptage_billetterie_${Date.now()}.xlsx`);
  };

  return (
    <div className="w-full pb-12">
      <PageHeader
        title="Importation & Exportation Excel"
        subtitle={
          canImportExcel
            ? 'Importation du programme journalier (.xlsx / .xlsm) et exportation des états de caisse'
            : 'Exportation des états au format Excel. L’importation est réservée à la caisse CRNU et à l’administration.'
        }
        icon={<IconSheet className="h-5 w-5" />}
        accent="indigo"
      />

      {/* Zone Drag & Drop — CRNU et Admin uniquement */}
      {canImportExcel && (
        <div className="card p-5 sm:p-6">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Importer un fichier de programme (.xlsm ou .xlsx)
          </h3>

          <div className="rounded-2xl border-2 border-dashed border-sky-300/80 bg-sky-50/30 p-7 sm:p-9 text-center hover:border-sky-500 hover:bg-sky-50/60 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xlsm,.xls"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processFile(f);
              }}
              disabled={uploading}
              id="excel-file"
              className="hidden"
            />

            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-600 text-white shadow-sm">
              {uploading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <IconUpload className="h-5 w-5" />
              )}
            </div>

            <p className="mt-3.5 text-base font-bold text-slate-900">
              {uploading ? 'Analyse et synchronisation en cours…' : 'Sélectionnez votre fichier Excel'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Colonnes détectées : Nom &amp; Prénom du Chauffeur, Programme de Chauffeur et Code TR
            </p>

            <label
              htmlFor="excel-file"
              className={`btn-primary mt-4 inline-flex cursor-pointer ${
                uploading ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              <IconFile className="h-4 w-4" />
              Parcourir les fichiers
            </label>
          </div>

          {feedback && (
            <div
              className={`mt-4 flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-semibold ${
                feedback.type === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <IconCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <IconAlert className="h-4 w-4 text-rose-600 shrink-0" />
              )}
              <p>{feedback.text}</p>
            </div>
          )}

          {importErrors.length > 0 && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
              <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800 mb-2">
                Erreurs bloquées ({importErrors.length}) :
              </h4>
              <ul className="space-y-1.5 text-xs font-medium text-slate-800">
                {importErrors.map((err, idx) => (
                  <li
                    key={idx}
                    className="rounded-lg bg-white border border-rose-200 px-3 py-2"
                  >
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Export Options */}
      <div className="card mt-5 p-5 sm:p-6">
        <h3 className="text-sm font-bold text-slate-900 mb-3.5">Exportation des données</h3>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Mouvement des Chauffeurs</h4>
              <p className="mt-1 text-xs text-slate-500">
                Exporter les {drivers.length} chauffeurs avec statuts, circuits et alertes de retard.
              </p>
            </div>
            <button onClick={exportMouvement} className="btn-ghost btn-sm mt-4 w-full bg-white">
              <IconDownload className="h-3.5 w-3.5 text-sky-600" />
              Télécharger .xlsx
            </button>
          </div>

          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div>
              <h4 className="font-bold text-slate-900 text-sm">Comptage Billetterie</h4>
              <p className="mt-1 text-xs text-slate-500">
                Exporter le détail des 11 coupures en caisse et les totaux de billetterie.
              </p>
            </div>
            <button onClick={exportBilletterie} className="btn-ghost btn-sm mt-4 w-full bg-white">
              <IconDownload className="h-3.5 w-3.5 text-sky-600" />
              Télécharger .xlsx
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

