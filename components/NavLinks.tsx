'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCaisseStore } from '@/lib/store';
import { NAV_ITEMS, type NavItem } from '@/lib/nav';
import {
  IconCalculator,
  IconCalendar,
  IconCoins,
  IconDashboard,
  IconHistory,
  IconReceipt,
  IconSheet,
  IconTruck,
} from './Icons';

const ICONS = {
  dashboard: IconDashboard,
  calculator: IconCalculator,
  coins: IconCoins,
  history: IconHistory,
  truck: IconTruck,
  calendar: IconCalendar,
  receipt: IconReceipt,
  sheet: IconSheet,
};

const ICON_COLORS: Record<NavItem['icon'], string> = {
  dashboard: 'text-indigo-400 group-hover:text-indigo-300',
  calculator: 'text-sky-400 group-hover:text-sky-300',
  coins: 'text-amber-400 group-hover:text-amber-300',
  history: 'text-amber-400 group-hover:text-amber-300',
  truck: 'text-rose-400 group-hover:text-rose-300',
  calendar: 'text-violet-400 group-hover:text-violet-300',
  receipt: 'text-emerald-400 group-hover:text-emerald-300',
  sheet: 'text-teal-400 group-hover:text-teal-300',
};

const SECTIONS = [
  { id: 'workspace', title: 'Trésorerie & Pilotage' },
  { id: 'operations', title: 'Opérations Flotte' },
  { id: 'reports', title: 'Journal & Audit' },
] as const;

// Pages masquées pour le profil Superviseur (Spécification 4)
const SUPERVISEUR_HIDDEN_HREFS = new Set([
  '/caisse',
  '/billetterie',
  '/chauffeurs',
  '/programme',
]);

export default function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const currentUser = useCaisseStore((state) => state.currentUser);
  const drivers = useCaisseStore((state) => state.drivers);
  const transactions = useCaisseStore((state) => state.transactions);

  const isSuperviseur = currentUser?.role === 'superviseur';
  const nonPayeCount = drivers.filter((d) => d.statut === 'NON PAYE').length;

  const visibleNavItems = isSuperviseur
    ? NAV_ITEMS.filter((item) => !SUPERVISEUR_HIDDEN_HREFS.has(item.href))
    : NAV_ITEMS;

  const renderLink = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const active = pathname === item.href;

    let badgeText = '';
    let badgeClass = 'bg-white/10 text-slate-300 ring-1 ring-white/10';

    if (item.badgeKey === 'nonPaye' && nonPayeCount > 0) {
      badgeText = String(nonPayeCount);
      badgeClass =
        'bg-rose-500/20 text-rose-300 ring-1 ring-rose-400/35 font-extrabold shadow-[0_0_12px_rgba(244,63,94,0.25)]';
    } else if (item.href === '/journal' && transactions.length > 0) {
      badgeText = String(transactions.length);
      badgeClass = 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25 font-bold';
    }

    const displayLabel =
      isSuperviseur && item.href === '/'
        ? 'Pilotage Superviseur'
        : isSuperviseur && item.href === '/journal'
        ? 'Journal des Transactions Avancé'
        : isSuperviseur && item.href === '/billetterie/historique'
        ? 'Historique de Clôture'
        : item.label;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          className={`group nav-link-dark min-h-[42px] ${active ? 'nav-link-dark-active' : ''}`}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-400 shadow-[0_0_10px_#818cf8]" />
          )}
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all ${
              active
                ? 'bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-400/30'
                : `bg-white/[0.03] ${ICON_COLORS[item.icon]}`
            }`}
          >
            <Icon className="h-[16px] w-[16px]" />
          </span>
          <span className="flex-1 truncate">{displayLabel}</span>
          {badgeText && (
            <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] tabular-nums ${badgeClass}`}>
              {badgeText}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-4">
      {SECTIONS.map((section) => {
        const itemsInSection = visibleNavItems.filter((item) => item.group === section.id);
        if (itemsInSection.length === 0) return null;
        return (
          <div key={section.id}>
            <p className="nav-section-dark">{section.title}</p>
            <ul className="space-y-1">{itemsInSection.map(renderLink)}</ul>
          </div>
        );
      })}
    </nav>
  );
}
