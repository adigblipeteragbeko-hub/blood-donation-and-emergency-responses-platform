import { memo, useEffect, useMemo, useState } from 'react';
import { AvatarSize, avatarSizeClasses, getInitials, isSupportedProfileImage } from '../utils/avatar';

type Props = {
  name?: string | null;
  email?: string | null;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
};

function SmartAvatarComponent({ name, email, src, size = 'md', className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const initials = useMemo(() => getInitials(name, email), [email, name]);
  const safeSrc = !failed && isSupportedProfileImage(src) ? src : null;
  const label = name ? `${name} profile avatar` : 'Account profile avatar';
  const base = `${avatarSizeClasses[size]} relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary font-black text-white ring-2 ring-red-100 shadow-sm transition duration-200 ${className}`;

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (safeSrc) {
    return (
      <span className={base} aria-label={label} role="img">
        {!loaded ? <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-red-100 to-red-200" /> : null}
        <img
          alt={label}
          className={`h-full w-full object-cover transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          src={safeSrc}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
        />
      </span>
    );
  }

  return (
    <span className={base} aria-label={name ? `${name} initials avatar` : 'Initials avatar'} role="img">
      {initials}
    </span>
  );
}

export const SmartAvatar = memo(SmartAvatarComponent);
