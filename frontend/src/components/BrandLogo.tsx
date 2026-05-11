import { Link } from 'react-router-dom';

type BrandLogoProps = {
  compact?: boolean;
  light?: boolean;
  className?: string;
};

export function BrandLogo({ compact = false, light = false, className = '' }: BrandLogoProps) {
  const textColor = light ? 'text-white' : 'text-slate-950';
  const subTextColor = light ? 'text-red-100' : 'text-slate-500';

  return (
    <Link
      to="/"
      className={`group inline-flex items-center gap-3 rounded-full border border-red-100 bg-white px-3 py-2 shadow-sm transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md ${className}`}
      aria-label="Donation Desk home"
    >
      <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-[0_14px_28px_rgba(200,16,46,0.22)] transition group-hover:scale-105">
        <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 64 64" fill="none">
          <path
            d="M32 6C24 16.4 16 25.9 16 38.1C16 48 23.2 56 32 56C40.8 56 48 48 48 38.1C48 25.9 40 16.4 32 6Z"
            fill="white"
          />
          <path d="M32 20V44M20 32H44" stroke="#C8102E" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full border-2 border-white bg-emerald-500" />
      </span>
      {!compact ? (
        <span className="leading-tight">
          <span className={`block text-lg font-black ${textColor}`}>Donation Desk</span>
          <span className={`block text-[11px] font-bold uppercase tracking-[0.18em] ${subTextColor}`}>
            Blood Response
          </span>
        </span>
      ) : null}
    </Link>
  );
}
