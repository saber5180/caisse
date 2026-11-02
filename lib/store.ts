import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Driver, DriverStatus, CashDeskRow, CashTransaction, CoinBreakdownItem } from '@/types/caisse';
import { INITIAL_DRIVERS } from '@/data/initialDrivers';
import { recalculateReclamation, generateId } from './utils';

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
  { valeur: 0.050, label: '0,050 TND (Pièce)', isBillet: false, nombre: 10 },
  { valeur: 0.100, label: '0,100 TND (Pièce)', isBillet: false, nombre: 5 },
  { valeur: 0.200, label: '0,200 TND (Pièce)', isBillet: false, nombre: 1 },
  { valeur: 0.500, label: '0,500 TND (Pièce)', isBillet: false, nombre: 31 },
  { valeur: 1.000, label: '1,000 TND (Pièce)', isBillet: false, nombre: 60 },
  { valeur: 2.000, label: '2,000 TND (Pièce)', isBillet: false, nombre: 39 },
  { valeur: 5.000, label: '5,000 TND (Pièce)', isBillet: false, nombre: 4 },
  { valeur: 10.000, label: '10,000 TND (Billet)', isBillet: true, nombre: 2032 },
  { valeur: 20.000, label: '20,000 TND (Billet)', isBillet: true, nombre: 1658 },
  { valeur: 50.000, label: '50,000 TND (Billet)', isBillet: true, nombre: 192 },
  { valeur: 5.000, label: '5,000 TND (Billet)', isBillet: true, nombre: 68 },
  { valeur: 0.020, label: '0,020 TND (Pièce)', isBillet: false, nombre: 0 },
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
  syncToBackend: () => Promise<void>;

  // Drivers
  drivers: Driver[];
  selectedDriverId: string | null;
  searchQuery: string;
  statusFilter: DriverStatus | 'ALL';

  // Cash Desk (Guichet de Caisse)
  deskRows: CashDeskRow[];
  deskRecette: number;
  deskVersement: number;
  deskTrInput: string;
  feedbackMessage: { type: 'success' | 'error' | 'info'; text: string } | null;

  // Billetterie
  billetterieItems: CoinBreakdownItem[];
  srfMoins: number;
  ver: number;
  recettePhysiqueTheorique: number;

  // History (Feuil2)
  transactions: CashTransaction[];

  // Actions - Desk
  setDeskEntree: (index: number, val: number) => void;
  setDeskSortie: (index: number, val: number) => void;
  setDeskRecette: (val: number) => void;
  setDeskVersement: (val: number) => void;
  setDeskTrInput: (val: string) => void;
  selectDriverByTr: (tr: string) => Driver | null;
  validateCurrentSale: () => CashTransaction | null;
  resetDesk: () => void;
  clearFeedback: () => void;

  // Actions - Drivers
  setSearchQuery: (q: string) => void;
  setStatusFilter: (f: DriverStatus | 'ALL') => void;
  updateDriverStatus: (id: string, status: DriverStatus) => void;
  assignCircuit: (id: string, circuit: string) => void;
  deleteDriver: (id: string) => void;
  addDriver: (driver: Omit<Driver, 'id' | 'reclamation'>) => void;
  executeBascule1230: () => void;
  resetAllDriversStatus: (status: DriverStatus) => void;
  refreshAlarms: () => void;

  // Actions - Billetterie
  setBilletterieCount: (index: number, count: number) => void;
  setSrfMoins: (val: number) => void;
  setVer: (val: number) => void;
  setRecettePhysiqueTheorique: (val: number) => void;
}

