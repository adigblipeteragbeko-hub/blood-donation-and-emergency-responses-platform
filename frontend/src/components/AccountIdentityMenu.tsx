import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AccountIdentity, loginPathForRole } from '../utils/account-identity';
import { SmartAvatar } from './SmartAvatar';
import { useTheme } from '../hooks/useTheme';
import api from '../services/api';
import {
  clearActiveSession,
  clearRememberedAccounts,
  getRememberedAccounts,
  RememberedAccount,
  removeRememberedAccount,
} from '../utils/remembered-accounts';

type Props = {
  identity: AccountIdentity | null;
  onLogout: () => void;
  compact?: boolean;
};

const roleQuickLinks: Record<string, Array<{ label: string; to: string }>> = {
  DONOR: [
    { label: 'Profile', to: '/donor/profile' },
    { label: 'Donor Card', to: '/donor/card' },
    { label: 'Eligibility', to: '/donor/eligibility' },
    { label: 'Appointments', to: '/donor/appointments' },
    { label: 'Notifications', to: '/donor/notifications' },
    { label: 'Settings', to: '/donor/settings' },
  ],
  HOSPITAL_ADMIN: [
    { label: 'Profile', to: '/hospital/profile' },
    { label: 'Inventory', to: '/hospital/inventory' },
    { label: 'Active Requests', to: '/hospital/active-requests' },
    { label: 'Request History', to: '/hospital/request-history' },
    { label: 'Clinical Reviews', to: '/hospital/donor-reviews' },
    { label: 'Appointments', to: '/hospital/appointments' },
    { label: 'Reports', to: '/hospital/reports' },
    { label: 'AI Intelligence', to: '/hospital/ai-intelligence' },
    { label: 'Notifications', to: '/hospital/notifications' },
    { label: 'Settings', to: '/hospital/settings' },
  ],
  ADMIN: [
    { label: 'Dashboard', to: '/admin/dashboard' },
    { label: 'Users', to: '/admin/management?section=settings' },
    { label: 'Hospitals', to: '/admin/management?section=hospitals' },
    { label: 'AI Intelligence', to: '/admin/management?section=ai-intelligence' },
    { label: 'Audit', to: '/admin/management?section=audit' },
  ],
};

