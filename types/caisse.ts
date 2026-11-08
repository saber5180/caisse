export type DriverStatus = 'NON PAYE' | 'PAYE' | 'PAS DE CAISSE';

export interface Driver {
  id: string;
  nom: string;
  tr: string; // Driver code / scanner ID (e.g. "37", "34", "107")
  statut: DriverStatus;
  dateDerniere: string; // ISO date string
  reclamation: string; // e.g. "ALERTE NON PAYE CAISSE SFAX 1 DEPUIS 64 JOURS"
  caissesDues: number; // 0, 1, or special codes
  programmeJour: string; // Assigned circuit, e.g. "SFAX 1", "DJERBA 2", "STAND-BY"
  circuitActuel?: string;
  // Champs pour le suivi des bordereaux et mouvements
  serie?: string; // e.g. "S-01", "A"
  sousSerie?: string; // e.g. "SS-01", "1"
  montantBordereau?: number; // Montant théorique calculé des bordereaux saisis
  mouvementCaisse?: number; // État réel de mouvement de caisse (encaissé)
  ecartBordereau?: number; // Écart automatique (montantBordereau - mouvementCaisse)
}

export interface CashDeskRow {
  denomination: number; // 20, 10, 50, 5, 5, 1, 1, 1, 1
  label?: string;
  entree: number; // Nombre de billets/pièces entrés
  sortie: number; // Nombre de billets/pièces sortis
}

export type DeskRow = CashDeskRow;

export interface CashTransaction {
  id: string;
  date: string; // ISO string
  codeChauffeur?: string;
  nomChauffeur?: string;
  recette: number; // Montant théorique attendu
  tPayer: number; // Montant réel encaissé (Total = MT Espèce + Versement)
  mtEspece?: number; // Montant Espèces net (tPayer - versement)
  resAPayer: number; // Écart (tPayer - recette)
  versement: number; // Versement bancaire / coffre
  status: string;
  caisseCode?: string; // 'CRNU' | 'CRSF' | 'CRTN' | 'ADMIN'
  caisseName?: string;
  accountId?: string;
  rows?: CashDeskRow[];
  rawData?: any;
}

export type TransactionRecord = CashTransaction;

export interface CoinBreakdownItem {
  valeur: number; // 0.050, 0.100, etc.
  label?: string;
  isBillet?: boolean;
  nombre: number;
}

export type BilletterieItem = CoinBreakdownItem;

export interface BilletterieReport {
  items: CoinBreakdownItem[];
  srfMoins: number; // Retenues SRF-
  ver: number; // Versements
  recetteTheorique: number;
}

export interface BilletterieHistoryEntry {
  id: string;
  accountId?: string;
  caisseCode?: string;
  caisseName?: string;
  dateCloture: string;
  totalCoupures: number;
  srfPieces: number;
  srfMoins: number;
  ver: number;
  ttPhysique: number;
  recetteTheorique: number;
  ecartReste: number;
  items: CoinBreakdownItem[];
  archivedTransactions?: CashTransaction[];
  caissierNom?: string;
  notes?: string;
  createdAt?: string;
}

export interface CaisseLiveSummary {
  accountId: string;
  caisseCode: 'CRNU' | 'CRSF' | 'CRTN';
  displayName: string;
  username: string;
  isBlocked: boolean;
  forceLogoutAt?: string | null;
  updatedAt?: string | null;
  // Montants actuels en temps réel (Journal du jour)
  montantActuel: number; // Total encaissé (MT Espèce + Versement)
  mtEspece: number; // Montant Espèces (MT Espèce)
  versement: number; // Montant Versements
  recetteAttendue: number;
  ecart: number;
  nbTransactions: number;
  // Historique des clôtures pour cette caisse
  totalCloture: number;
  totalClotureEspece: number;
  totalClotureVersement: number;
  nbClotures: number;
}
