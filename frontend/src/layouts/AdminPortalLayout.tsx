import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const adminLinks = [
  { to: '/admin/dashboard', label: 'Dashboard Overview' },
  { to: '/admin/management#settings', label: 'Manage Users' },
  { to: '/admin/management#donors', label: 'Manage Donors' },
  { to: '/admin/management#hospitals', label: 'Manage Hospitals' },
  { to: '/admin/management#request-tracking', label: 'Manage Requests' },
  { to: '/admin/management#inventory-tracking', label: 'Manage Inventory' },
  { to: '/admin/management#audit', label: 'Audit Logs' },
];

export function AdminPortalLayout() {
  const { logout } = useAuth();
  const location = useLocation();

  const isItemActive = (to: string) => {
    const [path, hash] = to.split('#');
    if (location.pathname !== path) {
      return false;
    }
    const currentHash = location.hash.replace('#', '');
    const targetHash = hash ?? '';
    if (!targetHash) {
      return currentHash === '';
    }
    return currentHash === targetHash;
  };

  return (
    <section className="grid gap-5 md:grid-cols-[280px_1fr]">
      <aside className="card h-fit space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-primary">Admin Menu</h2>
          <button
            className="rounded-md border border-red-300 px-2 py-1 text-xs font-semibold text-primary"
            onClick={logout}
            type="button"
          >
            Logout
          </button>
        </div>
        <nav className="max-h-[75vh] space-y-1 overflow-y-auto pr-1">
          {adminLinks.map((item) => (
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
