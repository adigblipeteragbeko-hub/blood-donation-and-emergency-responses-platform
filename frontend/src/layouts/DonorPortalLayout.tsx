import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LiveEmergencyAlertBanner } from '../components/LiveEmergencyAlertBanner';
import { AppIcon } from '../components/ui/AppIcon';
import { AccountIdentityMenu } from '../components/AccountIdentityMenu';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { buildAccountIdentity } from '../utils/account-identity';
import { rememberAccount } from '../utils/remembered-accounts';

const donorLinks = [
  { to: '/donor/dashboard', label: 'Dashboard', icon: 'dashboard' as const },
  { to: '/donor/assistant', label: 'Assistant', icon: 'notification' as const },
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
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<Parameters<typeof buildAccountIdentity>[0]['donorProfile']>(null);
  const identity = useMemo(() => buildAccountIdentity({ user, donorProfile: profile }), [profile, user]);

  useEffect(() => {
    let mounted = true;
    const loadProfile = () => api.get('/donors/profile')
      .then((response) => {
        if (mounted) setProfile(response.data?.data ?? response.data ?? null);
      })
      .catch(() => {
        if (mounted) setProfile(null);
      });
    void loadProfile();
    const onProfileImage = (event: Event) => {
      const detail = (event as CustomEvent).detail;
      if (detail && mounted) {
        setProfile((current) => ({ ...(current ?? {}), ...detail }));
      } else {
        void loadProfile();
      }
    };
    window.addEventListener('donor-profile-image-updated', onProfileImage);
    return () => {
      mounted = false;
      window.removeEventListener('donor-profile-image-updated', onProfileImage);
    };
  }, []);

  useEffect(() => {
    if (identity) rememberAccount(identity);
  }, [identity]);

  return (
    <section className="grid gap-4 overflow-x-hidden pt-4 md:grid-cols-[250px_minmax(0,1fr)] md:pt-6 xl:grid-cols-[238px_minmax(0,1fr)]">
      <aside className="card h-fit space-y-2 p-4">
        <AccountIdentityMenu identity={identity} onLogout={logout} />
        <h2 className="flex items-center gap-2 text-base font-bold text-primary">
          <AppIcon name="heart" className="h-5 w-5" />
          Donor Menu
        </h2>
        <nav className="max-h-[78vh] space-y-1 overflow-y-auto pr-1">
          {donorLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${isActive ? 'bg-primary text-white shadow-sm' : 'bg-red-50 text-primary hover:bg-red-100'} flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition`
              }
            >
              <AppIcon name={item.icon} className="h-4 w-4 shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="page-content-safe-bottom min-w-0 space-y-5 pt-2 md:pt-3">
        <LiveEmergencyAlertBanner />
        <Outlet />
      </div>
    </section>
  );
}
