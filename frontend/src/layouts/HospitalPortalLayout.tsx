import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const coreLinks = [
  { to: '/hospital/dashboard', label: 'Dashboard', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'INVENTORY_OFFICER', 'DONOR_REVIEW_OFFICER'] },
  { to: '/hospital/inventory', label: 'Blood Inventory', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'INVENTORY_OFFICER'] },
  { to: '/hospital/request-blood', label: 'Request Blood', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'] },
  { to: '/hospital/active-requests', label: 'Active Requests', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'DONOR_REVIEW_OFFICER'] },
  { to: '/hospital/donor-search', label: 'Donor Search', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'DONOR_REVIEW_OFFICER'] },
  { to: '/hospital/appointments', label: 'Appointments', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'DONOR_REVIEW_OFFICER'] },
  { to: '/hospital/notifications', label: 'Notifications', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'INVENTORY_OFFICER', 'DONOR_REVIEW_OFFICER'] },
  { to: '/hospital/reports', label: 'Reports', roles: ['HOSPITAL_ADMIN', 'INVENTORY_OFFICER'] },
];

const moreLinks = [
  { to: '/hospital/emergency-requests', label: 'Emergency Requests', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'] },
  { to: '/hospital/staff', label: 'Staff Management', roles: ['HOSPITAL_ADMIN'] },
  { to: '/hospital/profile', label: 'Profile / Hospital Info', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF'] },
  { to: '/hospital/settings', label: 'Settings', roles: ['HOSPITAL_ADMIN'] },
  { to: '/hospital/support', label: 'Support / Help', roles: ['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'INVENTORY_OFFICER', 'DONOR_REVIEW_OFFICER'] },
];

function linkClass(isActive: boolean) {
  return `${isActive ? 'bg-primary text-white' : 'bg-red-50 text-primary'} block rounded-md px-3 py-2 text-sm font-semibold`;
}

export function HospitalPortalLayout() {
  const { user } = useAuth();
  const coreRoleLinks = coreLinks.filter((item) => user?.role && item.roles.includes(user.role));
  const secondaryRoleLinks = moreLinks.filter((item) => user?.role && item.roles.includes(user.role));

  return (
    <section className="grid gap-5 md:grid-cols-[300px_1fr]">
      <aside className="card h-fit space-y-4">
        <div>
          <h2 className="text-lg font-bold text-primary">Hospital Portal</h2>
          <p className="text-sm text-muted">Manage requests, stock, donors, and alerts.</p>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Core Tabs</h3>
          <nav className="space-y-1">
            {coreRoleLinks.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)}>
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
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <div>
        <Outlet />
      </div>
    </section>
  );
}