export function AccountIdentityMenu({ identity, onLogout, compact = false }: Props) {
  const [open, setOpen] = useState(false);
  const [remembered, setRemembered] = useState<RememberedAccount[]>(() => getRememberedAccounts());
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(identity?.avatarUrl ?? null);
  const [imageMessage, setImageMessage] = useState('');
  const [imageSaving, setImageSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();

  const quickLinks = useMemo(() => (identity ? roleQuickLinks[identity.role] ?? [] : []), [identity]);

  useEffect(() => {
    setLocalAvatarUrl(identity?.avatarUrl ?? null);
  }, [identity?.avatarUrl]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  if (!identity) {
    return null;
  }

  const switchTo = (account: RememberedAccount) => {
    clearActiveSession();
    window.location.assign(`${loginPathForRole(account.role)}?email=${encodeURIComponent(account.email)}`);
  };

  const addAnother = () => {
    clearActiveSession();
    window.location.assign('/login');
  };

  const signOut = () => {
    onLogout();
    navigate('/login');
  };

  const signOutAll = () => {
    clearRememberedAccounts();
    onLogout();
    navigate('/login');
  };

  const removeAccount = (id: string) => {
    removeRememberedAccount(id);
    setRemembered(getRememberedAccounts());
  };

  const saveProfileImage = async (profileImageUrl: string) => {
    setImageSaving(true);
    setImageMessage('');
    try {
      const endpoint = identity.role === 'DONOR' ? '/donors/profile/image' : '/auth/profile-image';
      await api.patch(endpoint, { profileImageUrl });
      setLocalAvatarUrl(profileImageUrl || null);
      window.dispatchEvent(new CustomEvent('account-profile-image-updated', { detail: { profileImageUrl } }));
      if (identity.role === 'DONOR') {
        window.dispatchEvent(new CustomEvent('donor-profile-image-updated', { detail: { profileImageUrl } }));
      }
      setImageMessage(profileImageUrl ? 'Profile photo updated.' : 'Profile photo removed.');
    } catch (error: any) {
      setImageMessage(error?.response?.data?.message ?? 'Unable to update profile photo. Please try again.');
    } finally {
      setImageSaving(false);
    }
  };

  const uploadProfileImage = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setImageMessage('Use a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 1_200_000) {
      setImageMessage('Use an image smaller than 1.2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      void saveProfileImage(value);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-red-100 bg-white px-3 py-2 text-left shadow-sm transition hover:border-red-200 hover:bg-red-50"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <SmartAvatar name={identity.displayName} email={identity.email} src={localAvatarUrl} size={compact ? 'sm' : 'md'} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-slate-900">{identity.displayName}</span>
          <span className="block truncate text-xs font-semibold text-muted">{identity.roleLabel}</span>
        </span>
        <span className="text-xs font-black text-primary">v</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute left-0 z-[1000] mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-slate-200 bg-white p-4 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)]"
        >
          <div className="flex items-center gap-4 border-b border-slate-100 pb-4">
            <SmartAvatar name={identity.displayName} email={identity.email} src={localAvatarUrl} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-lg font-black text-slate-950">{identity.displayName}</p>
              <p className="truncate text-sm text-muted">{identity.email}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-primary">{identity.roleLabel}</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{identity.accountStatus}</span>
              </div>
              {identity.donorReference || identity.bloodGroup ? (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {[identity.donorReference, identity.bloodGroup].filter(Boolean).join(' / ')}
                </p>
              ) : null}
              {identity.hospitalName ? (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {[identity.city, identity.region].filter(Boolean).join(', ') || 'Facility profile'}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 border-b border-slate-100 py-3">
            {quickLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="cursor-pointer rounded-xl bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-red-50 hover:text-primary"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="border-b border-slate-100 py-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Profile Photo</p>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => uploadProfileImage(event.target.files?.[0])}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="cursor-pointer rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={imageSaving}
                onClick={() => fileInputRef.current?.click()}
              >
                {imageSaving ? 'Saving...' : localAvatarUrl ? 'Change photo' : 'Add photo'}
              </button>
              <button
                type="button"
                className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={imageSaving || !localAvatarUrl}
                onClick={() => void saveProfileImage('')}
              >
                Remove
              </button>
            </div>
            <p className="mt-2 text-xs text-muted">JPG, PNG, or WebP. Your account photo is separate from hospital logos and official donor documents.</p>
            {imageMessage ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs font-semibold text-slate-700">{imageMessage}</p> : null}
          </div>

          <div className="border-b border-slate-100 py-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Appearance</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Appearance">
              {[
                { value: 'light', label: 'Light', icon: 'Sun' },
                { value: 'dark', label: 'Dark', icon: 'Moon' },
                { value: 'system', label: 'System', icon: 'Device' },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  role="radio"
                  aria-checked={preference === item.value}
                  className={`${preference === item.value ? 'border-primary bg-red-50 text-primary' : 'border-slate-200 bg-white text-slate-700'} cursor-pointer rounded-xl border px-2 py-2 text-xs font-black transition hover:border-red-200 hover:bg-red-50`}
                  onClick={() => setPreference(item.value as 'light' | 'dark' | 'system')}
                >
                  <span className="block">{item.icon}</span>
                  <span>{item.label}</span>
                  {preference === item.value ? <span className="sr-only">selected</span> : null}
                </button>
              ))}
            </div>
          </div>

          <div className="border-b border-slate-100 py-3">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Remembered Accounts</p>
            {remembered.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-xs text-muted">No remembered accounts yet.</p>
            ) : (
              <div className="space-y-2">
                {remembered.map((account) => (
                  <div key={account.id} className="flex items-center gap-2 rounded-xl border border-slate-100 p-2">
                    <SmartAvatar name={account.displayName} email={account.email} src={account.avatarUrl} size="sm" />
                    <button
                      type="button"
                      className="min-w-0 flex-1 cursor-pointer text-left"
                      onClick={() => switchTo(account)}
                    >
                      <span className="block truncate text-sm font-bold text-slate-900">{account.displayName}</span>
                      <span className="block truncate text-xs text-muted">{account.email}</span>
                    </button>
                    <button
                      type="button"
                      className="cursor-pointer rounded-lg px-2 py-1 text-xs font-bold text-slate-500 hover:bg-slate-100"
                      onClick={() => removeAccount(account.id)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-3">
            <button type="button" className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700" onClick={addAnother}>
              Add another account
            </button>
            <button type="button" className="cursor-pointer rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-primary" onClick={signOut}>
              Sign out
            </button>
            <button type="button" className="cursor-pointer rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white" onClick={signOutAll}>
              Sign out all
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
