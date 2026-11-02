import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      width={18}
      height={18}
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconDashboard = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.75 6A2.25 2.25 0 0 1 6 3.75h3A2.25 2.25 0 0 1 11.25 6v3A2.25 2.25 0 0 1 9 11.25H6A2.25 2.25 0 0 1 3.75 9V6ZM12.75 6A2.25 2.25 0 0 1 15 3.75h3A2.25 2.25 0 0 1 20.25 6v3A2.25 2.25 0 0 1 18 11.25h-3A2.25 2.25 0 0 1 12.75 9V6ZM3.75 15A2.25 2.25 0 0 1 6 12.75h3A2.25 2.25 0 0 1 11.25 15v3A2.25 2.25 0 0 1 9 20.25H6A2.25 2.25 0 0 1 3.75 18v-3ZM12.75 15A2.25 2.25 0 0 1 15 12.75h3A2.25 2.25 0 0 1 20.25 15v3A2.25 2.25 0 0 1 18 20.25h-3A2.25 2.25 0 0 1 12.75 18v-3Z" />
  </Base>
);

export const IconCalculator = (p: IconProps) => (
  <Base {...p}>
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <line x1="8" x2="16" y1="6" y2="6" />
    <line x1="16" x2="16" y1="14" />
    <path d="M16 10h.01" />
    <path d="M12 10h.01" />
    <path d="M8 10h.01" />
    <path d="M12 14h.01" />
    <path d="M8 14h.01" />
    <path d="M12 18h.01" />
    <path d="M8 18h.01" />
  </Base>
);

export const IconCoins = (p: IconProps) => (
  <Base {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </Base>
);

export const IconTruck = (p: IconProps) => (
  <Base {...p}>
    <path d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375A1.125 1.125 0 0 1 2.25 17.62V6.75A2.25 2.25 0 0 1 4.5 4.5h8.25a2.25 2.25 0 0 1 2.25 2.25v10.87c0 .63.51 1.13 1.13 1.13H17.25m0 0a1.5 1.5 0 0 0 3 0m-3 0a1.5 1.5 0 0 1 3 0m0 0h.375c.62 0 1.13-.5 1.13-1.13V14.25m0 0h-6.75M21.75 14.25v-2.6c0-.6-.24-1.17-.66-1.6l-2.1-2.09a2.25 2.25 0 0 0-1.6-.66H15" />
  </Base>
);

export const IconCalendar = (p: IconProps) => (
  <Base {...p}>
    <path d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0V11.25A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
  </Base>
);

export const IconReceipt = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1Z" />
    <path d="M16 8h-6m6 4H8m3 4H8" />
  </Base>
);

export const IconSheet = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.75 6.75A2.25 2.25 0 0 1 6 4.5h12a2.25 2.25 0 0 1 2.25 2.25v10.5A2.25 2.25 0 0 1 18 19.5H6a2.25 2.25 0 0 1-2.25-2.25V6.75ZM3.75 9.75h16.5M3.75 14.25h16.5M9.75 9.75v9.75M15 9.75v9.75" />
  </Base>
);

export const IconFile = (p: IconProps) => (
  <Base {...p}>
    <path d="M19.5 14.25v-2.63c0-1.14-.9-2.06-2.03-2.12a48 48 0 0 0-1.22-.06 2.25 2.25 0 0 1-2.22-2.25V6c0-1.13-.92-2.03-2.05-2.1A48.4 48.4 0 0 0 9 3.75c-1.19 0-2.37.04-3.53.11A2.1 2.1 0 0 0 3.75 6v12c0 1.13.9 2.06 2.03 2.12 1.16.07 2.33.13 3.53.13 3.2 0 6.25-.2 8.16-.35 1.13-.08 2.03-1 2.03-2.14v-3.6Z" />
    <path d="M14.25 3.9c.72.4 1.33.98 1.77 1.68l2.31 3.67" />
  </Base>
);

export const IconSearch = (p: IconProps) => (
  <Base {...p}>
    <path d="m21 21-4.35-4.35M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0Z" />
  </Base>
);

export const IconAlert = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 9v3.75m0 3.5h.008M10.34 3.94 2.6 17.33A1.9 1.9 0 0 0 4.24 20.2h15.52a1.9 1.9 0 0 0 1.64-2.87L13.66 3.94a1.9 1.9 0 0 0-3.32 0Z" />
  </Base>
);

export const IconPrinter = (p: IconProps) => (
  <Base {...p}>
    <polyline points="6 9 6 2 18 2 18 9" />
    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
    <rect width="12" height="8" x="6" y="14" />
  </Base>
);

export const IconSync = (p: IconProps) => (
  <Base {...p}>
    <path d="M16.02 9.35h4.5v-4.5m-16.54 14.3h4.5v-4.5" />
    <path d="M19.64 8.5a8.25 8.25 0 0 0-14.1-2.16L3.98 8m.38 7.5a8.25 8.25 0 0 0 14.1 2.16L20.02 16" />
  </Base>
);

export const IconCheck = (p: IconProps) => (
  <Base {...p}>
    <path d="m4.5 12.75 6 6 9-13.5" />
  </Base>
);

export const IconClose = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 18 18 6M6 6l12 12" />
  </Base>
);

export const IconMenu = (p: IconProps) => (
  <Base {...p}>
    <path d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
  </Base>
);

export const IconTrash = (p: IconProps) => (
  <Base {...p}>
    <path d="M14.74 9l-.35 9m-4.78 0L9.26 9M18.16 5.79c.34.05.68.1 1.02.16M18.16 5.79l-1.07 13.9a2.25 2.25 0 0 1-2.24 2.06H9.15a2.25 2.25 0 0 1-2.24-2.06L5.84 5.79m12.32 0a49 49 0 0 0-3.48-.4m-9.86.4c.34-.06.68-.11 1.02-.16m8.84-.24V4.48c0-.86-.66-1.57-1.52-1.6a49 49 0 0 0-2.96 0c-.86.03-1.52.74-1.52 1.6v.91m6 0a48 48 0 0 0-6 0M4.82 5.95c.34-.06.68-.11 1.02-.16" />
  </Base>
);

export const IconPlus = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 4.5v15m7.5-7.5h-15" />
  </Base>
);

export const IconUpload = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 7.5 12 3m0 0L7.5 7.5M12 3v13.5" />
  </Base>
);

export const IconDownload = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M7.5 12l4.5 4.5m0 0 4.5-4.5M12 3v13.5" />
  </Base>
);

export const IconBolt = (p: IconProps) => (
  <Base {...p}>
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
  </Base>
);
