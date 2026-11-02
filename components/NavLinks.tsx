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
  IconReceipt,
  IconSheet,
  IconTruck,
} from './Icons';

const ICONS = {
  dashboard: IconDashboard,
  calculator: IconCalculator,
  coins: IconCoins,
  truck: IconTruck,
  calendar: IconCalendar,
  receipt: IconReceipt,
  sheet: IconSheet,
};

const SECTIONS = [
  { id: 'workspace', title: 'Espace Caisse' },
  { id: 'operations', title: 'Chauffeurs & Circuits' },
  { id: 'reports', title: 'Données & Journal' },
] as const;

export default function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const drivers = useCaisseStore((state) => state.drivers);

  const nonPayeCount = drivers.filter((d) => d.statut === 'NON PAYE').length;

  const renderLink = (item: NavItem) => {
    const Icon = ICONS[item.icon];
    const active = pathname === item.href;

    let badgeText = '';
    let badgeClass = 'bg-slate-200/70 text-slate-600';

    if (item.badgeKey === 'nonPaye' && nonPayeCount > 0) {
      badgeText = String(nonPayeCount);
      badgeClass = 'bg-rose-100 text-rose-700 font-bold';
    }

    return (
      <li key={item.href}>
        <Link
          href={item.href}
          onClick={onNavigate}
          className={`group nav-link min-h-11 ${active ? 'nav-link-active' : ''}`}
        >
          {active && (
            <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-indigo-600" />
          )}
          <Icon
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
              active ? 'text-indigo-600' : item.accent ?? 'text-slate-400 group-hover:text-slate-600'
            }`}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {badgeText && (
            <span className={`rounded-full px-2 py-0.5 text-[10px] tabular-nums ${badgeClass}`}>
              {badgeText}
            </span>
          )}
        </Link>
      </li>
    );
  };

  return (
    <nav className="flex-1 overflow-y-auto px-3 pb-6">
      {SECTIONS.map((section) => (
        <div key={section.id}>
          <p className="nav-section">{section.title}</p>
          <ul className="space-y-0.5">
            {NAV_ITEMS.filter((item) => item.group === section.id).map(renderLink)}
          </ul>
        </div>
      ))}
    </nav>
  );
}

