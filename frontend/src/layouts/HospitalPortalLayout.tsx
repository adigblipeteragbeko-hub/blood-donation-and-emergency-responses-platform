import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LiveEmergencyAlertBanner } from '../components/LiveEmergencyAlertBanner';
import { AppIcon } from '../components/ui/AppIcon';

type PortalLink = {
  to: string;
  label: string;
  icon: Parameters<typeof AppIcon>[0]['name'];
  roles: string[];
};

const coreLinks: PortalLink[] = [
  { to: '/hospital/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
  { to: '/hospital/inventory', label: 'Inventory', icon: 'inventory', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
  { to: '/hospital/request-blood', label: 'Request Blood', icon: 'alert', roles: ['HOSPITAL_STAFF'] },
  { to: '/hospital/active-requests', label: 'Active Requests', icon: 'clock', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
  { to: '/hospital/donor-search', label: 'Donor Search', icon: 'users', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
  { to: '/hospital/donor-reviews', label: 'Clinical Reviews', icon: 'form', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
  { to: '/hospital/live-map', label: 'Live Map', icon: 'map', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
  { to: '/hospital/appointments', label: 'Appointments', icon: 'clock', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
  { to: '/hospital/notifications', label: 'Notifications', icon: 'notification', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
  { to: '/hospital/reports', label: 'Reports', icon: 'reports', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
];

const moreLinks: PortalLink[] = [
  { to: '/hospital/emergency-requests', label: 'Emergency', icon: 'alert', roles: ['HOSPITAL_STAFF'] },
  { to: '/hospital/profile', label: 'Profile', icon: 'hospital', roles: ['HOSPITAL_STAFF'] },
  { to: '/hospital/settings', label: 'Settings', icon: 'settings', roles: ['HOSPITAL_STAFF'] },
  { to: '/hospital/support', label: 'Support', icon: 'notification', roles: ['HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER'] },
];

function linkClass(isActive: boolean) {
  return `${isActive ? 'bg-primary text-white' : 'bg-red-50 text-primary'} flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold`;
}

export function HospitalPortalLayout() {
  const { user } = useAuth();
  const coreRoleLinks = coreLinks.filter((item) => user?.role && item.roles.includes(user.role));
  const secondaryRoleLinks = moreLinks.filter((item) => user?.role && item.roles.includes(user.role));

  return (
    <section className="grid gap-5 overflow-x-hidden pt-6 md:grid-cols-[300px_minmax(0,1fr)] md:pt-8">
      <aside className="card h-fit space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
            <AppIcon name="hospital" className="h-5 w-5" />
            Hospital Portal
          </h2>
          <p className="text-sm text-muted">Requests, stock, donors, alerts.</p>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Core Tabs</h3>
          <nav className="space-y-1">
            {coreRoleLinks.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)}>
                <AppIcon name={item.icon} className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">More Tools</h3>
          <nav className="space-y-1">
            {secondaryRoleLinks.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)}>
                <AppIcon name={item.icon} className="h-4 w-4 shrink-0" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <div className="min-w-0 space-y-5 pt-2 md:pt-3">
        <LiveEmergencyAlertBanner />
        <Outlet />
      </div>
    </section>
  );
}

