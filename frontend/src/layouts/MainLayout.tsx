import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { publicEmergencyAlerts } from '../data/publicContent';
import { BrandLogo } from '../components/BrandLogo';
import {
  getPublicAnnouncements,
  getPublicWebsiteContent,
  getUserAnnouncements,
  markAllAnnouncementsRead,
  markAnnouncementRead,
  WebsiteAnnouncementItem,
  WebsiteFooterSettingsItem,
} from '../services/website-management';

const ANNOUNCEMENT_READ_STORAGE_KEY = 'public-announcements-read-state';
const ANNOUNCEMENT_MUTE_STORAGE_KEY = 'public-announcements-muted';

const formatBloodGroup = (value: string) =>
  value.replace('_POS', '+').replace('_NEG', '-').replace('_', ' ');

type AnnouncementItem = {
  id: string;
  type: 'alert' | 'awareness' | 'system';
  title: string;
  message: string;
  createdAt: string;
  updatedAt: string;
  href: string;
  priority: 'normal' | 'high' | 'critical';
  badge?: string | null;
  isRead: boolean;
};

type AnnouncementFilter = 'ALL' | 'ALERT' | 'AWARENESS' | 'SYSTEM';

const formatAnnouncementTime = (value: string) =>
  new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

const formatRelativeTime = (value: string) => {
  const diffMinutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
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

const trimAnnouncementMessage = (message: string) =>
  message.length > 110 ? `${message.slice(0, 107)}...` : message;

const mapPriority = (priority: WebsiteAnnouncementItem['priority']): AnnouncementItem['priority'] => {
  if (priority === 'CRITICAL') return 'critical';
  if (priority === 'HIGH') return 'high';
  return 'normal';
};

const mapType = (type: WebsiteAnnouncementItem['type']): AnnouncementItem['type'] => {
  if (type === 'ALERT') return 'alert';
  if (type === 'AWARENESS') return 'awareness';
  return 'system';
};

const mapAnnouncementItem = (
  item: WebsiteAnnouncementItem,
  isAuthenticated: boolean,
  guestReadAnnouncements: Record<string, number>,
): AnnouncementItem => ({
  id: item.id,
  type: mapType(item.type),
  title: item.title,
  message: item.type === 'AWARENESS' ? trimAnnouncementMessage(item.message) : item.message,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  href: item.href,
  priority: mapPriority(item.priority),
  badge: item.badge,
  isRead: isAuthenticated ? Boolean(item.isRead) : Boolean(guestReadAnnouncements[item.id]),
});

const resolveRealtimeBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

export function MainLayout() {
  const { user, logout } = useAuth();
  const isAuthenticated = Boolean(user && localStorage.getItem('accessToken'));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [announcementsOpen, setAnnouncementsOpen] = useState(false);
  const [announcementFilter, setAnnouncementFilter] = useState<AnnouncementFilter>('ALL');
  const [liveAlert, setLiveAlert] = useState<{ bloodType: string | null; hospitalName: string } | null>(null);
  const [footerSettings, setFooterSettings] = useState<WebsiteFooterSettingsItem | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>([]);
  const [guestReadAnnouncements, setGuestReadAnnouncements] = useState<Record<string, number>>({});
  const [announcementsMuted, setAnnouncementsMuted] = useState(false);
  const [lastAnnouncementSyncAt, setLastAnnouncementSyncAt] = useState<string | null>(null);
  const announcementPanelRef = useRef<HTMLDivElement | null>(null);
  const latestCriticalAnnouncementIdRef = useRef<string | null>(null);

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

  useEffect(() => {
    try {
      const storedReadState = window.localStorage.getItem(ANNOUNCEMENT_READ_STORAGE_KEY);
      const storedMutedState = window.localStorage.getItem(ANNOUNCEMENT_MUTE_STORAGE_KEY);

      if (storedReadState) {
        setGuestReadAnnouncements(JSON.parse(storedReadState) as Record<string, number>);
      }

      if (storedMutedState) {
        setAnnouncementsMuted(storedMutedState === 'true');
      }
    } catch {
      // Local storage is optional here.
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    try {
      window.localStorage.setItem(ANNOUNCEMENT_READ_STORAGE_KEY, JSON.stringify(guestReadAnnouncements));
    } catch {
      // Ignore storage write errors.
    }
  }, [guestReadAnnouncements, isAuthenticated]);

  useEffect(() => {
    try {
      window.localStorage.setItem(ANNOUNCEMENT_MUTE_STORAGE_KEY, announcementsMuted ? 'true' : 'false');
    } catch {
      // Ignore storage write errors.
    }
  }, [announcementsMuted]);

  const loadWebsiteChrome = useCallback(async () => {
    const websiteContent = await getPublicWebsiteContent();
    setLiveAlert(
      websiteContent.alert
        ? { bloodType: websiteContent.alert.bloodType, hospitalName: websiteContent.alert.hospitalName }
        : null,
    );
    setFooterSettings(websiteContent.footerSettings);
  }, []);

  const loadAnnouncements = useCallback(async () => {
    const feed = isAuthenticated ? await getUserAnnouncements() : await getPublicAnnouncements();
    setAnnouncements(feed.map((item) => mapAnnouncementItem(item, isAuthenticated, guestReadAnnouncements)));
    setLastAnnouncementSyncAt(new Date().toISOString());
  }, [guestReadAnnouncements, isAuthenticated]);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      try {
        const [websiteContent, feed] = await Promise.all([
          getPublicWebsiteContent(),
          isAuthenticated ? getUserAnnouncements() : getPublicAnnouncements(),
        ]);

        if (!isMounted) {
          return;
        }

        setLiveAlert(
          websiteContent.alert
            ? { bloodType: websiteContent.alert.bloodType, hospitalName: websiteContent.alert.hospitalName }
            : null,
        );
        setFooterSettings(websiteContent.footerSettings);
        setAnnouncements(feed.map((item) => mapAnnouncementItem(item, isAuthenticated, guestReadAnnouncements)));
        setLastAnnouncementSyncAt(new Date().toISOString());
      } catch {
        if (!isMounted) {
          return;
        }

        setLiveAlert(null);
        setAnnouncements([]);
      }
    };

    void bootstrap();

    return () => {
      isMounted = false;
    };
  }, [guestReadAnnouncements, isAuthenticated]);

  useEffect(() => {
    const socket = io(`${resolveRealtimeBaseUrl()}/realtime`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const handleAnnouncementUpdate = () => {
      void Promise.all([loadWebsiteChrome(), loadAnnouncements()]);
    };

    socket.on('website.announcement.updated', handleAnnouncementUpdate);

    return () => {
      socket.off('website.announcement.updated', handleAnnouncementUpdate);
      socket.disconnect();
    };
  }, [loadAnnouncements, loadWebsiteChrome]);

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

  useEffect(() => {
    const latestCritical = announcements.find((announcement) => announcement.priority === 'critical');

    if (!latestCritical) {
      latestCriticalAnnouncementIdRef.current = null;
      return;
    }

    const isNewCritical = latestCriticalAnnouncementIdRef.current !== latestCritical.id;
    latestCriticalAnnouncementIdRef.current = latestCritical.id;

    if (!isNewCritical || announcementsMuted) {
      return;
    }

    try {
      const audioContext = new AudioContext();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.0001;
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      const now = audioContext.currentTime;
      gainNode.gain.exponentialRampToValueAtTime(0.03, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
      oscillator.start(now);
      oscillator.stop(now + 0.24);
    } catch {
      // Browsers can block sound before user interaction; the visual pulse still works.
    }
  }, [announcements, announcementsMuted]);

  const unreadAnnouncements = announcements.filter((announcement) => !announcement.isRead).length;
  const recentAnnouncements = announcements.filter(
    (announcement) => Date.now() - new Date(announcement.updatedAt).getTime() < 1000 * 60 * 60 * 12,
  ).length;
  const hasUnreadCritical = announcements.some(
    (announcement) => announcement.priority === 'critical' && !announcement.isRead,
  );

  const filteredAnnouncements = announcements.filter((announcement) => {
    if (announcementFilter === 'ALL') return true;
    if (announcementFilter === 'ALERT') return announcement.type === 'alert';
    if (announcementFilter === 'AWARENESS') return announcement.type === 'awareness';
    return announcement.type === 'system';
  });

  const announcementFilters: { value: AnnouncementFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'ALERT', label: 'Alerts' },
    { value: 'AWARENESS', label: 'News' },
    { value: 'SYSTEM', label: 'System' },
  ];

  const markAnnouncementAsReadAndClose = async (announcementId: string) => {
    if (isAuthenticated) {
      setAnnouncements((current) =>
        current.map((announcement) =>
          announcement.id === announcementId ? { ...announcement, isRead: true } : announcement,
        ),
      );

      try {
        await markAnnouncementRead(announcementId);
      } catch {
        // Keep the optimistic UI state; the next live sync will reconcile if needed.
      }
    } else {
      setGuestReadAnnouncements((current) => ({ ...current, [announcementId]: Date.now() }));
      setAnnouncements((current) =>
        current.map((announcement) =>
          announcement.id === announcementId ? { ...announcement, isRead: true } : announcement,
        ),
      );
    }

    setAnnouncementsOpen(false);
  };

  const markAllAsRead = async () => {
    setAnnouncements((current) => current.map((announcement) => ({ ...announcement, isRead: true })));

    if (isAuthenticated) {
      try {
        await markAllAnnouncementsRead();
      } catch {
        // Keep optimistic state and let the next refresh reconcile if needed.
      }
      return;
    }

    const now = Date.now();
    const nextGuestState = announcements.reduce<Record<string, number>>((accumulator, announcement) => {
      accumulator[announcement.id] = now;
      return accumulator;
    }, {});

    setGuestReadAnnouncements((current) => ({ ...current, ...nextGuestState }));
  };

  const toggleAnnouncements = () => {
    setAnnouncementsOpen((current) => {
      const next = !current;
      if (next) {
        setAnnouncementFilter('ALL');
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

            <div className="relative" ref={announcementPanelRef}>
              <button
                aria-expanded={announcementsOpen}
                aria-haspopup="dialog"
                aria-label="Open announcements"
                className={`announcement-bell group ${hasUnreadCritical ? 'announcement-bell-urgent' : ''}`}
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
                        {recentAnnouncements > 0
                          ? `${recentAnnouncements} recent update${recentAnnouncements > 1 ? 's' : ''}`
                          : 'All caught up'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
                          announcementsMuted
                            ? 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                            : 'border-red-200 bg-red-50 text-primary hover:border-red-300 hover:bg-red-100'
                        }`}
                        onClick={() => setAnnouncementsMuted((current) => !current)}
                        type="button"
                      >
                        {announcementsMuted ? 'Sound off' : 'Sound on'}
                      </button>
                      <span className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-primary">
                        Live feed
                      </span>
                    </div>
                  </div>

                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2">
                      {announcementFilters.map((filter) => (
                        <button
                          key={filter.value}
                          className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                            announcementFilter === filter.value
                              ? 'border-primary bg-primary text-white'
                              : 'border-red-100 bg-white text-slate-600 hover:border-red-200 hover:text-primary'
                          }`}
                          onClick={() => setAnnouncementFilter(filter.value)}
                          type="button"
                        >
                          {filter.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{lastAnnouncementSyncAt ? `Synced ${formatRelativeTime(lastAnnouncementSyncAt)}` : 'Syncing...'}</span>
                      <button className="font-bold text-primary transition hover:text-red-800" onClick={markAllAsRead} type="button">
                        Mark all read
                      </button>
                    </div>
                  </div>

                  <div className="announcement-panel-list">
                    {filteredAnnouncements.length ? (
                      filteredAnnouncements.map((announcement) => (
                        <Link
                          key={announcement.id}
                          className={`announcement-item announcement-item-${announcement.priority} ${
                            announcement.isRead ? 'announcement-item-read' : 'announcement-item-unread'
                          }`}
                          onClick={() => {
                            void markAnnouncementAsReadAndClose(announcement.id);
                          }}
                          title={formatAnnouncementTime(announcement.updatedAt)}
                          to={announcement.href}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`announcement-pill announcement-pill-${announcement.type}`}>{announcement.type}</span>
                                {announcement.badge ? (
                                  <span className="announcement-pill announcement-pill-neutral">{announcement.badge}</span>
                                ) : null}
                                {!announcement.isRead ? <span className="announcement-pill announcement-pill-unread">New</span> : null}
                              </div>
                              <p className="text-sm font-bold text-slate-900">{announcement.title}</p>
                              <p className="text-sm leading-6 text-slate-600">{announcement.message}</p>
                            </div>
                            <span className={`announcement-priority-dot announcement-priority-dot-${announcement.priority}`} />
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                            <span>{formatAnnouncementTime(announcement.updatedAt)}</span>
                            <div className="flex items-center gap-3">
                              <span>{formatRelativeTime(announcement.updatedAt)}</span>
                              <span className="font-semibold text-primary">
                                {announcement.type === 'alert'
                                  ? 'Open alert'
                                  : announcement.type === 'awareness'
                                    ? 'Read update'
                                    : 'View details'}
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-red-200 bg-rose-50/50 px-4 py-6 text-center text-sm text-slate-500">
                        <p className="text-sm font-bold text-slate-700">
                          No {announcementFilter === 'ALL' ? 'announcements' : announcementFilter.toLowerCase()} right now
                        </p>
                        <p className="mt-2 leading-6 text-slate-500">
                          Fresh alerts, awareness posts, and response updates will appear here as soon as the system publishes
                          them.
                        </p>
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
                  {unreadAnnouncements > 0
                    ? `${unreadAnnouncements} unread update${unreadAnnouncements > 1 ? 's' : ''}`
                    : 'Tap to review latest alerts'}
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
                <div className="flex flex-wrap items-center gap-2">
                  {announcementFilters.map((filter) => (
                    <button
                      key={filter.value}
                      className={`rounded-full border px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition ${
                        announcementFilter === filter.value
                          ? 'border-primary bg-primary text-white'
                          : 'border-red-100 bg-white text-slate-600 hover:border-red-200 hover:text-primary'
                      }`}
                      onClick={() => setAnnouncementFilter(filter.value)}
                      type="button"
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                  <button className="font-bold text-primary transition hover:text-red-800" onClick={markAllAsRead} type="button">
                    Mark all read
                  </button>
                  <button
                    className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition ${
                      announcementsMuted
                        ? 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700'
                        : 'border-red-200 bg-red-50 text-primary hover:border-red-300 hover:bg-red-100'
                    }`}
                    onClick={() => setAnnouncementsMuted((current) => !current)}
                    type="button"
                  >
                    {announcementsMuted ? 'Sound off' : 'Sound on'}
                  </button>
                </div>

                {filteredAnnouncements.length ? (
                  filteredAnnouncements.map((announcement) => (
                    <Link
                      key={announcement.id}
                      className={`announcement-item announcement-item-${announcement.priority} ${
                        announcement.isRead ? 'announcement-item-read' : 'announcement-item-unread'
                      }`}
                      onClick={() => {
                        void markAnnouncementAsReadAndClose(announcement.id);
                        setMobileMenuOpen(false);
                      }}
                      title={formatAnnouncementTime(announcement.updatedAt)}
                      to={announcement.href}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`announcement-pill announcement-pill-${announcement.type}`}>{announcement.type}</span>
                        {announcement.badge ? (
                          <span className="announcement-pill announcement-pill-neutral">{announcement.badge}</span>
                        ) : null}
                        {!announcement.isRead ? <span className="announcement-pill announcement-pill-unread">New</span> : null}
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-900">{announcement.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{announcement.message}</p>
                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
                        <span>{formatAnnouncementTime(announcement.updatedAt)}</span>
                        <span>{formatRelativeTime(announcement.updatedAt)}</span>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-red-200 bg-rose-50/50 px-4 py-6 text-center text-sm text-slate-500">
                    <p className="text-sm font-bold text-slate-700">
                      No {announcementFilter === 'ALL' ? 'announcements' : announcementFilter.toLowerCase()} right now
                    </p>
                    <p className="mt-2 leading-6 text-slate-500">We will surface new alerts and updates here the moment they arrive.</p>
                  </div>
                )}
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
    </div>
  );
}
