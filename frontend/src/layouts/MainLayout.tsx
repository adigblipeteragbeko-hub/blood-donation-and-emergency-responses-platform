import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { publicEmergencyAlerts } from '../data/publicContent';
import {
  AwarenessPostItem,
  getPublicWebsiteContent,
  WebsiteAlertItem,
  WebsiteFooterSettingsItem,
} from '../services/website-management';

const formatBloodGroup = (value: string) =>
  value
    .replace('_POS', '+')
    .replace('_NEG', '-')
    .replace('_', ' ');

type AnnouncementItem = {
  id: string;
  type: 'alert' | 'awareness' | 'system';
  title: string;
  message: string;
  createdAt: string;
  href: string;
  priority: 'normal' | 'high' | 'critical';
  badge?: string;
};

const urgencyToPriority = (urgency?: WebsiteAlertItem['urgencyLevel']): AnnouncementItem['priority'] => {
  if (urgency === 'CRITICAL') return 'critical';
  if (urgency === 'HIGH') return 'high';
  return 'normal';
};

const formatAnnouncementTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const formatRelativeTime = (value: string) => {
  const diffMinutes = Math.max(1, Math.round((new Date(value).getTime() - Date.now()) / 60000));
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  return rtf.format(Math.round(diffHours / 24), 'day');
};

const trimAnnouncementMessage = (message: string) => (message.length > 110 ? `${message.slice(0, 107)}...` : message);

const buildAnnouncements = (alert: WebsiteAlertItem | null, awarenessPosts: AwarenessPostItem[]): AnnouncementItem[] => {
  const items: AnnouncementItem[] = [];

  if (alert) {
    items.push({
      id: `alert-${alert.id}`,
      type: 'alert',
      title: `${alert.urgencyLevel === 'CRITICAL' ? 'Urgent' : 'Active'} alert: ${formatBloodGroup(alert.bloodType ?? 'O_NEG')}`,
      message: `${alert.message} at ${alert.hospitalName}.`,
      createdAt: alert.updatedAt ?? alert.createdAt,
      href: '/emergency-requests',
      priority: urgencyToPriority(alert.urgencyLevel),
      badge: alert.isSticky ? 'Sticky' : 'Live',
    });
  }

  awarenessPosts.slice(0, 4).forEach((post) => {
    items.push({
      id: `awareness-${post.id}`,
      type: 'awareness',
      title: post.title,
      message: trimAnnouncementMessage(post.content),
      createdAt: post.updatedAt ?? post.createdAt,
      href: '/about',
      priority: 'normal',
      badge: post.category,
    });
  });

  items.push({
    id: 'system-contact',
    type: 'system',
    title: 'Support channels are live',
    message: 'Emergency contacts, partner hospitals, and support channels are monitored for faster response.',
    createdAt: new Date().toISOString(),
    href: '/contact',
    priority: 'normal',
    badge: 'System',
  });

  return items
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6);
};

