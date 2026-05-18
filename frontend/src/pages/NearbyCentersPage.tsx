import { lazy, Suspense } from 'react';

const SmartBloodBankMap = lazy(() =>
  import('../components/SmartBloodBankMap').then((module) => ({
    default: module.SmartBloodBankMap,
  })),
);

function MapLoading() {
  return (
    <div className="rounded-3xl border border-red-100 bg-white p-8 shadow-sm">
      <div className="h-[420px] animate-pulse rounded-2xl bg-slate-100" />
      <p className="mt-4 text-sm font-semibold text-slate-600">Loading smart blood bank map...</p>
    </div>
  );
}

export default function NearbyCentersPage() {
  return (
    <Suspense fallback={<MapLoading />}>
      <SmartBloodBankMap />
    </Suspense>
  );
}
