import { useEffect, useMemo, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

const isStandaloneDisplay = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIosDevice = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export function PwaInstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('bloodsos:pwa-install-dismissed') === '1');
  const [standalone, setStandalone] = useState(() => isStandaloneDisplay());
  const [online, setOnline] = useState(() => window.navigator.onLine);
  const isIos = useMemo(() => isIosDevice(), []);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered() {
      // Registration is intentionally quiet; the visible UI appears only for install/update actions.
    },
    onRegisterError(error) {
      if (import.meta.env.DEV) {
        console.warn('BloodSOS service worker registration failed:', error);
      }
    },
  });

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
      setStandalone(true);
      localStorage.setItem('bloodsos:pwa-install-dismissed', '1');
      setDismissed(true);
    };
    const onDisplayModeChange = () => setStandalone(isStandaloneDisplay());
    const displayModeQuery = window.matchMedia('(display-mode: standalone)');

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    displayModeQuery.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      displayModeQuery.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  useEffect(() => {
    const setOnlineState = () => setOnline(window.navigator.onLine);
    window.addEventListener('online', setOnlineState);
    window.addEventListener('offline', setOnlineState);
    return () => {
      window.removeEventListener('online', setOnlineState);
      window.removeEventListener('offline', setOnlineState);
    };
  }, []);

  const dismissInstall = () => {
    localStorage.setItem('bloodsos:pwa-install-dismissed', '1');
    setDismissed(true);
  };

  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      dismissInstall();
    }
    setInstallPrompt(null);
  };

  if (!online) {
    return (
      <div className="pwa-action-surface" role="status">
        <span>
          You are currently offline. Live blood availability, emergency requests, appointments, notifications and
          real-time services require an internet connection.
        </span>
      </div>
    );
  }

  if (needRefresh) {
    return (
      <div className="pwa-action-surface" role="status">
        <span>A new version of BloodSOS is available.</span>
        <button type="button" onClick={() => void updateServiceWorker(true)}>
          Update
        </button>
        <button aria-label="Dismiss update notice" type="button" onClick={() => setNeedRefresh(false)}>
          Later
        </button>
      </div>
    );
  }

  if (standalone || dismissed) return null;

  if (installPrompt) {
    return (
      <div className="pwa-action-surface" role="status">
        <span>Install BloodSOS on this device.</span>
        <button type="button" onClick={() => void install()}>
          Install
        </button>
        <button aria-label="Dismiss install notice" type="button" onClick={dismissInstall}>
          Later
        </button>
      </div>
    );
  }

  if (isIos) {
    return (
      <div className="pwa-action-surface pwa-action-surface-ios" role="status">
        <span>On iPhone, use Share, then Add to Home Screen.</span>
        <button aria-label="Dismiss install guidance" type="button" onClick={dismissInstall}>
          OK
        </button>
      </div>
    );
  }

  return null;
}
