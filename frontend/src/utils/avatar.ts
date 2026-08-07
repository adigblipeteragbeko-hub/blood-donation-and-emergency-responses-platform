export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export const avatarSizeClasses: Record<AvatarSize, string> = {
  xs: 'h-8 w-8 text-[11px]',
  sm: 'h-10 w-10 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-28 w-28 text-3xl',
};

export function getInitials(displayName?: string | null, email?: string | null) {
  const source = displayName?.trim() || email?.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Account';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'A';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function isSupportedProfileImage(value?: string | null) {
  if (!value) return false;
  if (value.startsWith('data:image/jpeg;base64,')) return true;
  if (value.startsWith('data:image/png;base64,')) return true;
  if (value.startsWith('data:image/webp;base64,')) return true;
  return /^https?:\/\//i.test(value);
}
