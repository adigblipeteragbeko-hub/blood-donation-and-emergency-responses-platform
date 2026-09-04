import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { BrandLogo } from '../components/BrandLogo';
import { FloatingAssistantLauncher } from '../components/FloatingAssistantLauncher';
import { PwaInstallPrompt } from '../components/PwaInstallPrompt';
import { getPublicWebsiteContent, WebsiteFooterSettingsItem } from '../services/website-management';
import { getHospitalNotifications, NotificationItem } from '../services/hospital-portal';

type HeaderNotificationItem = {
  id: string;
  type?: string | null;
  delivered: boolean;
};

const mapHeaderNotification = (item: NotificationItem): HeaderNotificationItem => ({
  id: item.id,
  type: item.type,
  delivered: Boolean(item.delivered),
});

const resolveRealtimeBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAuthenticated = Boolean(user && localStorage.getItem('accessToken'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [footerSettings, setFooterSettings] = useState<WebsiteFooterSettingsItem | null>(null);
  const [headerNotifications, setHeaderNotifications] = useState<HeaderNotificationItem[]>([]);

  const publicNavItems = [
    ['/', 'Home'],
    ['/about', 'About'],
    ['/how-it-works', 'How It Works'],
    ['/emergency-requests', 'Emergency Requests'],
    ['/nearby-centers', 'Blood Centers'],
    ['/donor-register', 'Become a Donor'],
    ['/assistant', 'Assistant'],
    ['/contact', 'Contact'],
    ['/login', 'Login'],
  ] as const;

  const authNavItems = useMemo(() => {
    if (!user) return [];
    if (user.role === 'DONOR') {
      return [
        ['/donor/dashboard', 'Dashboard'],
        ['/donor/notifications', 'Notifications'],
        ['/donor/profile', 'Profile'],
      ] as const;
    }
    if (user.role === 'HOSPITAL_ADMIN') {
      return [
        ['/hospital/dashboard', 'Dashboard'],
        ['/hospital/notifications', 'Notifications'],
        ['/hospital/profile', 'Profile'],
      ] as const;
    }
    return [
      ['/admin/dashboard', 'Dashboard'],
      ['/admin/management', 'Management'],
    ] as const;
  }, [user]);

  const desktopNavItems = isAuthenticated ? authNavItems : publicNavItems;

  const loadWebsiteChrome = useCallback(async () => {
    const websiteContent = await getPublicWebsiteContent();
    setFooterSettings(websiteContent.footerSettings);
  }, []);

  const loadHeaderNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setHeaderNotifications([]);
      return;
    }
    const feed = await getHospitalNotifications({ take: 100 });
    setHeaderNotifications(feed.map(mapHeaderNotification));
  }, [isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const [websiteContent, notifications] = await Promise.all([
          getPublicWebsiteContent(),
          isAuthenticated ? getHospitalNotifications({ take: 100 }) : Promise.resolve([]),
        ]);

        if (!isMounted) {
          return;
        }

        setFooterSettings(websiteContent.footerSettings);
        setHeaderNotifications(notifications.map(mapHeaderNotification));
      } catch {
        if (!isMounted) {
          return;
        }

        setHeaderNotifications([]);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const socket = io(`${resolveRealtimeBaseUrl()}/realtime`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const handleWebsiteUpdate = () => {
      void loadWebsiteChrome();
    };
    const handleNotificationUpdate = () => {
      void loadHeaderNotifications();
    };

    socket.on('website.announcement.updated', handleWebsiteUpdate);
    socket.on('notification.created', handleNotificationUpdate);
    window.addEventListener('notifications:changed', handleNotificationUpdate);

    return () => {
      socket.off('website.announcement.updated', handleWebsiteUpdate);
      socket.off('notification.created', handleNotificationUpdate);
      window.removeEventListener('notifications:changed', handleNotificationUpdate);
      socket.disconnect();
    };
  }, [loadHeaderNotifications, loadWebsiteChrome]);

  const unreadNotifications = headerNotifications.filter((notification) => !notification.delivered).length;
  const hasUnreadCritical = headerNotifications.some(
    (notification) => notification.type === 'EMERGENCY_REQUEST' && !notification.delivered,
  );
  const notificationPath = user?.role === 'DONOR'
    ? '/donor/notifications'
    : user?.role === 'HOSPITAL_ADMIN'
      ? '/hospital/notifications'
      : '/notifications';
  const openNotifications = () => {
    navigate(notificationPath);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white text-text">
      <header className="sticky top-3 z-40 mx-3 mt-3 rounded-[2rem] border border-red-100 bg-white/95 shadow-lg shadow-slate-950/5 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <BrandLogo />

          <button
            aria-controls="mobile-public-nav"
            aria-expanded={mobileMenuOpen}
            aria-label="Open site navigation"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-100 bg-white text-primary shadow-sm transition hover:border-red-200 hover:bg-red-50 lg:hidden"
            onClick={() => setMobileMenuOpen((value) => !value)}
            type="button"
          >
            <span className="sr-only">Menu</span>
            <span className="menu-bar" />
            <span className="menu-bar" />
            <span className="menu-bar" />
          </button>

          <div className="hidden items-center gap-3 lg:flex">
            <nav className="flex flex-wrap items-center gap-2 text-sm">
              {desktopNavItems.map(([path, label]) => (
                <NavLink
                  key={path}
                  to={path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `${isActive ? 'border-primary bg-primary text-white' : 'border-red-100 bg-white text-slate-700 hover:border-red-200 hover:text-primary'} rounded-full border px-4 py-2 font-semibold transition`
                  }
                >
                  {label}
                </NavLink>
              ))}
              {isAuthenticated ? (
                <button
                  className="rounded-full border border-primary bg-primary px-4 py-2 font-semibold text-white transition hover:bg-red-800"
                  onClick={logout}
                  type="button"
                >
                  Logout
                </button>
              ) : null}
            </nav>

            {isAuthenticated ? (
              <button
                aria-label="Open notifications"
                className={`announcement-bell group ${hasUnreadCritical ? 'announcement-bell-urgent' : ''}`}
                onClick={openNotifications}
                type="button"
              >
                <span className="sr-only">Notifications</span>
                <svg aria-hidden="true" className="h-5 w-5 transition group-hover:scale-105" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M14.857 17H9.143a2 2 0 0 0 3.714 0ZM18 17V11a6 6 0 1 0-12 0v6l-2 2v1h16v-1l-2-2Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
                {unreadNotifications > 0 ? (
                  <span className="announcement-bell-badge">{Math.min(unreadNotifications, 9)}</span>
                ) : null}
              </button>
            ) : null}
          </div>
        </div>

        <div className={`${mobileMenuOpen ? 'block' : 'hidden'} border-t border-red-100 px-4 pb-4 lg:hidden`} id="mobile-public-nav">
          <nav className="grid gap-2 pt-4 text-sm">
            {desktopNavItems.map(([path, label]) => (
              <NavLink
                key={path}
                to={path}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `${isActive ? 'border-primary bg-primary text-white' : 'border-red-100 bg-white text-slate-700 hover:border-red-200 hover:text-primary'} rounded-2xl border px-4 py-3 font-semibold transition`
                }
              >
                {label}
              </NavLink>
            ))}
            {isAuthenticated ? (
              <button
                className="rounded-2xl border border-primary bg-primary px-4 py-3 text-left font-semibold text-white transition hover:bg-red-800"
                onClick={logout}
                type="button"
              >
                Logout
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="page-content-safe-bottom mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-red-100 bg-slate-950 text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-4">
            <BrandLogo light className="border-white/10 bg-white/10 shadow-none hover:bg-white/15" />
            <p className="text-sm leading-7 text-slate-300">
              A safer public-facing blood donation and emergency response platform built to help hospitals and donors
              respond faster when lives are on the line.
            </p>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-300">Quick Links</p>
            <div className="mt-4 grid gap-3 text-sm">
              {publicNavItems.slice(0, 6).map(([path, label]) => (
                <Link key={path} className="transition hover:text-white" to={path}>
                  {label}
                </Link>
              ))}
              <Link className="transition hover:text-white" to="/faq">
                FAQ
              </Link>
              <Link className="transition hover:text-white" to="/blood-eligibility">
                Blood Eligibility
              </Link>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-300">Emergency Contact</p>
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <p>{footerSettings?.emergencyPhonePrimary ?? '+233 544515775'}</p>
              <p>{footerSettings?.emergencyPhoneSecondary ?? '+233 554287342'}</p>
              <p>{footerSettings?.supportEmail ?? 'support@bloodresponse.local'}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold uppercase tracking-[0.22em] text-red-300">Social & Policy</p>
            <div className="mt-4 grid gap-3 text-sm text-slate-300">
              <a className="transition hover:text-white" href={footerSettings?.facebookUrl ?? '#'} rel="noreferrer" target="_blank">
                Facebook
              </a>
              <a className="transition hover:text-white" href={footerSettings?.instagramUrl ?? '#'} rel="noreferrer" target="_blank">
                Instagram
              </a>
              <a className="transition hover:text-white" href={footerSettings?.linkedinUrl ?? '#'} rel="noreferrer" target="_blank">
                LinkedIn
              </a>
              <Link className="transition hover:text-white" to="/contact">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-xs text-slate-400">
            <p>&copy; 2026 Donation Desk. All rights reserved.</p>
            <p>{footerSettings?.footerText ?? 'Built for trusted donor coordination, hospital response, and emergency visibility.'}</p>
          </div>
        </div>
      </footer>
      <PwaInstallPrompt />
      <FloatingAssistantLauncher />
    </div>
  );
}
