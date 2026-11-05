import { Driver, DriverStatus } from '@/types/caisse';
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

export function recalculateReclamation(driver: Pick<Driver, 'statut' | 'dateDerniere' | 'programmeJour' | 'circuitActuel'>): {
  reclamation: string;
  isAlert: boolean;
  isUrgent: boolean;
} {
  const { days, text } = calculateElapsed(driver.dateDerniere);
  const circuit = driver.programmeJour || driver.circuitActuel || 'STAND-BY';

  if (driver.statut === 'PAYE') {
    return {
      reclamation: `Réglé (${circuit}) · depuis ${text}`,
      isAlert: false,
      isUrgent: false,
    };
  }

  if (driver.statut === 'PAS DE CAISSE') {
    return {
      reclamation: `Sans caisse (${circuit}) · depuis ${text}`,
      isAlert: false,
      isUrgent: false,
    };
  }

  // NON PAYE
  const isUrgent = days >= 1;
  return {
    reclamation: `Impayé (${circuit}) · retard: ${text}`,
    isAlert: true,
    isUrgent,
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

