import type { SVGProps } from 'react';

type IconName =
  | 'dashboard'
  | 'users'
  | 'hospital'
  | 'inventory'
  | 'alert'
  | 'notification'
  | 'map'
  | 'reports'
  | 'settings'
  | 'form'
  | 'clock'
  | 'heart'
  | 'logout';

const iconPath: Record<IconName, string> = {
  dashboard: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M9 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87',
  hospital: 'M3 21h18M7 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M10 9h4M10 13h4M12 3v4',
  inventory: 'M3 7h18M6 7V5h12v2M5 7l1 12h12l1-12',
  alert: 'M12 9v4M12 17h.01M10.29 3.86 1.82 15a2 2 0 0 0 1.71 3h16.36a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z',
  notification: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 1 1-6 0',
  map: 'M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Zm0-15v15m6-12v15',
  reports: 'M4 19h16M7 16V8M12 16V5M17 16v-4',
  settings: 'M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Zm7.4-3.5a7.4 7.4 0 0 0-.09-1.14l2.02-1.57-2-3.46-2.42.98a7.5 7.5 0 0 0-1.98-1.14l-.37-2.58h-4l-.37 2.58c-.7.27-1.37.66-1.98 1.14l-2.42-.98-2 3.46 2.02 1.57A7.4 7.4 0 0 0 4.6 12c0 .39.03.77.09 1.14L2.67 14.7l2 3.46 2.42-.98c.61.48 1.28.87 1.98 1.14l.37 2.58h4l.37-2.58c.7-.27 1.37-.66 1.98-1.14l2.42.98 2-3.46-2.02-1.57c.06-.37.09-.75.09-1.14Z',
  form: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  clock: 'M12 6v6l4 2M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  heart: 'm12 21-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A6.01 6.01 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.18L12 21Z',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

export function AppIcon({
  name,
  className = 'h-4 w-4',
  ...rest
}: SVGProps<SVGSVGElement> & { name: IconName }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <path d={iconPath[name]} />
    </svg>
  );
}

