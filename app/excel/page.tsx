'use client';

import { useState } from 'react';
import { useCaisseStore } from '@/lib/store';
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
  const drivers = useCaisseStore((state) => state.drivers);
  const transactions = useCaisseStore((state) => state.transactions);
  const billetterieItems = useCaisseStore((state) => state.billetterieItems);
  const importProgramme = useCaisseStore((state) => state.importProgramme);

  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const processFile = async (file: File) => {
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(file.name)) {
      setFeedback({ type: 'error', text: 'Format de fichier invalide. Utilisez un fichier .xlsx, .xls, .xlsm ou .csv.' });
      return;
    }

    setUploading(true);
    setFeedback(null);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const wb = XLSX.read(data, { type: 'array' });
          const parsedRows = parseProgrammeWorkbook(wb);

          if (parsedRows.length > 0) {
            const { updatedCount, createdCount, totalProgrammes } = importProgramme(parsedRows);
            setFeedback({
              type: 'success',
              text: `${parsedRows.length} lignes importées avec succès : ${updatedCount} chauffeur(s) mis à jour, ${createdCount} nouveau(x) chauffeur(s) créé(s), et ${totalProgrammes} programme(s) du jour créés ! Retard calculé après 12:30 demain.`,
            });
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
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Import & Export Excel"
        subtitle="Mise à jour des chauffeurs depuis votre fichier .xlsm ou exportation des rapports"
        icon={<IconSheet className="h-5 w-5" />}
        accent="slate"
      />

      {/* Zone Drag & Drop */}
      <div className="card p-6">
        <h3 className="card-title text-sm mb-4">Importer un Fichier Excel (.xlsm ou .xlsx)</h3>

        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-8 text-center hover:border-indigo-400 transition-all">
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

          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm ring-1 ring-slate-100">
            {uploading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
            ) : (
              <IconUpload className="h-6 w-6" />
            )}
          </div>

          <p className="mt-3 text-sm font-semibold text-slate-900">
            {uploading ? 'Importation en cours...' : 'Sélectionnez votre fichier Excel'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Compatible avec TABLEAU_SCALCULE_CAISSE_HICHEJ.xlsm
          </p>

          <label
            htmlFor="excel-file"
            className={`btn-primary mt-5 inline-flex cursor-pointer ${
              uploading ? 'pointer-events-none opacity-50' : ''
            }`}
          >
            <IconFile className="h-4 w-4" />
            Choisir le Fichier
          </label>
        </div>

        {feedback && (
          <div
            className={`mt-4 flex items-center gap-2.5 rounded-xl border p-4 text-sm ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <IconCheck className="h-4 w-4 text-emerald-600" />
            ) : (
              <IconAlert className="h-4 w-4 text-rose-600" />
            )}
            <p className="font-medium">{feedback.text}</p>
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="card mt-6 p-6">
        <h3 className="card-title text-sm mb-4">Exportation des Données</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-900 text-sm">Mouvement des Chauffeurs</h4>
            <p className="mt-1 text-xs text-slate-500">
              Exporter les {drivers.length} chauffeurs avec statuts et alertes de retard.
            </p>
            <button onClick={exportMouvement} className="btn-ghost btn-sm mt-4 w-full">
              <IconDownload className="h-3.5 w-3.5" />
              Télécharger .xlsx
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 p-4">
            <h4 className="font-semibold text-slate-900 text-sm">Comptage Billetterie</h4>
            <p className="mt-1 text-xs text-slate-500">
              Exporter le détail des 12 coupures physiques et l&apos;état du coffre.
            </p>
            <button onClick={exportBilletterie} className="btn-ghost btn-sm mt-4 w-full">
              <IconDownload className="h-3.5 w-3.5" />
              Télécharger .xlsx
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

