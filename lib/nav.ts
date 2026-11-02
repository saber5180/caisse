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
    | 'sheet';
};

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Tableau de bord', icon: 'dashboard', group: 'workspace' },
  { href: '/caisse', label: 'Guichet de Caisse', icon: 'calculator', group: 'workspace', accent: 'text-indigo-600' },
  { href: '/billetterie', label: 'Comptage Billetterie', icon: 'coins', group: 'workspace', accent: 'text-amber-500' },

  {
    href: '/chauffeurs',
    label: 'Mouvement Chauffeurs',
    icon: 'truck',
    badgeKey: 'nonPaye',
    accent: 'text-rose-500',
    group: 'operations',
  },
  {
    href: '/programme',
    label: 'Programme & Bascule 12h30',
    icon: 'calendar',
    accent: 'text-sky-500',
    group: 'operations',
  },

  {
    href: '/journal',
    label: 'Journal des Transactions',
    icon: 'receipt',
    accent: 'text-emerald-500',
    group: 'reports',
  },
  {
    href: '/excel',
    label: 'Import / Export Excel',
    icon: 'sheet',
    accent: 'text-slate-500',
    group: 'reports',
  },
];

export const PAGE_TITLES: Record<string, string> = {
  '/': 'Tableau de bord',
  '/caisse': 'Guichet de Caisse (Tableau de Calcule)',
  '/billetterie': 'Comptage Billetterie & Monnaie (Feuil3)',
  '/chauffeurs': 'Mouvement des Chauffeurs',
  '/programme': 'Programme des Tournées & Bascule 12:30',
  '/journal': 'Journal des Transactions (Feuil2)',
  '/excel': 'Import / Export Excel',
};

