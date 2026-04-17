import { NavLink, Outlet } from 'react-router-dom';

const donorLinks = [
  { to: '/donor/dashboard', label: 'Dashboard' },
  { to: '/donor/profile', label: 'Profile' },
  { to: '/donor/eligibility', label: 'Eligibility' },
  { to: '/donor/appointments', label: 'Appointments' },
  { to: '/donor/emergency-requests', label: 'Emergency Requests' },
  { to: '/donor/notifications', label: 'Notifications' },
  { to: '/donor/history', label: 'History' },
  { to: '/donor/settings', label: 'Settings' },
];

export function DonorPortalLayout() {
  return (
    <section className="grid gap-5 md:grid-cols-[240px_1fr]">
      <aside className="card h-fit space-y-2">
        <h2 className="text-lg font-bold text-primary">Donor Menu</h2>
        <nav className="space-y-1">
          {donorLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${isActive ? 'bg-primary text-white' : 'bg-red-50 text-primary'} block rounded-md px-3 py-2 text-sm font-semibold`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div>
        <Outlet />
      </div>
    </section>
  );
}
