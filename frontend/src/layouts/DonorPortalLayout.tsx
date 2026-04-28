import { NavLink, Outlet } from 'react-router-dom';

const donorLinks = [
  { to: '/donor/dashboard', label: 'Dashboard' },
  { to: '/donor/profile', label: 'My Profile' },
  { to: '/donor/card', label: 'Digital Donor Card' },
  { to: '/donor/eligibility', label: 'Eligibility Status' },
  { to: '/donor/history', label: 'Donation History' },
  { to: '/donor/appointments', label: 'Appointments' },
  { to: '/donor/emergency-requests', label: 'Emergency Requests' },
  { to: '/donor/notifications', label: 'Notifications' },
  { to: '/donor/availability', label: 'Availability Status' },
  { to: '/donor/nearby-centers', label: 'Nearby Centers' },
  { to: '/donor/rewards', label: 'Rewards / Achievements' },
  { to: '/donor/health-form', label: 'Health & Eligibility Form' },
  { to: '/donor/settings', label: 'Settings' },
  { to: '/donor/support', label: 'Support / Help' },
];

export function DonorPortalLayout() {
  return (
    <section className="grid gap-5 md:grid-cols-[280px_1fr]">
      <aside className="card h-fit space-y-2">
        <h2 className="text-lg font-bold text-primary">Donor Menu</h2>
        <nav className="max-h-[75vh] space-y-1 overflow-y-auto pr-1">
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
