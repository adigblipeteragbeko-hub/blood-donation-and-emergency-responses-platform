export function formatDate(value?: string | null, fallback = 'Not recorded') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value?: string | null, fallback = 'Date not recorded') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? fallback
    : date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
}

export function formatDistance(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Distance not available';
  return value < 10 ? `${value.toFixed(1)} km away` : `${Math.round(value)} km away`;
}

export function estimateTravelTime(distanceKm?: number | null) {
  if (typeof distanceKm !== 'number' || Number.isNaN(distanceKm)) return null;
  const minutes = Math.max(5, Math.round((distanceKm / 35) * 60));
  return minutes >= 60 ? `${Math.round(minutes / 60)} hr ${minutes % 60} min` : `${minutes} min`;
}
