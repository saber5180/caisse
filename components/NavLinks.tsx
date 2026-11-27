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
  IconUser,
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
  user: IconUser,
};

const SECTIONS = [
  { id: 'workspace', title: 'Caisse' },
  { id: 'operations', title: 'Flotte' },
  { id: 'reports', title: 'Suivi & Admin' },
] as const;

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
  const isAdmin = currentUser?.role === 'admin';
  const nonPayeCount = drivers.filter((d) => d.statut === 'NON PAYE').length;

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.href === '/admin/comptes') return isAdmin;
    if (isSuperviseur && SUPERVISEUR_HIDDEN_HREFS.has(item.href)) return false;
    return true;
  });

  const renderLink = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const active = pathname === item.href;

    let badgeText = '';
    let badgeClass = active
      ? 'bg-white/20 text-white'
      : 'bg-slate-800 text-slate-300';

    if (item.badgeKey === 'nonPaye' && nonPayeCount > 0) {
      badgeText = String(nonPayeCount);
      badgeClass = active
        ? 'bg-white text-sky-700 font-bold'
        : 'bg-rose-500/20 text-rose-300 font-bold';
    } else if (item.href === '/journal' && transactions.length > 0) {
      badgeText = String(transactions.length);
      badgeClass = active
        ? 'bg-white/20 text-white font-bold'
        : 'bg-emerald-500/20 text-emerald-300 font-bold';
    }

    const displayLabel =
      isSuperviseur && item.href === '/'
        ? 'Supervision'
        : item.label;

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          className={`group nav-link-dark ${active ? 'nav-link-dark-active' : ''}`}
        >
          <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
          <span className="flex-1 truncate">{displayLabel}</span>
          {badgeText && (
            <span className={`rounded px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${badgeClass}`}>
              {badgeText}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 pb-4">
      {SECTIONS.map((section) => {
        const itemsInSection = visibleNavItems.filter((item) => item.group === section.id);
        if (itemsInSection.length === 0) return null;
        return (
          <div key={section.id}>
            <p className="nav-section-dark">{section.title}</p>
            <ul className="space-y-0.5">{itemsInSection.map(renderLink)}</ul>
          </div>
        );
      })}
    </nav>
  );
}
