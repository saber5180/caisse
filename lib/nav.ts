export type NavItem = {
  href: string;
  label: string;
  badgeKey?: 'nonPaye' | 'alertUrgent' | 'totalDrivers';
  accent?: string;
  group: 'workspace' | 'operations' | 'reports';
  icon:
    | 'dashboard'
    | 'calculator'
    | 'coins'
    | 'truck'
    | 'calendar'
    | 'receipt'
    | 'sheet'
    | 'history'
    | 'user';
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Tableau de bord', icon: 'dashboard', group: 'workspace' },
  { href: '/caisse', label: 'Guichet Caisse', icon: 'calculator', group: 'workspace' },
  { href: '/billetterie', label: 'Billetterie', icon: 'coins', group: 'workspace' },
  { href: '/billetterie/historique', label: 'Clôtures', icon: 'history', group: 'workspace' },

  {
    href: '/chauffeurs',
    label: 'Chauffeurs',
    icon: 'truck',
    badgeKey: 'nonPaye',
    group: 'operations',
  },
  {
    href: '/programme',
    label: 'Programme 12:30',
    icon: 'calendar',
    group: 'operations',
  },

  {
    href: '/journal',
    label: 'Journal',
    icon: 'receipt',
    group: 'reports',
  },
  {
    href: '/excel',
    label: 'Import / Export',
    icon: 'sheet',
    group: 'reports',
  },
  {
    href: '/admin/comptes',
    label: 'Comptes',
    icon: 'user',
    group: 'reports',
  },
];

export const PAGE_TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/caisse': 'Guichet de Caisse',
  '/billetterie': 'Comptage Billetterie',
  '/billetterie/historique': 'Historique des Clôtures',
  '/chauffeurs': 'Chauffeurs',
  '/programme': 'Programme 12:30',
  '/journal': 'Journal des Transactions',
  '/excel': 'Import / Export Excel',
  '/admin/comptes': 'Comptes Utilisateurs',
};
