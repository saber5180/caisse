import { Driver, DriverStatus, ProgramEntry } from '@/types/caisse';
import { differenceInMinutes, differenceInHours, differenceInDays } from 'date-fns';

export function formatMoney(amount: number | undefined | null): string {
  const val = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(val);
}

export function formatDate(date: string | Date | undefined | null): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(d);
  } catch {
    return '—';
  }
}

export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(d);
  } catch {
    return '—';
  }
}

export function calculateElapsed(dateStr: string | Date | undefined | null): {
  minutes: number;
  hours: number;
  days: number;
  text: string;
} {
  if (!dateStr) {
    return { minutes: 0, hours: 0, days: 0, text: '0 HEURE' };
  }

  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return { minutes: 0, hours: 0, days: 0, text: '0 HEURE' };
  }

  const now = new Date();
  const minutes = Math.max(0, differenceInMinutes(now, d));
  const hours = Math.max(0, differenceInHours(now, d));
  const days = Math.max(0, differenceInDays(now, d));

  let text: string;
  if (days < 1) {
    text = `${hours} HEURE${hours > 1 ? 'S' : ''}`;
  } else {
    text = `${days} JOUR${days > 1 ? 'S' : ''}`;
  }

  return { minutes, hours, days, text };
}

/**
 * Calcule l'échéance d'un programme du jour : le lendemain (J+1) à 12:30:00.
 * C'est après 12:30 du lendemain que l'on commence à calculer le retard.
 */
export function getDeadline1230(dateStr?: string | Date | null): Date {
  const base = dateStr ? new Date(dateStr) : new Date();
  const validBase = isNaN(base.getTime()) ? new Date() : base;
  const deadline = new Date(validBase);
  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(12, 30, 0, 0);
  return deadline;
}

/**
 * Calcule le retard par rapport à l'échéance de 12:30 du lendemain (J+1 à 12:30).
 */
export function calculateRetardFrom1230(dateStr?: string | Date | null): {
  isOverdue: boolean;
  minutes: number;
  hours: number;
  days: number;
  text: string;
  deadline: Date;
  deadlineFormatted: string;
} {
  const deadline = getDeadline1230(dateStr);
  const deadlineFormatted = `${formatDate(deadline)} à 12:30`;
  const now = new Date();

  if (now.getTime() < deadline.getTime()) {
    return {
      isOverdue: false,
      minutes: 0,
      hours: 0,
      days: 0,
      text: `En cours (échéance ${deadlineFormatted})`,
      deadline,
      deadlineFormatted,
    };
  }

  const minutes = Math.max(0, differenceInMinutes(now, deadline));
  const hours = Math.max(0, differenceInHours(now, deadline));
  const days = Math.max(0, differenceInDays(now, deadline));

  const text =
    days < 1
      ? `${hours} HEURE${hours > 1 ? 'S' : ''} (depuis 12:30)`
      : `${days} JOUR${days > 1 ? 'S' : ''}`;

  return {
    isOverdue: true,
    minutes,
    hours,
    days,
    text,
    deadline,
    deadlineFormatted,
  };
}

export function recalculateReclamation(
  driver: Pick<
    Driver,
    'statut' | 'dateDerniere' | 'programmeJour' | 'circuitActuel' | 'programmeDate' | 'programmeHistorique'
  >
): {
  reclamation: string;
  isAlert: boolean;
  isUrgent: boolean;
} {
  const circuit = (driver.programmeJour || driver.circuitActuel || 'STAND-BY').trim() || 'STAND-BY';
  const unpaidHistory = (driver.programmeHistorique || []).filter((e) => !e.paid);

  if (driver.statut === 'PAYE' && unpaidHistory.length === 0) {
    const { text } = calculateElapsed(driver.dateDerniere);
    return {
      reclamation: `Réglé (${circuit}) · depuis ${text}`,
      isAlert: false,
      isUrgent: false,
    };
  }

  if (driver.statut === 'PAS DE CAISSE' && unpaidHistory.length === 0) {
    return {
      reclamation: `Stand-by / Sans caisse (${circuit})`,
      isAlert: false,
      isUrgent: false,
    };
  }

  // Si le chauffeur a d'anciens programmes non payés dans son historique, le retard est calculé sur le plus ancien
  if (unpaidHistory.length > 0) {
    const oldest = unpaidHistory[unpaidHistory.length - 1];
    const retard = calculateRetardFrom1230(oldest.date);
    const labelCircuit = oldest.circuit || circuit;
    return {
      reclamation: retard.isOverdue
        ? `RETARD CAISSE (${labelCircuit}) · ${retard.text}`
        : `Programme (${circuit}) · ${unpaidHistory.length} ancienne(s) caisse(s) non payée(s)`,
      isAlert: true,
      isUrgent: retard.days >= 1 || unpaidHistory.length > 0,
    };
  }

  // Sinon, calcul sur le programme du jour (retard après 12:30 demain)
  const refDate = driver.programmeDate || driver.dateDerniere;
  const retard = calculateRetardFrom1230(refDate);

  if (!retard.isOverdue) {
    return {
      reclamation: `Programme du jour (${circuit}) · Échéance ${retard.deadlineFormatted}`,
      isAlert: false,
      isUrgent: false,
    };
  }

  return {
    reclamation: `RETARD CAISSE (${circuit}) · ${retard.text}`,
    isAlert: true,
    isUrgent: retard.days >= 1,
  };
}