export function MainLayout() {
  const { user, logout } = useAuth();
  const isAuthenticated = Boolean(user && localStorage.getItem('accessToken'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [liveAlert, setLiveAlert] = useState<{ bloodType: string | null; hospitalName: string } | null>(null);
  const [footerSettings, setFooterSettings] = useState<WebsiteFooterSettingsItem | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [lastAnnouncementViewAt, setLastAnnouncementViewAt] = useState<number>(0);
  const announcementPanelRef = useRef<HTMLDivElement | null>(null);
  const publicNavItems = [
    ['/', 'Home'],
    ['/about', 'About'],
    ['/how-it-works', 'How It Works'],
    ['/emergency-requests', 'Emergency Requests'],
    ['/donor-register', 'Become a Donor'],
    ['/contact', 'Contact'],
    ['/login', 'Login'],
  ] as const;
  const alertItem = liveAlert
    ? {
        bloodType: formatBloodGroup(liveAlert.bloodType ?? 'O_NEG'),
        hospital: liveAlert.hospitalName,
      }
    : publicEmergencyAlerts[0];

  useEffect(() => {
    let isMounted = true;

    const loadWebsiteChrome = async () => {
      try {
        const websiteContent = await getPublicWebsiteContent();
        if (!isMounted) {
          return;
        }

        setLiveAlert(
          websiteContent.alert
            ? { bloodType: websiteContent.alert.bloodType, hospitalName: websiteContent.alert.hospitalName }
            : null,
        );
        setFooterSettings(websiteContent.footerSettings);
        setAnnouncements(buildAnnouncements(websiteContent.alert, websiteContent.awarenessPosts));
      } catch {
        if (!isMounted) {
          return;
        }
        setLiveAlert(null);
      }
    };

    loadWebsiteChrome();
    const interval = window.setInterval(loadWebsiteChrome, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!announcementPanelRef.current?.contains(event.target as Node)) {
        setAnnouncementsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAnnouncementsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const authNavItems = useMemo(() => {
    if (!user) return [];
    if (user.role === 'DONOR') {
      return [
        ['/donor/dashboard', 'Dashboard'],
        ['/donor/notifications', 'Notifications'],
        ['/donor/profile', 'Profile'],
      ] as const;
    }
    if (user.role === 'HOSPITAL_STAFF') {
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
  const unreadAnnouncements = announcements.filter((announcement) => new Date(announcement.createdAt).getTime() > lastAnnouncementViewAt)
    .length;
  const recentAnnouncements = announcements.filter((announcement) => Date.now() - new Date(announcement.createdAt).getTime() < 1000 * 60 * 60 * 12)
    .length;

  const toggleAnnouncements = () => {
    setAnnouncementsOpen((current) => {
      const next = !current;
      if (!current) {
        setLastAnnouncementViewAt(Date.now());
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-white text-text">
      <div className="sticky top-0 z-50 border-b border-red-200 bg-primary px-4 py-2 text-sm text-white shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
          <p className="font-semibold">
            URGENT: {alertItem.bloodType} blood needed at {alertItem.hospital}
          </p>
          <Link
            className="rounded-full border border-white/30 px-3 py-1 text-xs font-bold uppercase tracking-wide transition hover:bg-white/10"
            to="/emergency-requests"
          >
            View Alert
          </Link>
        </div>
      </div>

      <header className="sticky top-[45px] z-40 border-b border-red-100 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link
            to="/"
            className="rounded-full border border-red-100 bg-white px-4 py-2 text-lg font-extrabold text-primary shadow-sm"
          >
            Donation Desk
          </Link>

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

            <div className="relative" ref={announcementPanelRef}>
              <button
                aria-expanded={announcementsOpen}
                aria-haspopup="dialog"
                aria-label="Open announcements"
                className="announcement-bell group"
                onClick={toggleAnnouncements}
                type="button"
              >
                <span className="sr-only">Announcements</span>
                <svg aria-hidden="true" className="h-5 w-5 transition group-hover:scale-105" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M14.857 17H9.143a2 2 0 0 0 3.714 0ZM18 17V11a6 6 0 1 0-12 0v6l-2 2v1h16v-1l-2-2Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
                {unreadAnnouncements > 0 ? (
                  <span className="announcement-bell-badge">{Math.min(unreadAnnouncements, 9)}</span>
                ) : null}
              </button>

              {announcementsOpen ? (
                <div className="announcement-panel" role="dialog" aria-label="Announcements panel">
                  <div className="announcement-panel-header">
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">Announcements</p>
                      <p className="text-xs text-slate-500">
                        {recentAnnouncements > 0 ? `${recentAnnouncements} recent update${recentAnnouncements > 1 ? 's' : ''}` : 'All caught up'}
                      </p>
                    </div>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                      Live feed
                    </span>
                  </div>

                  <div className="announcement-panel-list">
                    {announcements.length ? (
                      announcements.map((announcement) => (
                        <Link
                          key={announcement.id}
                          className={`announcement-item announcement-item-${announcement.priority}`}
                          onClick={() => setAnnouncementsOpen(false)}
                          to={announcement.href}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`announcement-pill announcement-pill-${announcement.type}`}>{announcement.type}</span>
                                {announcement.badge ? <span className="announcement-pill announcement-pill-neutral">{announcement.badge}</span> : null}
                              </div>
                              <p className="text-sm font-bold text-slate-900">{announcement.title}</p>
                              <p className="text-sm leading-6 text-slate-600">{announcement.message}</p>
                            </div>
                            <span className={`announcement-priority-dot announcement-priority-dot-${announcement.priority}`} />
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span>{formatAnnouncementTime(announcement.createdAt)}</span>
                            <span>{formatRelativeTime(announcement.createdAt)}</span>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-red-200 bg-rose-50/50 px-4 py-6 text-center text-sm text-slate-500">
                        No announcements yet. New alerts and awareness updates will appear here automatically.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className={`${mobileMenuOpen ? 'block' : 'hidden'} border-t border-red-100 px-4 pb-4 lg:hidden`} id="mobile-public-nav">
          <div className="mb-4 mt-4 rounded-3xl border border-red-100 bg-white p-4 shadow-sm">
            <button
              aria-expanded={announcementsOpen}
              aria-haspopup="dialog"
              className="flex w-full items-center justify-between rounded-2xl border border-red-100 bg-rose-50/60 px-4 py-3 text-left transition hover:border-red-200"
              onClick={toggleAnnouncements}
              type="button"
            >
              <span>
                <span className="block text-sm font-extrabold text-slate-900">Announcements</span>
                <span className="block text-xs text-slate-500">
                  {unreadAnnouncements > 0 ? `${unreadAnnouncements} unread update${unreadAnnouncements > 1 ? 's' : ''}` : 'Tap to review latest alerts'}
                </span>
              </span>
              <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-red-200 bg-white text-primary shadow-sm">
                <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M14.857 17H9.143a2 2 0 0 0 3.714 0ZM18 17V11a6 6 0 1 0-12 0v6l-2 2v1h16v-1l-2-2Z"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                  />
                </svg>
                {unreadAnnouncements > 0 ? <span className="announcement-bell-badge">{Math.min(unreadAnnouncements, 9)}</span> : null}
              </span>
            </button>

            {announcementsOpen ? (
              <div className="mt-3 grid gap-3">
                {announcements.map((announcement) => (
                  <Link
                    key={announcement.id}
                    className={`announcement-item announcement-item-${announcement.priority}`}
                    onClick={() => {
                      setAnnouncementsOpen(false);
                      setMobileMenuOpen(false);
                    }}
                    to={announcement.href}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`announcement-pill announcement-pill-${announcement.type}`}>{announcement.type}</span>
                      {announcement.badge ? <span className="announcement-pill announcement-pill-neutral">{announcement.badge}</span> : null}
                    </div>
                    <p className="mt-2 text-sm font-bold text-slate-900">{announcement.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{announcement.message}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                      <span>{formatAnnouncementTime(announcement.createdAt)}</span>
                      <span>{formatRelativeTime(announcement.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

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

      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-red-100 bg-slate-950 text-slate-200">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-4">
            <p className="text-xl font-extrabold text-white">Donation Desk</p>
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
    </div>
  );
}
