import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { BrandLogo } from '../components/BrandLogo';

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard Overview', roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'] },
  { to: '/admin/website-management', label: 'Website Management', roles: ['SUPER_ADMIN', 'ADMIN', 'WEBSITE_CONTENT_ADMIN'] },
  { to: '/admin/live-map', label: 'Live Map Tracking', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/admin/donor-clinical-reviews', label: 'Donor Clinical Reviews', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/admin/management?section=settings', label: 'Manage Users', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/admin/management?section=donors', label: 'Manage Donors', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/admin/management?section=hospitals', label: 'Manage Hospitals', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/admin/management?section=request-tracking', label: 'Manage Requests', roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'] },
  { to: '/admin/management?section=inventory-tracking', label: 'Manage Inventory', roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'] },
  { to: '/admin/management?section=audit', label: 'Audit Logs', roles: ['SUPER_ADMIN', 'ADMIN', 'AUDITOR'] },
];

export function AdminPortalLayout() {
  const { logout, user } = useAuth();
  const location = useLocation();
  const availableLinks = adminLinks.filter((item) => user?.role && item.roles.includes(user.role));

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
    <section className="grid gap-5 md:grid-cols-[280px_1fr]">
      <aside className="card h-fit space-y-2">
        <div className="flex items-center justify-between gap-3">
          <BrandLogo compact />
          <button
            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-primary"
            onClick={logout}
            type="button"
          >
            Logout
          </button>
        </div>
        <nav className="max-h-[75vh] space-y-1 overflow-y-auto pr-1">
          {availableLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`${isItemActive(item.to) ? 'bg-primary text-white' : 'bg-red-50 text-primary'} block rounded-md px-3 py-2 text-sm font-semibold`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div>
        <Outlet />
      </div>
    </section>
  );
}
