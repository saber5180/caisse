import { create } from 'zustand';
import {
  Driver,
  DriverStatus,
  CashDeskRow,
  CashTransaction,
  CoinBreakdownItem,
  CaisseLiveSummary,
} from '@/types/caisse';
import { INITIAL_DRIVERS } from '@/data/initialDrivers';
import { DEFAULT_PROGRAMME_EXCEL_ROWS } from '@/data/programmeJourDefault';
import {
  recalculateReclamation,
  generateId,
  cleanScannerTr,
  applyProgrammeRowsToFleet,
  getGuichetCaisses,
  normalizeCaisseCode,
  ProgrammeImportError,
} from './utils';

export const DEFAULT_DESK_ROWS: CashDeskRow[] = [
  { denomination: 20, entree: 0, sortie: 0 },
  { denomination: 10, entree: 0, sortie: 0 },
  { denomination: 50, entree: 0, sortie: 0 },
  { denomination: 5, entree: 0, sortie: 0 },
  { denomination: 5, entree: 0, sortie: 0 },
  { denomination: 1, entree: 0, sortie: 0 },
  { denomination: 1, entree: 0, sortie: 0 },
  { denomination: 1, entree: 0, sortie: 0 },
  { denomination: 1, entree: 0, sortie: 0 },
];

export const DEFAULT_BILLETTERIE_ITEMS: CoinBreakdownItem[] = [
  { valeur: 0.050, label: '0,050 TND (Pièce)', isBillet: false, nombre: 0 },
  { valeur: 0.100, label: '0,100 TND (Pièce)', isBillet: false, nombre: 0 },
  { valeur: 0.200, label: '0,200 TND (Pièce)', isBillet: false, nombre: 0 },
  { valeur: 0.500, label: '0,500 TND (Pièce)', isBillet: false, nombre: 0 },
  { valeur: 1.000, label: '1,000 TND (Pièce)', isBillet: false, nombre: 0 },
  { valeur: 2.000, label: '2,000 TND (Pièce)', isBillet: false, nombre: 0 },
  { valeur: 5.000, label: '5,000 TND (Pièce)', isBillet: false, nombre: 0 },
  { valeur: 10.000, label: '10,000 TND (Billet)', isBillet: true, nombre: 0 },
  { valeur: 20.000, label: '20,000 TND (Billet)', isBillet: true, nombre: 0 },
  { valeur: 50.000, label: '50,000 TND (Billet)', isBillet: true, nombre: 0 },
  { valeur: 5.000, label: '5,000 TND (Billet)', isBillet: true, nombre: 0 },
];

export function computeDeskTotals(rows: CashDeskRow[], versement: number, recette: number) {
  const tPayer = rows.reduce((sum, r) => {
    return sum + (r.entree * r.denomination) - (r.sortie * r.denomination);
  }, 0) + versement;

  const resAPayer = tPayer - recette;
  return { tPayer, resAPayer };
}

export interface CurrentUser {
  id: string;
  username: string;
  displayName: string;
  role: string;
  caisseCode?: string;
  isBlocked?: boolean;
  customDbUrl?: string | null;
}

let syncTimeout: any = null;

interface CaisseStore {
  // Auth & Account
  currentUser: CurrentUser | null;
  setCurrentUser: (user: CurrentUser | null) => void;
  isSyncing: boolean;
  lastSyncTime: string | null;
  fetchAccountData: () => Promise<void>;
  syncToBackend: (syncDrivers?: boolean) => Promise<void>;
  resetStoreForAccount: () => void;
  controlCaisse: (accountId: string, action: 'block' | 'unblock' | 'force_logout') => Promise<void>;

  // Multi-Caisse Real-Time Summary (CRNU, CRSF, CRTN)
  caissesSummary: CaisseLiveSummary[];
  allTransactions: CashTransaction[];

  // Drivers
  drivers: Driver[];
  selectedDriverId: string | null;
  searchQuery: string;
  statusFilter: DriverStatus | 'ALL';

  // Cash Desk (Guichet de Caisse)
  deskRows: CashDeskRow[];
  deskRecette: number;
  deskVersement: number;
  deskVersementBanque: number;
  deskVersementCoffre: number;
  deskTrInput: string;
  feedbackMessage: { type: 'success' | 'error' | 'info'; text: string } | null;

  // Billetterie
  billetterieItems: CoinBreakdownItem[];
  srfMoins: number;
  ver: number;
  recettePhysiqueTheorique: number;
  cycleBordereaux: number;

  // History (Feuil2)
  transactions: CashTransaction[];

  // Actions - Desk
  setDeskEntree: (index: number, val: number) => void;
  setDeskSortie: (index: number, val: number) => void;
  setDeskRecette: (val: number) => void;
  setDeskVersement: (val: number) => void;
  setDeskVersementBanque: (val: number) => void;
  setDeskVersementCoffre: (val: number) => void;
  setDeskTrInput: (val: string) => void;
  selectDriverByTr: (tr: string) => Driver | null;
  selectDriverById: (id: string | null) => Driver | null;
  validateCurrentSale: (targetEntryId?: string) => CashTransaction | null;
  resetDesk: () => void;
  updateJournalTransaction: (
    tx: CashTransaction,
    patch: { recette: number; mtEspece: number; versement: number }
  ) => Promise<{ ok: boolean; error?: string }>;
  clearFeedback: () => void;