export function getStatusBadge(status: DriverStatus): string {
  switch (status) {
    case 'NON PAYE':
      return 'badge-solid-rose';
    case 'PAYE':
      return 'badge-solid-emerald';
    case 'PAS DE CAISSE':
      return 'badge-solid-amber';
    default:
      return 'badge-slate';
  }
}

export function generateId(prefix = 'ID'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

/**
 * Normalise un code chauffeur scanné ou saisi en supprimant les zéros superflus au début.
 * Exemples: "037" -> "37", "0045" -> "45", "001" -> "1", "0" -> "0", "000" -> "0"
 */
export function cleanScannerTr(raw: string | undefined | null): string {
  if (!raw) return '';
  const trimmed = String(raw).replace(/\u00A0/g, ' ').trim();
  const stripped = trimmed.replace(/^0+/, '');
  return stripped === '' ? '0' : stripped;
}

/**
 * Extrait le nom de base d'un chauffeur sans les numéros de fin (ex: "CHELBI TRICHILI 2 174" -> "CHELBI TRICHILI")
 */
export function getDriverBaseName(nom: string | undefined | null): string {
  return String(nom || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+\d+(\s+\d+)?$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export interface UnpaidCaisse {
  id: string;
  driverId: string;
  tr: string;
  circuit: string;
  date?: string;
  current: boolean;
  isOverdue: boolean;
  retardText: string;
}

/**
 * Liste complète des caisses non payées d'un chauffeur :
 * 1. Les anciens programmes non payés de son historique (avec calcul du retard depuis 12:30 J+1)
 * 2. Son programme du jour s'il est NON PAYE et hors STAND-BY (ou s'il est NON PAYE sans autre entrée)
 * 3. Les autres tournées/caisses non payées rattachées au même chauffeur dans la flotte (même nom de base)
 */
export function getUnpaidCaisses(driver: Driver, allDrivers?: Driver[]): UnpaidCaisse[] {
  const list: UnpaidCaisse[] = [];
  const seenKeys = new Set<string>();

  const pushDriverUnpaid = (d: Driver, isPrimary: boolean) => {
    // 1. Anciens programmes non payés dans l'historique
    for (const e of d.programmeHistorique || []) {
      if (!e.paid) {
        const key = `${d.id}-HIST-${e.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const retard = calculateRetardFrom1230(e.date);
          list.push({
            id: e.id,
            driverId: d.id,
            tr: d.tr,
            circuit: e.circuit || 'ANCIENNE CAISSE',
            date: e.date,
            current: false,
            isOverdue: retard.isOverdue,
            retardText: retard.isOverdue ? `Retard: ${retard.text}` : 'À régler',
          });
        }
      }
    }

    // 2. Programme actuel s'il est NON PAYE
    const prog = (d.programmeJour || d.circuitActuel || '').trim();
    const isStandby = !prog || prog.toUpperCase() === 'STAND-BY' || prog.toUpperCase() === 'STANDBY';
    if (d.statut === 'NON PAYE' && (!isStandby || (isPrimary && list.length === 0))) {
      const key = `${d.id}-CURRENT`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const refDate = d.programmeDate || d.dateDerniere;
        const retard = calculateRetardFrom1230(refDate);
        list.push({
          id: 'CURRENT',
          driverId: d.id,
          tr: d.tr,
          circuit: isStandby ? 'CAISSE IMPAYÉE (STAND-BY)' : prog,
          date: refDate,
          current: true,
          isOverdue: retard.isOverdue,
          retardText: retard.isOverdue ? `Retard: ${retard.text}` : 'Programme du jour (échéance demain 12:30)',
        });
      }
    }
  };

  pushDriverUnpaid(driver, true);

  // 3. Inclure les autres caisses non payées du même chauffeur (ex: SAMI IBRAHIM BIZERT 1, 2, 3 ou CHELBI TRICHILI 2)
  if (Array.isArray(allDrivers) && allDrivers.length > 0) {
    const baseName = getDriverBaseName(driver.nom);
    if (baseName.length >= 3) {
      for (const other of allDrivers) {
        if (other.id !== driver.id && getDriverBaseName(other.nom) === baseName) {
          pushDriverUnpaid(other, false);
        }
      }
    }
  }

  return list;
}

/**
 * Applique une liste de lignes Excel (Nom & Prénom, Programme de Chauffeur, Code TR) à la flotte :
 * - Crée tous les programmes du jour (avec échéance demain 12:30)
 * - Archive les anciens programmes non payés dans programmeHistorique pour garder la trace des caisses non payées
 * - Ajoute automatiquement tous les nouveaux chauffeurs qui n'existaient pas encore dans la base
 */
export function applyProgrammeRowsToFleet(
  existingDrivers: Driver[],
  rows: { nom?: string; circuit: string; tr?: string }[],
  nowIsoInput?: string
): {
  drivers: Driver[];
  updatedCount: number;
  createdCount: number;
  totalProgrammes: number;
} {
  const nowIso = nowIsoInput || new Date().toISOString();
  const todayKey = nowIso.slice(0, 10);

  const resultDrivers: Driver[] = existingDrivers.map((d) => ({
    ...d,
    programmeHistorique: Array.isArray(d.programmeHistorique) ? [...d.programmeHistorique] : [],
  }));

  const usedIndices = new Set<number>();
  let updatedCount = 0;
  let createdCount = 0;

  // Calcul du prochain numéro TR disponible pour les chauffeurs sans Code TR dans Excel
  let maxTrNum = resultDrivers.reduce((max, d) => {
    const n = parseInt(cleanScannerTr(d.tr), 10);
    return !isNaN(n) && n > max ? n : max;
  }, 250);

  rows.forEach((row, rowIdx) => {
    const cleanNom = String(row.nom || '')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    const cleanCircuit =
      String(row.circuit || '')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase() || 'STAND-BY';
    const rawTr = String(row.tr || '')
      .replace(/\u00A0/g, ' ')
      .trim();
    const cleanTr = rawTr ? cleanScannerTr(rawTr).toUpperCase() : '';

    if (!cleanNom && !cleanTr) return;

    const baseRowNom = getDriverBaseName(cleanNom);

    // Recherche du chauffeur existant correspondant (non encore utilisé dans cet import)
    let matchIdx = -1;

    // 1. Correspondance exacte TR + Nom de base
    if (cleanTr && baseRowNom) {
      matchIdx = resultDrivers.findIndex(
        (d, idx) =>
          !usedIndices.has(idx) &&
          cleanScannerTr(d.tr).toUpperCase() === cleanTr &&
          (getDriverBaseName(d.nom) === baseRowNom ||
            d.nom.toUpperCase().includes(baseRowNom) ||
            baseRowNom.includes(getDriverBaseName(d.nom)))
      );
    }

    // 2. Correspondance par TR uniquement (si disponible)
    if (matchIdx === -1 && cleanTr) {
      matchIdx = resultDrivers.findIndex(
        (d, idx) => !usedIndices.has(idx) && cleanScannerTr(d.tr).toUpperCase() === cleanTr
      );
    }

    // 3. Si pas de TR dans Excel, correspondance par Nom + même circuit ou Nom disponible
    if (matchIdx === -1 && !cleanTr && cleanNom) {
      matchIdx = resultDrivers.findIndex(
        (d, idx) =>
          !usedIndices.has(idx) &&
          getDriverBaseName(d.nom) === baseRowNom &&
          (d.programmeJour || '').trim().toUpperCase() === cleanCircuit
      );
      if (matchIdx === -1) {
        matchIdx = resultDrivers.findIndex(
          (d, idx) => !usedIndices.has(idx) && getDriverBaseName(d.nom) === baseRowNom
        );
      }
    }

    const isStandby = cleanCircuit === 'STAND-BY' || cleanCircuit === 'STANDBY';

    if (matchIdx !== -1) {
      usedIndices.add(matchIdx);
      updatedCount++;
      const current = resultDrivers[matchIdx];
      const history: ProgramEntry[] = [...(current.programmeHistorique || [])];
      const sameDayImport =
        Boolean(current.programmeDate) && current.programmeDate!.slice(0, 10) === todayKey;

      const prevProg = (current.programmeJour || current.circuitActuel || '').trim();
      const prevIsStandby = !prevProg || prevProg.toUpperCase() === 'STAND-BY';

      // Archiver l'ancienne caisse dans l'historique si ce n'est pas un ré-import le même jour
      if (!sameDayImport) {
        if (current.statut === 'NON PAYE') {
          const histCircuit = !prevIsStandby ? prevProg : 'ANCIENNE CAISSE (STAND-BY)';
          const alreadyArchived = history.some(
            (h) => !h.paid && h.circuit === histCircuit && h.date === (current.programmeDate || current.dateDerniere)
          );
          if (!alreadyArchived) {
            history.unshift({
              id: `PRG-${Date.now()}-${rowIdx}`,
              date: current.programmeDate || current.dateDerniere || nowIso,
              circuit: histCircuit,
              paid: false,
            });
          }
        } else if (!prevIsStandby && current.statut === 'PAYE') {
          history.unshift({
            id: `PRG-${Date.now()}-${rowIdx}`,
            date: current.programmeDate || current.dateDerniere || nowIso,
            circuit: prevProg,
            paid: true,
          });
        }
      }

      const unpaidHistoryCount = history.filter((h) => !h.paid).length;
      const nextStatut: DriverStatus = !isStandby
        ? 'NON PAYE'
        : unpaidHistoryCount > 0
        ? 'NON PAYE'
        : 'PAS DE CAISSE';
      const nextCaissesDues = unpaidHistoryCount + (!isStandby ? 1 : 0);

      const displayNom = cleanNom
        ? cleanTr && !cleanNom.endsWith(cleanTr)
          ? `${cleanNom} ${cleanTr}`
          : cleanNom
        : current.nom;

      const updatedDriver: Driver = {
        ...current,
        nom: displayNom,
        tr: cleanTr || current.tr,
        programmeJour: cleanCircuit,
        circuitActuel: cleanCircuit,
        programmeDate: nowIso,
        programmeHistorique: history.slice(0, 60),
        statut: nextStatut,
        caissesDues: nextCaissesDues,
      };
      const { reclamation } = recalculateReclamation(updatedDriver);
      updatedDriver.reclamation = reclamation;
      resultDrivers[matchIdx] = updatedDriver;
    } else {
      // Nouveau chauffeur (ou nouvelle ligne de programme) absent de la base -> création automatique !
      createdCount++;
      let assignedTr = cleanTr;
      if (!assignedTr) {
        maxTrNum += 1;
        assignedTr = String(maxTrNum);
      }
      const nextStatut: DriverStatus = isStandby ? 'PAS DE CAISSE' : 'NON PAYE';
      const displayNom = cleanNom || `CHAUFFEUR ${assignedTr}`;

      const newDriver: Driver = {
        id: `DRV-PRG-${assignedTr}-${rowIdx}`,
        nom: displayNom,
        tr: assignedTr,
        statut: nextStatut,
        dateDerniere: nowIso,
        programmeDate: nowIso,
        programmeJour: cleanCircuit,
        circuitActuel: cleanCircuit,
        programmeHistorique: [],
        caissesDues: isStandby ? 0 : 1,
        reclamation: '',
      };
      const { reclamation } = recalculateReclamation(newDriver);
      newDriver.reclamation = reclamation;
      resultDrivers.push(newDriver);
      usedIndices.add(resultDrivers.length - 1);
    }
  });

  const uniqueProgrammes = new Set(
    resultDrivers.map((d) => (d.programmeJour || 'STAND-BY').trim().toUpperCase()).filter(Boolean)
  );

  return {
    drivers: resultDrivers,
    updatedCount,
    createdCount,
    totalProgrammes: uniqueProgrammes.size,
  };
}
