import { AccountIdentity } from './account-identity';

const STORAGE_KEY = 'rememberedAccounts';

export type RememberedAccount = Pick<
  AccountIdentity,
  'id' | 'email' | 'role' | 'roleLabel' | 'displayName' | 'initials' | 'avatarUrl' | 'accountStatus' | 'donorReference' | 'hospitalName'
> & {
  lastUsedAt: string;
};

function readAccounts(): RememberedAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RememberedAccount[]) : [];
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

function writeAccounts(accounts: RememberedAccount[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts.slice(0, 6)));
}

export function getRememberedAccounts() {
  return readAccounts().sort((a, b) => new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime());
}

export function rememberAccount(identity: AccountIdentity) {
  const next: RememberedAccount = {
    id: identity.id,
    email: identity.email,
    role: identity.role,
    roleLabel: identity.roleLabel,
    displayName: identity.displayName,
    initials: identity.initials,
    avatarUrl: identity.avatarUrl,
    accountStatus: identity.accountStatus,
    donorReference: identity.donorReference,
    hospitalName: identity.hospitalName,
    lastUsedAt: new Date().toISOString(),
  };
  writeAccounts([next, ...readAccounts().filter((item) => item.id !== identity.id)]);
}

export function removeRememberedAccount(id: string) {
  writeAccounts(readAccounts().filter((item) => item.id !== id));
}

export function clearRememberedAccounts() {
  localStorage.removeItem(STORAGE_KEY);
}

export function clearActiveSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}