  // Actions - Drivers
  setSearchQuery: (q: string) => void;
  setStatusFilter: (f: DriverStatus | 'ALL') => void;
  updateDriverStatus: (id: string, status: DriverStatus) => void;
  updateDriver: (
    id: string,
    patch: Partial<Pick<Driver, 'nom' | 'tr' | 'statut' | 'programmeJour' | 'circuitActuel' | 'caissesDues' | 'serie' | 'sousSerie' | 'montantBordereau'>>
  ) => void;
  assignCircuit: (id: string, circuit: string) => void;
  placeDriverOnDayProgramme: (id: string, circuit: string) => void;
  deleteDriver: (id: string) => void;
  addDriver: (driver: Omit<Driver, 'id' | 'reclamation'>) => void;
  executeBascule1230: () => void;
  importProgramme: (rows: { nom?: string; tr?: string; circuit: string }[]) => {
    updatedCount: number;
    createdCount: number;
    totalProgrammes: number;
    errors: ProgrammeImportError[];
  };
  loadDefaultProgrammeExcel: () => void;
  markProgramEntryPaid: (driverId: string, entryId: string) => void;
  deleteProgramEntry: (driverId: string, entryId: string) => void;
  resetAllDriversStatus: (status: DriverStatus) => void;
  refreshAlarms: () => void;
  loadDemoDriversTemplate: () => void;
  cloturerJournee: () => void;

  // Actions - Billetterie
  setBilletterieCount: (index: number, count: number) => void;
  setSrfMoins: (val: number) => void;
  setVer: (val: number) => void;
  setRecettePhysiqueTheorique: (val: number) => void;
}

