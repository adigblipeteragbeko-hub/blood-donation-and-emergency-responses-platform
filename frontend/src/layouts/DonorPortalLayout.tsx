import { NavLink, Outlet } from 'react-router-dom';
import { LiveEmergencyAlertBanner } from '../components/LiveEmergencyAlertBanner';
import { AppIcon } from '../components/ui/AppIcon';

const donorLinks = [
  { to: '/donor/dashboard', label: 'Dashboard', icon: 'dashboard' as const },
  { to: '/donor/profile', label: 'Profile', icon: 'users' as const },
  { to: '/donor/card', label: 'Donor Card', icon: 'heart' as const },
  { to: '/donor/eligibility', label: 'Eligibility', icon: 'form' as const },
  { to: '/donor/history', label: 'History', icon: 'clock' as const },
  { to: '/donor/appointments', label: 'Appointments', icon: 'clock' as const },
  { to: '/donor/emergency-requests', label: 'Emergency', icon: 'alert' as const },
  { to: '/donor/notifications', label: 'Notifications', icon: 'notification' as const },
  { to: '/donor/availability', label: 'Availability', icon: 'settings' as const },
  { to: '/donor/live-location', label: 'Live Location', icon: 'map' as const },
  { to: '/donor/nearby-centers', label: 'Centers', icon: 'hospital' as const },
  { to: '/donor/rewards', label: 'Rewards', icon: 'reports' as const },
  { to: '/donor/health-form', label: 'Health Form', icon: 'form' as const },
  { to: '/donor/settings', label: 'Settings', icon: 'settings' as const },
  { to: '/donor/support', label: 'Support', icon: 'notification' as const },
];

export function DonorPortalLayout() {
  return (
    <section className="grid gap-5 overflow-x-hidden pt-6 md:grid-cols-[280px_minmax(0,1fr)] md:pt-8">
      <aside className="card h-fit space-y-2">
        <h2 className="flex items-center gap-2 text-lg font-bold text-primary">
          <AppIcon name="heart" className="h-5 w-5" />
          Donor Menu
        </h2>
        <nav className="max-h-[75vh] space-y-1 overflow-y-auto pr-1">
          {donorLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${isActive ? 'bg-primary text-white' : 'bg-red-50 text-primary'} flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold`
              }
            >
              <AppIcon name={item.icon} className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 space-y-5 pt-2 md:pt-3">
        <LiveEmergencyAlertBanner />
        <Outlet />
      </div>
    </section>
  );
}
