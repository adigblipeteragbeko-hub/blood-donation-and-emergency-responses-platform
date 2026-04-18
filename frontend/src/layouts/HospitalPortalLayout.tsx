import { NavLink, Outlet } from 'react-router-dom';

const coreLinks = [
  { to: '/hospital/dashboard', label: 'Dashboard' },
  { to: '/hospital/inventory', label: 'Blood Inventory' },
  { to: '/hospital/request-blood', label: 'Request Blood' },
  { to: '/hospital/active-requests', label: 'Active Requests' },
  { to: '/hospital/donor-search', label: 'Donor Search' },
  { to: '/hospital/appointments', label: 'Appointments' },
  { to: '/hospital/notifications', label: 'Notifications' },
  { to: '/hospital/reports', label: 'Reports' },
];

const moreLinks = [
  { to: '/hospital/emergency-requests', label: 'Emergency Requests' },
  { to: '/hospital/staff', label: 'Staff Management' },
  { to: '/hospital/profile', label: 'Profile / Hospital Info' },
  { to: '/hospital/settings', label: 'Settings' },
  { to: '/hospital/support', label: 'Support / Help' },
];

function linkClass(isActive: boolean) {
  return `${isActive ? 'bg-primary text-white' : 'bg-red-50 text-primary'} block rounded-md px-3 py-2 text-sm font-semibold`;
}

export function HospitalPortalLayout() {
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
            {coreLinks.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => linkClass(isActive)}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">More Tools</h3>
          <nav className="space-y-1">
            {moreLinks.map((item) => (
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