export const useCaisseStore = create<CaisseStore>()((set, get) => {
  let hasPendingSync = false;
  let hasPendingDriverSync = false;
  let hasInitialLoaded = false;
  let pendingRemovedDriverIds: string[] = [];

  const triggerDebouncedSync = (includeDrivers = false) => {
    if (get().currentUser?.role === 'superviseur') return;
    hasPendingSync = true;
    if (includeDrivers) hasPendingDriverSync = true;
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      get().syncToBackend(hasPendingDriverSync);
    }, 500);
  };

  const triggerImmediateSync = (includeDrivers = true) => {
    if (get().currentUser?.role === 'superviseur') return;
    hasPendingSync = true;
    if (includeDrivers) hasPendingDriverSync = true;
    else hasPendingDriverSync = false;
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = null;
    }
    void get().syncToBackend(includeDrivers);
  };

  const blankState = {
    drivers: [] as Driver[],
    caissesSummary: [] as CaisseLiveSummary[],
    allTransactions: [] as CashTransaction[],
    selectedDriverId: null,
    searchQuery: '',
    statusFilter: 'ALL' as const,
    deskRows: DEFAULT_DESK_ROWS,
    deskRecette: 0,
    deskVersement: 0,
    deskVersementBanque: 0,
    deskVersementCoffre: 0,
    deskTrInput: '',
    feedbackMessage: null,
    billetterieItems: DEFAULT_BILLETTERIE_ITEMS,
    srfMoins: 0,
    ver: 0,
    recettePhysiqueTheorique: 0,
    cycleBordereaux: 0,
    transactions: [] as CashTransaction[],
    lastSyncTime: null,
  };

  return {
    // Auth State
    currentUser: null,
    setCurrentUser: (user) => {
      if (!user) {
        hasPendingSync = false;
        hasPendingDriverSync = false;
        hasInitialLoaded = false;
        pendingRemovedDriverIds = [];
        set({ currentUser: null, ...blankState });
      } else {
        set({ currentUser: user });
      }
    },
    isSyncing: false,
    lastSyncTime: null,
    caissesSummary: [],
    allTransactions: [],

    resetStoreForAccount: () => {
      hasPendingSync = false;
      hasPendingDriverSync = false;
      hasInitialLoaded = false;
      pendingRemovedDriverIds = [];
      set(blankState);
    },

    controlCaisse: async (accountId, action) => {
      try {
        set({ isSyncing: true });
        const res = await fetch('/api/superviseur/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accountId, action }),
        });
        const json = await res.json();
        if (!res.ok) {
          set({
            feedbackMessage: {
              type: 'error',
              text: json.error || 'Erreur lors du contrôle à distance',
            },
          });
          return;
        }
        set({
          feedbackMessage: {
            type: 'success',
            text: json.message || 'Action exécutée avec succès',
          },
        });
        await get().fetchAccountData();
      } catch (e: any) {
        set({
          feedbackMessage: {
            type: 'error',
            text: e?.message || 'Erreur réseau',
          },
        });
      } finally {
        set({ isSyncing: false });
      }
    },

    fetchAccountData: async () => {
      if (hasPendingSync) return;
      try {
        set({ isSyncing: true });
        const res = await fetch('/api/caisse/data', { cache: 'no-store' });
        if (res.status === 401 || res.status === 403) {
          const errJson = await res.json().catch(() => ({}));
          if (errJson.reason === 'blocked' || errJson.reason === 'force_logout') {
            hasPendingSync = false;
            hasPendingDriverSync = false;
            hasInitialLoaded = false;
            set({ currentUser: null, ...blankState });
            if (typeof window !== 'undefined') {
              window.location.href = `/login?reason=${errJson.reason}`;
            }
            return;
          }
        }
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data && !hasPendingSync) {
            const {
              drivers,
              transactions,
              allTransactions,
              caissesSummary,
              billetterie,
              deskState,
              cycleBordereaux,
            } = json.data;
            const normalizedDrivers: Driver[] = Array.isArray(drivers)
              ? drivers.map((d: Driver) => {
                  const { reclamation } = recalculateReclamation(d);
                  return { ...d, reclamation };
                })
              : [];

            const rawBilletterie = (billetterie?.items || DEFAULT_BILLETTERIE_ITEMS)
              .filter((item: CoinBreakdownItem) => Math.abs(item.valeur - 0.020) > 0.001);

            const firstLoad = !hasInitialLoaded;
            hasInitialLoaded = true;
            const baseUpdate: Partial<CaisseStore> = {
              drivers: normalizedDrivers,
              transactions: Array.isArray(transactions) ? transactions : [],
              allTransactions: Array.isArray(allTransactions)
                ? allTransactions
                : Array.isArray(transactions)
                ? transactions
                : [],
              caissesSummary: Array.isArray(caissesSummary) ? caissesSummary : [],
              lastSyncTime: new Date().toLocaleTimeString('fr-FR'),
              cycleBordereaux: Number(cycleBordereaux) || 0,
              billetterieItems: rawBilletterie,
              srfMoins: billetterie?.srfMoins ?? 0,
              ver: billetterie?.ver ?? 0,
              recettePhysiqueTheorique: billetterie?.recetteTheorique ?? 0,
              deskRows: deskState?.deskRows || DEFAULT_DESK_ROWS.map((row) => ({ ...row })),
              deskRecette: deskState?.deskRecette ?? 0,
              deskVersement: deskState?.deskVersement ?? 0,
            };

            if (firstLoad) {
              // Ne jamais sélectionner de chauffeur par défaut ("0" ou autre) au chargement
              baseUpdate.deskTrInput = '';
              baseUpdate.selectedDriverId = null;
            }

            set(baseUpdate);
          }
        }
      } catch (e) {
        console.error('Fetch account data error:', e);
      } finally {
        set({ isSyncing: false });
      }
    },

    syncToBackend: async (syncDrivers = false) => {
      if (get().currentUser?.role === 'superviseur') {
        hasPendingSync = false;
        hasPendingDriverSync = false;
        return;
      }
      try {
        set({ isSyncing: true });
        const payload: any = {
          transactions: get().transactions,
          billetterie: {
            items: get().billetterieItems,
            srfMoins: get().srfMoins,
            ver: get().ver,
            recetteTheorique: get().recettePhysiqueTheorique,
          },
          deskState: {
            deskRows: get().deskRows,
            deskRecette: get().deskRecette,
            deskVersement: get().deskVersement,
            deskTrInput: get().deskTrInput,
            selectedDriverId: get().selectedDriverId,
          },
        };

        const removedSnapshot = pendingRemovedDriverIds.slice();
        const fleetReady = hasInitialLoaded && get().drivers.length > 0;
        if ((syncDrivers || hasPendingDriverSync) && fleetReady) {
          payload.drivers = get().drivers;
        }
        if (removedSnapshot.length > 0) {
          payload.removedDriverIds = removedSnapshot;
        }

        const res = await fetch('/api/caisse/data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.status === 401 || res.status === 403) {
          const errJson = await res.json().catch(() => ({}));
          if (errJson.reason === 'blocked' || errJson.reason === 'force_logout') {
            hasPendingSync = false;
            hasPendingDriverSync = false;
            set({ currentUser: null, ...blankState });
            if (typeof window !== 'undefined') {
              window.location.href = `/login?reason=${errJson.reason}`;
            }
            return;
          }
        }

        if (res.ok) {
          hasPendingSync = false;
          hasPendingDriverSync = false;
          pendingRemovedDriverIds = pendingRemovedDriverIds.filter((id) => !removedSnapshot.includes(id));
          set({ lastSyncTime: new Date().toLocaleTimeString('fr-FR') });
          // Refresh multi-caisse summary & global driver states
          void get().fetchAccountData();
        } else {
          console.error('Sync failed with status:', res.status);
        }
      } catch (e) {
        console.error('Sync to backend error:', e);
      } finally {
        set({ isSyncing: false });
      }
    },

    // Drivers
    drivers: [],
    selectedDriverId: null,
    searchQuery: '',
    statusFilter: 'ALL',

    // Cash Desk
    deskRows: DEFAULT_DESK_ROWS,
    deskRecette: 0,
    deskVersement: 0,
    deskVersementBanque: 0,
    deskVersementCoffre: 0,
    deskTrInput: '',
    feedbackMessage: null,

    // Billetterie
    billetterieItems: DEFAULT_BILLETTERIE_ITEMS,
    srfMoins: 0,
    ver: 0,
    recettePhysiqueTheorique: 0,
    cycleBordereaux: 0,

    // History
    transactions: [],

    // Desk Actions
    setDeskEntree: (index, val) => {
      set((state) => {
        const next = [...state.deskRows];
        next[index] = { ...next[index], entree: Math.max(0, val) };
        return { deskRows: next };
      });
      triggerDebouncedSync();
    },

    setDeskSortie: (index, val) => {
      set((state) => {
        const next = [...state.deskRows];
        next[index] = { ...next[index], sortie: Math.max(0, val) };
        return { deskRows: next };
      });
      triggerDebouncedSync();
    },

    setDeskRecette: (val) => {
      set({ deskRecette: Math.max(0, val) });
      triggerDebouncedSync();
    },

    setDeskVersement: (val) => {
      const v = Math.max(0, val);
      set({ deskVersement: v, deskVersementBanque: v, deskVersementCoffre: 0 });
      triggerDebouncedSync();
    },

    setDeskVersementBanque: (val) => {
      set((state) => {
        const v = Math.max(0, val);
        const total = Math.round((v + state.deskVersementCoffre) * 1000) / 1000;
        return { deskVersementBanque: v, deskVersement: total };
      });
      triggerDebouncedSync();
    },

    setDeskVersementCoffre: (val) => {
      set((state) => {
        const v = Math.max(0, val);
        const total = Math.round((state.deskVersementBanque + v) * 1000) / 1000;
        return { deskVersementCoffre: v, deskVersement: total };
      });
      triggerDebouncedSync();
    },

    setDeskTrInput: (val) => set({ deskTrInput: val }),

    selectDriverById: (id) => {
      if (!id) {
        set({ selectedDriverId: null, deskTrInput: '' });
        return null;
      }
      const found = get().drivers.find((d) => d.id === id);
      if (found) {
        const nextRecette =
          get().deskRecette === 0 && found.montantBordereau && found.montantBordereau > 0
            ? found.montantBordereau
            : get().deskRecette;
        set({
          selectedDriverId: found.id,
          deskTrInput: found.tr,
          deskRecette: nextRecette,
          feedbackMessage: {
            type: 'success',
            text: `Chauffeur sélectionné : ${found.nom} (TR ${found.tr}) - Circuit: ${found.programmeJour || 'STAND-BY'}`,
          },
        });
        triggerDebouncedSync();
        return found;
      }
      return null;
    },

    selectDriverByTr: (tr) => {
      if (!tr || !tr.trim()) {
        set({ selectedDriverId: null, deskTrInput: '' });
        return null;
      }
      // Supprime un éventuel préfixe "TR" (ex: "TR 37" -> "37") et les "0" au début ("037" -> "37")
      const stripped = tr.trim().replace(/^tr\s*/i, '');
      const cleanTr = cleanScannerTr(stripped).toUpperCase();
      const allDrivers = get().drivers;

      const found =
        allDrivers.find((d) => cleanScannerTr(d.tr).toUpperCase() === cleanTr) ||
        allDrivers.find((d) => d.tr.trim().toUpperCase() === stripped.toUpperCase()) ||
        allDrivers.find((d) => d.nom.toUpperCase().includes(stripped.toUpperCase()));

      if (found) {
        const nextRecette =
          get().deskRecette === 0 && found.montantBordereau && found.montantBordereau > 0
            ? found.montantBordereau
            : get().deskRecette;
        set({
          selectedDriverId: found.id,
          deskTrInput: found.tr,
          deskRecette: nextRecette,
          feedbackMessage: {
            type: 'success',
            text: `Chauffeur sélectionné : ${found.nom} (TR ${found.tr}) - Circuit: ${found.programmeJour || 'STAND-BY'}`,
          },
        });
        triggerDebouncedSync();
        return found;
      } else {
        set({
          selectedDriverId: null,
          feedbackMessage: {
            type: 'error',
            text: `Chauffeur introuvable avec le code ou nom : "${tr}"`,
          },
        });
        return null;
      }
    },

    validateCurrentSale: (targetEntryId?: string) => {
      const {
        deskRows,
        deskVersement,
        deskVersementBanque,
        deskVersementCoffre,
        deskRecette,
        selectedDriverId,
        drivers,
        billetterieItems,
        ver,
        recettePhysiqueTheorique,
      } = get();
      const { tPayer, resAPayer } = computeDeskTotals(deskRows, deskVersement, deskRecette);

      const driver = drivers.find((d) => d.id === selectedDriverId);
      if (!driver) {
        set({
          feedbackMessage: {
            type: 'error',
            text: 'Validation impossible : veuillez scanner ou sélectionner un chauffeur.',
          },
        });
        return null;
      }

      const dues = getGuichetCaisses(driver, drivers);
      if (dues.length === 0) {
        set({
          feedbackMessage: {
            type: 'error',
            text: 'Aucune caisse à encaisser',
          },
        });
        return null;
      }
      const entryToPay = dues.find((u) => u.id === targetEntryId) || dues[0];
      const entryIdToPay = entryToPay.id;

      const currentUser = get().currentUser;
      const mtEspece = Math.round((tPayer - deskVersement) * 1000) / 1000;

      const newTransaction: CashTransaction = {
        id: generateId('TRX'),
        date: new Date().toISOString(),
        codeChauffeur: driver.tr,
        nomChauffeur: driver.nom,
        recette: deskRecette,
        tPayer,
        mtEspece,
        resAPayer,
        versement: deskVersement,
        status: resAPayer >= 0 ? 'PAYE' : 'NON PAYE',
        caisseCode: currentUser?.caisseCode || currentUser?.username?.toUpperCase() || 'CAISSE',
        caisseName: currentUser?.displayName || 'Caisse',
        accountId: currentUser?.id,
        rawData: {
          rows: deskRows,
          versement: deskVersement,
          versementBanque: deskVersementBanque,
          versementCoffre: deskVersementCoffre,
          recette: deskRecette,
        },
      };

      const updatedDrivers = drivers.map((d) => {
        if (d.id === driver.id) {
          const nowIso = new Date().toISOString();
          if (resAPayer < 0) {
            const updated: Driver = {
              ...d,
              statut: 'NON PAYE',
              dateDerniere: nowIso,
              caissesDues: Math.max(1, d.caissesDues || 1),
            };
            const { reclamation } = recalculateReclamation(updated);
            return { ...updated, reclamation };
          }

          let nextHist = [...(d.programmeHistorique || [])];
          const prog = (d.programmeJour || d.circuitActuel || '').trim();
          const isStandby =
            !prog || prog.toUpperCase() === 'STAND-BY' || prog.toUpperCase() === 'STANDBY';
          let jourPaye = Boolean(d.jourPaye);
          let caissePaye = d.caissePaye || '';
          let payeLe = d.payeLe;
          const paidAt = normalizeCaisseCode(
            currentUser?.caisseCode || currentUser?.username
          );

          if (entryIdToPay !== 'CURRENT' && entryIdToPay !== 'STANDBY-UNPAID') {
            nextHist = nextHist.map((e) =>
              e.id === entryIdToPay ? { ...e, paid: true, caisseCode: paidAt || e.caisseCode } : e
            );
            caissePaye = paidAt || caissePaye;
            payeLe = nowIso;
          } else if (!isStandby) {
            jourPaye = true;
            caissePaye = paidAt || caissePaye;
            payeLe = nowIso;
          } else if (nextHist.some((e) => !e.paid)) {
            let markedOne = false;
            nextHist = nextHist.map((e) => {
              if (!markedOne && !e.paid) {
                markedOne = true;
                return { ...e, paid: true, caisseCode: paidAt || e.caisseCode };
              }
              return e;
            });
            caissePaye = paidAt || caissePaye;
            payeLe = nowIso;
          }

          const remainingUnpaidHist = nextHist.filter((e) => !e.paid).length;
          const todayStillDue = !isStandby && !jourPaye;
          const nextCaissesDues = remainingUnpaidHist + (todayStillDue ? 1 : 0);
          const nextStatut: DriverStatus =
            nextCaissesDues > 0 ? 'NON PAYE' : isStandby ? 'PAS DE CAISSE' : 'PAYE';

          const updated: Driver = {
            ...d,
            programmeHistorique: nextHist,
            jourPaye,
            caissePaye,
            payeLe,
            statut: nextStatut,
            dateDerniere: nowIso,
            caissesDues: nextCaissesDues,
          };
          const { reclamation } = recalculateReclamation(updated);
          return { ...updated, reclamation };
        }
        return d;
      });

      // Update billetterie items counts ONLY for Billets (isBillet === true).
      // Les Pièces (0,050 / 0,100 / 0,200 / 0,500 / 1,000 / 2,000 / 5,000 TND Pièce) ne sont JAMAIS versées automatiquement (saisie manuelle).
      const updatedBilletterieItems = billetterieItems.map((bItem) => ({ ...bItem }));
      deskRows.forEach((row, idx) => {
        // L'index 4 est le 2ème champ 5 TND ("5 TND Pièce") et les coupures de 1 TND sont des pièces : ne pas les verser en billetterie
        const isPieceRow = idx === 4 || row.denomination < 5;
        if (isPieceRow) return;

        const netCount = (row.entree || 0) - (row.sortie || 0);
        if (netCount !== 0) {
          const matchIdx = updatedBilletterieItems.findIndex(
            (b) => b.isBillet && Math.abs(b.valeur - row.denomination) < 0.001
          );
          if (matchIdx !== -1) {
            const currentItem = updatedBilletterieItems[matchIdx];
            const newTotalCount = Math.max(0, Math.round((currentItem.nombre + netCount) * 100) / 100);
            updatedBilletterieItems[matchIdx] = {
              ...currentItem,
              nombre: newTotalCount,
            };
          }
        }
      });

      // Add sale's versement into Comptage Billetterie's ver
      const updatedVer = Math.max(0, Math.round(((ver || 0) + deskVersement) * 1000) / 1000);

      // Add theoretical receipt into Comptage Billetterie's recetteTheorique
      const updatedRecetteTheorique = Math.max(0, Math.round(((recettePhysiqueTheorique || 0) + deskRecette) * 1000) / 1000);

      set((state) => ({
        transactions: [newTransaction, ...state.transactions],
        drivers: updatedDrivers,
        billetterieItems: updatedBilletterieItems,
        ver: updatedVer,
        recettePhysiqueTheorique: updatedRecetteTheorique,
        deskRows: DEFAULT_DESK_ROWS,
        deskVersement: 0,
        deskVersementBanque: 0,
        deskVersementCoffre: 0,
        deskRecette: 0,
        selectedDriverId: null,
        deskTrInput: '',
        feedbackMessage: {
          type: 'success',
          text: `Encaissement validé pour ${driver.nom} (${tPayer.toFixed(3)} TND) ! Billetterie mise à jour (+${deskVersement.toFixed(3)} TND versement).`,
        },
      }));

      triggerImmediateSync();
      return newTransaction;
    },

    resetDesk: () => {
      set({
        deskRows: DEFAULT_DESK_ROWS,
        deskVersement: 0,
        deskVersementBanque: 0,
        deskVersementCoffre: 0,
        deskRecette: 0,
        selectedDriverId: null,
        deskTrInput: '',
        feedbackMessage: {
          type: 'info',
          text: 'Guichet de caisse réinitialisé.',
        },
      });
      triggerImmediateSync(false);
    },

    updateJournalTransaction: async (tx, patch) => {
      const round3 = (n: number) => Math.round(n * 1000) / 1000;
      const recette = round3(Math.max(0, patch.recette));
      const mtEspece = round3(Math.max(0, patch.mtEspece));
      const versement = round3(Math.max(0, patch.versement));
      const tPayer = round3(mtEspece + versement);
      const resAPayer = round3(tPayer - recette);
      const status = resAPayer >= 0 ? 'PAYE' : 'NON PAYE';
      const ownerId = tx.accountId || get().currentUser?.id || '';

      const applyLocal = (t: CashTransaction): CashTransaction => {
        if (t.id !== tx.id) return t;
        if ((t.accountId || '') !== (tx.accountId || '') && t.accountId && tx.accountId) return t;
        return {
          ...t,
          recette,
          mtEspece,
          versement,
          tPayer,
          resAPayer,
          status,
          rawData: {
            ...(t.rawData || {}),
            recette,
            versement,
          },
        };
      };

      const previous = get().transactions;
      const previousAll = get().allTransactions;
      set((state) => ({
        transactions: state.transactions.map(applyLocal),
        allTransactions: state.allTransactions.map(applyLocal),
      }));

      try {
        const res = await fetch('/api/caisse/transactions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: tx.id,
            accountId: ownerId,
            recette,
            mtEspece,
            versement,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          set({
            transactions: previous,
            allTransactions: previousAll,
            feedbackMessage: {
              type: 'error',
              text: json.error || 'Modification impossible.',
            },
          });
          return { ok: false, error: json.error || 'Modification impossible.' };
        }

        const isOwn = !tx.accountId || tx.accountId === get().currentUser?.id;
        if (isOwn) {
          const deltaVer = versement - (tx.versement || 0);
          const deltaRecette = recette - (tx.recette || 0);
          set((state) => ({
            ver: Math.max(0, round3((state.ver || 0) + deltaVer)),
            recettePhysiqueTheorique: Math.max(
              0,
              round3((state.recettePhysiqueTheorique || 0) + deltaRecette)
            ),
          }));
        }

        set({
          feedbackMessage: {
            type: 'success',
            text: `Ligne ${tx.codeChauffeur || tx.id} mise à jour (${tPayer.toFixed(3)} TND).`,
          },
        });
        return { ok: true };
      } catch (e: any) {
        set({
          transactions: previous,
          allTransactions: previousAll,
          feedbackMessage: {
            type: 'error',
            text: e?.message || 'Erreur réseau lors de la modification.',
          },
        });
        return { ok: false, error: e?.message || 'Erreur réseau' };
      }
    },

    clearFeedback: () => set({ feedbackMessage: null }),

    // Drivers Actions
    setSearchQuery: (q) => set({ searchQuery: q }),
    setStatusFilter: (f) => set({ statusFilter: f }),

    updateDriverStatus: (id, status) => {
      set((state) => {
        const updated = state.drivers.map((d) => {
          if (d.id === id) {
            const nowStr = new Date().toISOString();
            const u: Driver = {
              ...d,
              statut: status,
              dateDerniere: nowStr,
              caissesDues: status === 'NON PAYE' ? 1 : 0,
            };
            const { reclamation } = recalculateReclamation(u);
            return { ...u, reclamation };
          }
          return d;
        });

        return {
          drivers: updated,
          feedbackMessage: {
            type: 'success',
            text: `Statut mis à jour : ${status}`,
          },
        };
      });
      triggerImmediateSync();
    },

    updateDriver: (id, patch) => {
      set((state) => {
        const updated = state.drivers.map((d) => {
          if (d.id === id) {
            const nextStatut = patch.statut ?? d.statut;
            const nextCircuit =
              patch.programmeJour !== undefined ? patch.programmeJour : d.programmeJour;
            const u: Driver = {
              ...d,
              ...patch,
              statut: nextStatut,
              programmeJour: nextCircuit,
              circuitActuel:
                patch.circuitActuel !== undefined ? patch.circuitActuel : nextCircuit,
              caissesDues:
                patch.caissesDues !== undefined
                  ? patch.caissesDues
                  : nextStatut === 'NON PAYE'
                  ? Math.max(1, d.caissesDues)
                  : 0,
            };
            const { reclamation } = recalculateReclamation(u);
            return { ...u, reclamation };
          }
          return d;
        });

        return {
          drivers: updated,
          feedbackMessage: {
            type: 'success',
            text: 'Fiche chauffeur mise à jour et synchronisée.',
          },
        };
      });
      triggerImmediateSync();
    },

    assignCircuit: (id, circuit) => {
      set((state) => {
        const updated = state.drivers.map((d) => {
          if (d.id === id) {
            const u: Driver = {
              ...d,
              programmeJour: circuit,
              circuitActuel: circuit,
            };
            const { reclamation } = recalculateReclamation(u);
            return { ...u, reclamation };
          }
          return d;
        });

        return {
          drivers: updated,
          feedbackMessage: {
            type: 'success',
            text: `Circuit "${circuit}" attribué au chauffeur.`,
          },
        };
      });
      triggerImmediateSync();
    },

    placeDriverOnDayProgramme: (id, circuit) => {
      const clean = circuit.trim().toUpperCase();
      if (!clean || clean === 'STAND-BY' || clean === 'STANDBY') {
        set({
          feedbackMessage: {
            type: 'error',
            text: 'Choisissez un programme du jour, pas Stand-by.',
          },
        });
        return;
      }
      const nowIso = new Date().toISOString();
      let placedName = '';
      set((state) => {
        const liveDate = state.drivers.find((d) => {
          const prog = (d.programmeJour || '').trim().toUpperCase();
          return prog && prog !== 'STAND-BY' && prog !== 'STANDBY' && d.programmeDate;
        })?.programmeDate;
        const drivers = state.drivers.map((d) => {
          if (d.id !== id) return d;
          const prog = (d.programmeJour || '').trim().toUpperCase();
          const standby = !prog || prog === 'STAND-BY' || prog === 'STANDBY';
          if (!standby && d.statut !== 'PAS DE CAISSE') return d;
          placedName = d.nom;
          const unpaid = (d.programmeHistorique || []).filter((entry) => !entry.paid).length;
          const updated: Driver = {
            ...d,
            programmeJour: clean,
            circuitActuel: clean,
            statut: 'NON PAYE',
            jourPaye: false,
            caissePaye: '',
            programmeDate: liveDate || nowIso,
            dateDerniere: nowIso,
            caissesDues: unpaid + 1,
          };
          const { reclamation } = recalculateReclamation(updated);
          return { ...updated, reclamation };
        });
        return {
          drivers,
          feedbackMessage: placedName
            ? {
                type: 'success',
                text: `${placedName} est ajouté au programme du jour : ${clean}.`,
              }
            : {
                type: 'error',
                text: 'Ce chauffeur a déjà un programme du jour.',
              },
        };
      });
      if (placedName) triggerImmediateSync();
    },

    deleteDriver: (id) => {
      pendingRemovedDriverIds.push(id);
      set((state) => ({
        drivers: state.drivers.filter((d) => d.id !== id),
        feedbackMessage: {
          type: 'info',
          text: 'Chauffeur supprimé avec succès.',
        },
      }));
      triggerImmediateSync();
    },

    addDriver: (data) => {
      const statut = data.statut || 'NON PAYE';
      const circuit = (data.programmeJour || data.circuitActuel || '').trim().toUpperCase();
      const newDriver: Driver = {
        id: generateId('DRV'),
        nom: data.nom.trim().toUpperCase(),
        tr: data.tr.trim().toUpperCase(),
        statut,
        dateDerniere: data.dateDerniere || new Date().toISOString(),
        caissesDues: statut === 'NON PAYE' ? (data.caissesDues ?? 1) : 0,
        programmeJour: circuit,
        circuitActuel: circuit,
        reclamation: '',
      };
      const { reclamation } = recalculateReclamation(newDriver);
      newDriver.reclamation = reclamation;

      set((state) => ({
        drivers: [newDriver, ...state.drivers],
        feedbackMessage: {
          type: 'success',
          text: `Chauffeur ${newDriver.nom} (TR ${newDriver.tr}) ajouté et synchronisé !`,
        },
      }));
      triggerImmediateSync();
    },

    executeBascule1230: () => {
      set((state) => {
        const nowStr = new Date().toISOString();

        const updated = state.drivers.map((d) => {
          const history = (d.programmeHistorique || []).map((h) => ({ ...h, j1: false }));
          const prog = (d.programmeJour || d.circuitActuel || '').trim();
          const hasCircuit =
            prog.length > 0 && prog.toUpperCase() !== 'STAND-BY' && prog.toUpperCase() !== 'STANDBY';
          const wasPaid = Boolean(d.jourPaye) || d.statut === 'PAYE';

          if (hasCircuit) {
            history.unshift({
              id: generateId('PRG-BASC'),
              date: d.programmeDate || d.dateDerniere || nowStr,
              circuit: prog,
              paid: wasPaid,
              j1: !wasPaid,
              caisseCode: wasPaid ? d.caissePaye || '' : '',
            });
          } else if (d.statut === 'NON PAYE' && history.filter((h) => !h.paid).length === 0) {
            history.unshift({
              id: generateId('PRG-BASC'),
              date: d.dateDerniere || nowStr,
              circuit: 'STAND-BY',
              paid: false,
              j1: true,
            });
          }

          const unpaidCount = history.filter((h) => !h.paid).length;
          const nextStatut: DriverStatus = unpaidCount > 0 ? 'NON PAYE' : 'PAS DE CAISSE';

          const u: Driver = {
            ...d,
            programmeJour: 'STAND-BY',
            circuitActuel: 'STAND-BY',
            programmeDate: undefined,
            jourPaye: false,
            caissePaye: '',
            payeLe: undefined,
            programmeHistorique: history.slice(0, 60),
            statut: nextStatut,
            caissesDues: unpaidCount,
            dateDerniere: nowStr,
          };
          const { reclamation } = recalculateReclamation(u);
          return { ...u, reclamation };
        });

        return {
          drivers: updated,
          feedbackMessage: {
            type: 'success',
            text: 'Bascule effectuée. Les tournées non payées sont en historique « Non payée (J-1) », les tournées payées restent « Payée ». Vous pouvez importer le fichier Excel de 12h30.',
          },
        };
      });
      triggerImmediateSync();
    },

    importProgramme: (rows) => {
      const currentDrivers = get().drivers;
      const { drivers: nextDrivers, updatedCount, createdCount, totalProgrammes, errors } =
        applyProgrammeRowsToFleet(currentDrivers, rows);

      const hasErrors = errors.length > 0;
      set({
        drivers: nextDrivers,
        feedbackMessage: {
          type: hasErrors ? 'error' : 'success',
          text: hasErrors
            ? `Import terminé avec ${errors.length} erreur(s) bloquée(s) (TR en double ou conflit de nom sur un TR existant). ${updatedCount} mis à jour, ${createdCount} créé(s).`
            : `Programme du jour importé : ${updatedCount} chauffeur(s) mis à jour, ${createdCount} nouveau(x) chauffeur(s) ajouté(s), ${totalProgrammes} programme(s) actif(s). Échéance de retard : demain à 12:30.`,
        },
      });
      triggerImmediateSync(true);
      return { updatedCount, createdCount, totalProgrammes, errors };
    },

    loadDefaultProgrammeExcel: () => {
      set({
        drivers: [],
        transactions: [],
        allTransactions: [],
        selectedDriverId: null,
        deskTrInput: '',
        feedbackMessage: {
          type: 'info',
          text: 'Tous les chauffeurs, programmes et historiques de caisses ont été supprimés (0 chauffeur).',
        },
      });
      void fetch('/api/caisse/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drivers: [], transactions: [], clearAllHistory: true }),
      }).then(() => get().fetchAccountData());
    },

    deleteProgramEntry: (driverId, entryId) => {
      set((state) => ({
        drivers: state.drivers.map((d) => {
          if (d.id !== driverId) return d;
          let next: Driver;
          if (entryId === 'STANDBY-UNPAID' || entryId === 'PREV-UNPAID') {
            const unpaidHist = (d.programmeHistorique || []).filter((e) => !e.paid).length;
            next = {
              ...d,
              programmeJour: unpaidHist > 0 ? d.programmeJour : 'STAND-BY',
              circuitActuel: unpaidHist > 0 ? d.circuitActuel : 'STAND-BY',
              programmeDate: unpaidHist > 0 ? d.programmeDate : undefined,
              statut: unpaidHist > 0 ? 'NON PAYE' : 'PAS DE CAISSE',
              caissesDues: unpaidHist,
            };
          } else if (entryId === 'CURRENT') {
            const unpaidHist = (d.programmeHistorique || []).filter((e) => !e.paid).length;
            next = {
              ...d,
              programmeJour: 'STAND-BY',
              circuitActuel: 'STAND-BY',
              programmeDate: undefined,
              statut: unpaidHist > 0 ? 'NON PAYE' : 'PAS DE CAISSE',
              caissesDues: unpaidHist,
            };
          } else {
            const nextHist = (d.programmeHistorique || []).filter((e) => e.id !== entryId);
            const unpaidHist = nextHist.filter((e) => !e.paid).length;
            const prog = (d.programmeJour || '').trim().toUpperCase();
            const hasActive = prog && prog !== 'STAND-BY' && prog !== 'STANDBY';
            const activeUnpaid = hasActive && d.statut === 'NON PAYE';
            const caissesDues = unpaidHist + (activeUnpaid ? 1 : 0);
            next = {
              ...d,
              programmeHistorique: nextHist,
              caissesDues,
              statut:
                caissesDues > 0 ? 'NON PAYE' : hasActive ? d.statut : 'PAS DE CAISSE',
            };
          }
          const { reclamation } = recalculateReclamation(next);
          return { ...next, reclamation };
        }),
        feedbackMessage: { type: 'success', text: 'Programme supprimé.' },
      }));
      triggerImmediateSync(true);
    },
    markProgramEntryPaid: (driverId, entryId) => {
      set((state) => ({
        drivers: state.drivers.map((d) => {
          if (d.id !== driverId) return d;
          const prog = (d.programmeJour || '').trim().toUpperCase();
          const isCurrentStandby = !prog || prog === 'STAND-BY' || prog === 'STANDBY';
          let jourPaye = Boolean(d.jourPaye);
          let caissePaye = d.caissePaye || '';
          let payeLe = d.payeLe;
          let nextHist = [...(d.programmeHistorique || [])];
          const paidAt = normalizeCaisseCode(
            state.currentUser?.caisseCode || state.currentUser?.username
          );
          const nowIso = new Date().toISOString();

          if (entryId === 'CURRENT') {
            jourPaye = true;
            caissePaye = paidAt || caissePaye;
            payeLe = nowIso;
          } else if (entryId !== 'STANDBY-UNPAID' && entryId !== 'PREV-UNPAID') {
            nextHist = nextHist.map((e) =>
              e.id === entryId ? { ...e, paid: true, caisseCode: paidAt || e.caisseCode } : e
            );
            caissePaye = paidAt || caissePaye;
            payeLe = nowIso;
          }

          const remainingUnpaidHist = nextHist.filter((e) => !e.paid).length;
          const todayStillDue = !isCurrentStandby && !jourPaye;
          const caissesDues = remainingUnpaidHist + (todayStillDue ? 1 : 0);
          const nextStatut: DriverStatus =
            caissesDues > 0 ? 'NON PAYE' : isCurrentStandby ? 'PAS DE CAISSE' : 'PAYE';
          const u: Driver = {
            ...d,
            programmeHistorique: nextHist,
            jourPaye,
            caissePaye,
            payeLe,
            statut: nextStatut,
            caissesDues,
            dateDerniere: nowIso,
          };
          const { reclamation } = recalculateReclamation(u);
          return { ...u, reclamation };
        }),
      }));
      triggerImmediateSync(true);
    },
    resetAllDriversStatus: (status) => {
      const nowStr = new Date().toISOString();
      set((state) => ({
        drivers: state.drivers.map((d) => {
          const u: Driver = { ...d, statut: status, dateDerniere: nowStr, caissesDues: status === 'NON PAYE' ? 1 : 0 };
          const { reclamation } = recalculateReclamation(u);
          return { ...u, reclamation };
        }),
        feedbackMessage: {
          type: 'info',
          text: `Tous les chauffeurs ont été passés en: ${status}`,
        },
      }));
      triggerImmediateSync();
    },

    refreshAlarms: () => {
      set((state) => ({
        drivers: state.drivers.map((d) => {
          const { reclamation } = recalculateReclamation(d);
          return { ...d, reclamation };
        }),
      }));
    },

    loadDemoDriversTemplate: () => {
      const normalized = INITIAL_DRIVERS.map((d) => {
        const { reclamation } = recalculateReclamation(d);
        return { ...d, reclamation };
      });
      set({
        drivers: normalized,
        feedbackMessage: {
          type: 'success',
          text: '70 chauffeurs du modèle initial ont été chargés avec succès dans votre caisse.',
        },
      });
      triggerImmediateSync();
    },

    setBilletterieCount: (index, count) => {
      set((state) => {
        const next = [...state.billetterieItems];
        next[index] = { ...next[index], nombre: Math.max(0, count) };
        return { billetterieItems: next };
      });
      triggerDebouncedSync();
    },

    setSrfMoins: (val) => {
      set({ srfMoins: Math.max(0, val) });
      triggerDebouncedSync();
    },

    setVer: (val) => {
      set({ ver: Math.max(0, val) });
      triggerDebouncedSync();
    },

    setRecettePhysiqueTheorique: (val) => {
      set({ recettePhysiqueTheorique: Math.max(0, val) });
      triggerDebouncedSync();
    },

    cloturerJournee: () => {
      // Archiver et réinitialiser la caisse du jour. Les chauffeurs et le programme ne sont pas envoyés.
      hasPendingDriverSync = false;
      set({
        transactions: [],
        deskRows: DEFAULT_DESK_ROWS.map((row) => ({ ...row })),
        deskRecette: 0,
        deskVersement: 0,
        deskVersementBanque: 0,
        deskVersementCoffre: 0,
        deskTrInput: '',
        selectedDriverId: null,
        billetterieItems: DEFAULT_BILLETTERIE_ITEMS.map((item) => ({ ...item, nombre: 0 })),
        recettePhysiqueTheorique: 0,
        ver: 0,
        srfMoins: 0,
        cycleBordereaux: 0,
        feedbackMessage: {
          type: 'success',
          text: 'Journée clôturée avec succès : les transactions ont été archivées et le journal actif est réinitialisé.',
        },
      });
      triggerImmediateSync(false);
    },
  };
});