export const useCaisseStore = create<CaisseStore>()(
  persist(
    (set, get) => {
      const triggerDebouncedSync = () => {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
          get().syncToBackend();
        }, 800);
      };

      return {
        // Auth State
        currentUser: null,
        setCurrentUser: (user) => set({ currentUser: user }),
        isSyncing: false,
        lastSyncTime: null,

        fetchAccountData: async () => {
          try {
            set({ isSyncing: true });
            const res = await fetch('/api/caisse/data');
            if (res.ok) {
              const json = await res.json();
              if (json.success && json.data) {
                const { drivers, transactions, billetterie, deskState } = json.data;
                set({
                  drivers: drivers && drivers.length > 0 ? drivers : INITIAL_DRIVERS,
                  transactions: transactions || [],
                  billetterieItems: billetterie?.items || DEFAULT_BILLETTERIE_ITEMS,
                  srfMoins: billetterie?.srfMoins ?? 0,
                  ver: billetterie?.ver ?? 0,
                  recettePhysiqueTheorique: billetterie?.recetteTheorique ?? 0,
                  deskRows: deskState?.deskRows || DEFAULT_DESK_ROWS,
                  deskRecette: deskState?.deskRecette ?? 0,
                  deskVersement: deskState?.deskVersement ?? 0,
                  deskTrInput: deskState?.deskTrInput || '',
                  selectedDriverId: deskState?.selectedDriverId || null,
                  lastSyncTime: new Date().toLocaleTimeString('fr-FR'),
                });
              }
            }
          } catch (e) {
            console.error('Fetch error:', e);
          } finally {
            set({ isSyncing: false });
          }
        },

        syncToBackend: async () => {
          const user = get().currentUser;
          if (!user) return;
          try {
            set({ isSyncing: true });
            await fetch('/api/caisse/data', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                drivers: get().drivers,
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
              }),
            });
            set({ lastSyncTime: new Date().toLocaleTimeString('fr-FR') });
          } catch (e) {
            console.error('Sync error:', e);
          } finally {
            set({ isSyncing: false });
          }
        },

        // Drivers
        drivers: INITIAL_DRIVERS,
        selectedDriverId: null,
        searchQuery: '',
        statusFilter: 'ALL',

        // Cash Desk
        deskRows: DEFAULT_DESK_ROWS,
        deskRecette: 0,
        deskVersement: 0,
        deskTrInput: '',
        feedbackMessage: null,

        // Billetterie
        billetterieItems: DEFAULT_BILLETTERIE_ITEMS,
        srfMoins: 0,
        ver: 0,
        recettePhysiqueTheorique: 0,

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
          set({ deskVersement: Math.max(0, val) });
          triggerDebouncedSync();
        },

        setDeskTrInput: (val) => set({ deskTrInput: val }),

        selectDriverByTr: (tr) => {
          const cleanTr = tr.trim().toUpperCase();
          const found = get().drivers.find((d) => d.tr.toUpperCase() === cleanTr);
          if (found) {
            set({
              selectedDriverId: found.id,
              deskTrInput: found.tr,
              feedbackMessage: {
                type: 'success',
                text: `Chauffeur sélectionné : ${found.nom} (${found.tr}) - Circuit: ${found.programmeJour || 'STAND-BY'}`,
              },
            });
            triggerDebouncedSync();
            return found;
          } else {
            set({
              selectedDriverId: null,
              feedbackMessage: {
                type: 'error',
                text: `Chauffeur introuvable avec le code TR: "${tr}"`,
              },
            });
            return null;
          }
        },

        validateCurrentSale: () => {
          const { deskRows, deskVersement, deskRecette, selectedDriverId, drivers } = get();
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

          const newTransaction: CashTransaction = {
            id: generateId('TRX'),
            date: new Date().toISOString(),
            codeChauffeur: driver.tr,
            nomChauffeur: driver.nom,
            recette: deskRecette,
            tPayer,
            resAPayer,
            versement: deskVersement,
            status: resAPayer >= 0 ? 'PAYE' : 'NON PAYE',
            rawData: {
              rows: deskRows,
              versement: deskVersement,
              recette: deskRecette,
            },
          };

          // Update driver status: if resAPayer >= 0, driver is PAYE and debt is cleared
          const updatedDrivers = drivers.map((d) => {
            if (d.id === driver.id) {
              const updatedStatus: DriverStatus = resAPayer >= 0 ? 'PAYE' : 'NON PAYE';
              const updated: Driver = {
                ...d,
                statut: updatedStatus,
                dateDerniere: new Date().toISOString(),
                caissesDues: resAPayer >= 0 ? 0 : 1,
              };
              const { reclamation } = recalculateReclamation(updated);
              return { ...updated, reclamation };
            }
            return d;
          });

          set((state) => ({
            transactions: [newTransaction, ...state.transactions],
            drivers: updatedDrivers,
            deskRows: DEFAULT_DESK_ROWS,
            deskVersement: 0,
            deskRecette: 0,
            selectedDriverId: null,
            deskTrInput: '',
            feedbackMessage: {
              type: 'success',
              text: `Encaissement validé pour ${driver.nom} (Total: ${tPayer.toFixed(3)} TND) !`,
            },
          }));

          triggerDebouncedSync();
          return newTransaction;
        },

        resetDesk: () => {
          set({
            deskRows: DEFAULT_DESK_ROWS,
            deskVersement: 0,
            deskRecette: 0,
            selectedDriverId: null,
            deskTrInput: '',
            feedbackMessage: {
              type: 'info',
              text: 'Guichet de caisse réinitialisé.',
            },
          });
          triggerDebouncedSync();
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
          triggerDebouncedSync();
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
          triggerDebouncedSync();
        },

        deleteDriver: (id) => {
          set((state) => ({
            drivers: state.drivers.filter((d) => d.id !== id),
            feedbackMessage: {
              type: 'info',
              text: 'Chauffeur supprimé avec succès.',
            },
          }));
          triggerDebouncedSync();
        },

        addDriver: (data) => {
          const newDriver: Driver = {
            id: generateId('DRV'),
            nom: data.nom,
            tr: data.tr,
            statut: data.statut,
            dateDerniere: data.dateDerniere || new Date().toISOString(),
            caissesDues: data.caissesDues ?? 1,
            programmeJour: data.programmeJour || '',
            circuitActuel: data.circuitActuel || '',
            reclamation: '',
          };
          const { reclamation } = recalculateReclamation(newDriver);
          newDriver.reclamation = reclamation;

          set((state) => ({
            drivers: [newDriver, ...state.drivers],
            feedbackMessage: {
              type: 'success',
              text: `Chauffeur ${newDriver.nom} ajouté avec succès.`,
            },
          }));
          triggerDebouncedSync();
        },

        executeBascule1230: () => {
          set((state) => {
            const now = new Date();
            const nowStr = now.toISOString();

            const updated = state.drivers.map((d) => {
              const hasCircuit = d.programmeJour && d.programmeJour.trim().length > 0 && d.programmeJour !== 'STAND-BY';

              if (hasCircuit && d.statut !== 'PAYE') {
                const u: Driver = {
                  ...d,
                  statut: 'NON PAYE',
                  caissesDues: 1,
                  dateDerniere: nowStr,
                };
                const { reclamation } = recalculateReclamation(u);
                return { ...u, reclamation };
              }

              if (d.statut === 'PAYE') {
                const u: Driver = {
                  ...d,
                  statut: 'PAS DE CAISSE',
                  caissesDues: 0,
                  dateDerniere: nowStr,
                };
                const { reclamation } = recalculateReclamation(u);
                return { ...u, reclamation };
              }

              if (!hasCircuit) {
                if (d.caissesDues === 0) {
                  const u: Driver = { ...d, statut: 'PAS DE CAISSE' };
                  const { reclamation } = recalculateReclamation(u);
                  return { ...u, reclamation };
                }
              }

              const { reclamation } = recalculateReclamation(d);
              return { ...d, reclamation };
            });

            return {
              drivers: updated,
              feedbackMessage: {
                type: 'success',
                text: 'Bascule de 12:30 exécutée avec succès ! Les circuits dus ont été mis à jour.',
              },
            };
          });
          triggerDebouncedSync();
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
          triggerDebouncedSync();
        },

        refreshAlarms: () => {
          set((state) => ({
            drivers: state.drivers.map((d) => {
              const { reclamation } = recalculateReclamation(d);
              return { ...d, reclamation };
            }),
          }));
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
      };
    },
    {
      name: 'caisse-chauffeur-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
