import { lazy, Suspense } from 'react';

const LiveOperationsMap = lazy(() =>
  import('../components/LiveOperationsMap').then((module) => ({
    default: module.LiveOperationsMap,
  })),
);

function MapLoading() {
  return (
    <div className="rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
      <div className="h-[520px] animate-pulse rounded-2xl bg-slate-100" />
      <p className="mt-4 text-sm font-semibold text-slate-600">Loading live operations map...</p>
    </div>
  );
}

export default function LiveMapPage() {
  return (
    <Suspense fallback={<MapLoading />}>
      <LiveOperationsMap />
    </Suspense>
  );
}
