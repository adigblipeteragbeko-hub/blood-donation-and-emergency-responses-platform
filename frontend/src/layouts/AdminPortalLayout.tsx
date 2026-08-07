import { useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { BrandLogo } from '../components/BrandLogo';
import { LiveEmergencyAlertBanner } from '../components/LiveEmergencyAlertBanner';
import { AppIcon } from '../components/ui/AppIcon';
import { AccountIdentityMenu } from '../components/AccountIdentityMenu';
import { FloatingAssistantLauncher } from '../components/FloatingAssistantLauncher';
import { buildAccountIdentity } from '../utils/account-identity';
import { rememberAccount } from '../utils/remembered-accounts';

type AdminLink = {
  to: string;
  label: string;
  icon: Parameters<typeof AppIcon>[0]['name'];
  roles: string[];
};

const adminLinks: AdminLink[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['ADMIN'] },
  { to: '/admin/website-management', label: 'Website', icon: 'settings', roles: ['ADMIN'] },
  { to: '/admin/live-map', label: 'Live Map', icon: 'map', roles: ['ADMIN'] },
  { to: '/admin/donor-clinical-reviews', label: 'Clinical Reviews', icon: 'form', roles: ['ADMIN'] },
  { to: '/admin/management?section=settings', label: 'Users', icon: 'users', roles: ['ADMIN'] },
  { to: '/admin/management?section=donors', label: 'Donors', icon: 'heart', roles: ['ADMIN'] },
  { to: '/admin/management?section=donor-communications', label: 'Donor Communications', icon: 'notification', roles: ['ADMIN'] },
  { to: '/admin/management?section=ai-intelligence', label: 'AI Intelligence', icon: 'reports', roles: ['ADMIN'] },
  { to: '/admin/management?section=assistant', label: 'Assistant', icon: 'notification', roles: ['ADMIN'] },
  { to: '/admin/management?section=hospitals', label: 'Hospitals', icon: 'hospital', roles: ['ADMIN'] },
  { to: '/admin/management?section=request-tracking', label: 'Requests', icon: 'alert', roles: ['ADMIN'] },
  { to: '/admin/management?section=inventory-tracking', label: 'Inventory', icon: 'inventory', roles: ['ADMIN'] },
  { to: '/admin/management?section=audit', label: 'Audit', icon: 'reports', roles: ['ADMIN'] },
];

export function AdminPortalLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const availableLinks = adminLinks.filter((item) => user?.role && item.roles.includes(user.role));
  const identity = useMemo(() => buildAccountIdentity({ user }), [user]);

  useEffect(() => {
    if (identity) rememberAccount(identity);
  }, [identity]);

  const isItemActive = (to: string) => {
    const [pathWithQuery] = to.split('#');
    const [path, query] = pathWithQuery.split('?');
    if (location.pathname !== path) {
      return false;
    }
    const currentSection = new URLSearchParams(location.search).get('section') ?? location.hash.replace('#', '');
    const targetSection = query ? new URLSearchParams(query).get('section') ?? '' : '';
    if (!targetSection) {
      return currentSection === '';
    }
    return currentSection === targetSection;
  };

  return (
    <section className="grid gap-5 overflow-x-hidden pt-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:pt-8">
      <aside className="card h-fit space-y-2">
        <div className="flex items-center justify-between gap-3">
          <BrandLogo compact />
        </div>
        <AccountIdentityMenu identity={identity} onLogout={logout} compact />
        <nav className="max-h-[75vh] space-y-1 overflow-y-auto pr-1">
          {availableLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`${isItemActive(item.to) ? 'bg-primary text-white' : 'bg-red-50 text-primary'} flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold`}
            >
              <AppIcon name={item.icon} className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="page-content-safe-bottom min-w-0 space-y-5 pt-2 lg:pt-3">
        <LiveEmergencyAlertBanner />
        <Outlet />
      </div>
      <FloatingAssistantLauncher />
    </section>
  );
}

