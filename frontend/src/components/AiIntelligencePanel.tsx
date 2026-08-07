import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { formatHospitalDisplayName } from '../utils/hospital-display';
import {
  AiDonorRecommendation,
  AiStockRisk,
  BloodGroup,
  createAiMobilizationPreview,
  getAiDonorRecommendations,
  getAiOverview,
  getAiStockRisks,
  handoffAiRecommendation,
} from '../services/ai-intelligence';

const bloodGroups: BloodGroup[] = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'];

const riskClass: Record<string, string> = {
  LOW: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  MODERATE: 'bg-amber-50 text-amber-700 border-amber-200',
  HIGH: 'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
};

const confidenceClass: Record<string, string> = {
  LOW: 'bg-slate-100 text-slate-700 border-slate-200',
  MEDIUM: 'bg-blue-50 text-blue-700 border-blue-200',
  HIGH: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const summaryAccentClass: Record<string, string> = {
  criticalBloodGroups: 'border-l-red-500 bg-red-50/40',
  highRiskBloodGroups: 'border-l-orange-500 bg-orange-50/40',
  hospitalsRequiringAttention: 'border-l-amber-500 bg-amber-50/40',
  hospitalStatus: 'border-l-amber-500 bg-amber-50/40',
  recommendedDonorsAvailable: 'border-l-emerald-500 bg-emerald-50/40',
  expiringUnits: 'border-l-amber-500 bg-amber-50/40',
  openEmergencyRequests: 'border-l-blue-500 bg-blue-50/40',
};

function formatBloodGroup(value?: string) {
  return value?.replace('_POS', '+').replace('_NEG', '-') ?? 'All';
}

function formatSummaryLabel(key: string) {
  if (key === 'hospitalStatus') return 'Hospital Status';
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function getHospitalStatus(risks: AiStockRisk[]) {
  if (risks.some((risk) => risk.riskLevel === 'CRITICAL')) return 'Critical';
  if (risks.some((risk) => risk.riskLevel === 'HIGH')) return 'High Risk';
  if (risks.some((risk) => risk.riskLevel === 'MODERATE')) return 'Moderate Risk';
  if (risks.some((risk) => risk.riskLevel === 'LOW')) return 'Low Risk';
  return 'Stable';
}

function badge(value: string | null | undefined, classes: Record<string, string>) {
  const label = value || 'LOW';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${classes[label] ?? classes.LOW}`}>{label.replace('_', ' ')}</span>;
}

function LoadingBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-100 ${className}`} />;
}

export function AiIntelligencePanel({ mode }: { mode: 'admin' | 'hospital' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [hospitalId, setHospitalId] = useState('');
  const [riskLevel, setRiskLevel] = useState('');
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getAiOverview>> | null>(null);
  const [risks, setRisks] = useState<AiStockRisk[]>([]);
  const [selectedRisk, setSelectedRisk] = useState<AiStockRisk | null>(null);
  const [donors, setDonors] = useState<AiDonorRecommendation[]>([]);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof createAiMobilizationPreview>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [donorLoading, setDonorLoading] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isAdmin = mode === 'admin' && user?.role === 'ADMIN';
  const isHospital = mode === 'hospital' && user?.role === 'HOSPITAL_ADMIN';
  const canUse = isAdmin || isHospital;

  const params = useMemo(() => ({
    hospitalId: isAdmin && hospitalId.trim() ? hospitalId.trim() : undefined,
    bloodGroup: bloodGroup || undefined,
    riskLevel: riskLevel || undefined,
  }), [bloodGroup, hospitalId, isAdmin, riskLevel]);

  const summaryCards = useMemo(() => {
    const entries = Object.entries(overview?.summary ?? {});
    if (!isHospital) return entries.map(([key, value]) => ({ key, value }));
    return entries.map(([key, value]) => {
      if (key !== 'hospitalsRequiringAttention') return { key, value };
      return { key: 'hospitalStatus', value: getHospitalStatus(risks) };
    });
  }, [isHospital, overview?.summary, risks]);

  const load = async () => {
    if (!canUse) return;
    setLoading(true);
    setError('');
    const [overviewResult, risksResult] = await Promise.allSettled([
      getAiOverview(params),
      getAiStockRisks(params),
    ]);

    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value);
    } else {
      setOverview({ advisoryNotice: '', summary: {}, insights: [], risks: [] });
    }

    if (risksResult.status === 'fulfilled') {
      const nextRisks = Array.isArray(risksResult.value.items) ? risksResult.value.items : [];
      setRisks(nextRisks);
      setSelectedRisk(nextRisks[0] ?? null);
    } else {
      setRisks([]);
      setSelectedRisk(null);
    }

    if (overviewResult.status === 'rejected' || risksResult.status === 'rejected') {
      const failure = overviewResult.status === 'rejected' ? overviewResult.reason : risksResult.status === 'rejected' ? risksResult.reason : null;
      setError((failure as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Some AI intelligence data could not be loaded. Use Refresh Intelligence to retry.');
    }

    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [canUse, params]);

  const submitFilters = (event: FormEvent) => {
    event.preventDefault();
    void load();
  };

  const generateDonors = async (risk = selectedRisk) => {
    if (!risk) return;
    setDonorLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await getAiDonorRecommendations({
        hospitalId: risk.hospitalId,
        bloodGroup: risk.bloodGroup,
        radiusKm: 20,
        limit: 25,
        smsEnabledOnly: 'false',
      });
      setDonors(result.items);
      setSelectedRisk(risk);
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to generate donor recommendations.');
    } finally {
      setDonorLoading(false);
    }
  };

  const previewMobilization = async () => {
    if (!selectedRisk) return;
    setDonorLoading(true);
    setError('');
    setSuccess('');
    try {
      const result = await createAiMobilizationPreview({
        hospitalId: selectedRisk.hospitalId,
        bloodGroup: selectedRisk.bloodGroup,
        radiusKm: 20,
        recipientLimit: 15,
      });
      setPreview(result);
      setSuccess('Mobilization preview prepared. No SMS or notifications were sent.');
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to prepare mobilization preview.');
    } finally {
      setDonorLoading(false);
    }
  };

  const handoff = async () => {
    if (!selectedRisk) return;
    setHandoffLoading(true);
    setError('');
    try {
      const result = await handoffAiRecommendation({
        hospitalId: selectedRisk.hospitalId,
        bloodGroup: selectedRisk.bloodGroup,
        donorIds: preview?.donorIds ?? donors.slice(0, 15).map((donor) => donor.donorId),
        suggestedMessage: preview?.suggestedMessage ?? selectedRisk.recommendedAction,
        destination: isAdmin ? 'DONOR_COMMUNICATIONS' : 'HOSPITAL_MOBILIZATION',
      });
      setSuccess(`Recommendation handed off for review. No messages were sent by AI.`);
      navigate(result.targetRoute);
    } catch (err) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to hand off AI recommendation.');
    } finally {
      setHandoffLoading(false);
    }
  };

  if (!canUse) {
    return (
      <div className="card border-red-100 bg-red-50 text-red-800">
        <h1 className="text-xl font-bold">AI Intelligence unavailable</h1>
        <p className="mt-2 text-sm">This module is restricted to Admin and Hospital Admin users.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-slate-900">AI Intelligence Dashboard</h1>
        <p className="text-sm text-slate-500">
          {isAdmin
            ? 'System-wide operational recommendations for blood stock risk and donor mobilization review.'
            : 'Hospital-scoped operational recommendations for blood stock risk and donor mobilization review.'}
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">
        AI recommendations are advisory only. Final operational and clinical decisions remain with authorised Admin and Hospital Admin users.
      </div>

      <form onSubmit={submitFilters} className="card grid gap-3 md:grid-cols-5">
        {isAdmin ? (
          <label className="text-sm font-semibold text-slate-700">
            Hospital ID
            <input className="mt-1 w-full rounded border p-2" value={hospitalId} onChange={(event) => setHospitalId(event.target.value)} placeholder="All Hospitals" />
          </label>
        ) : null}
        <label className="text-sm font-semibold text-slate-700">
          Blood Group
          <select className="mt-1 w-full rounded border p-2" value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value as BloodGroup | '')}>
            <option value="">All groups</option>
            {bloodGroups.map((group) => <option key={group} value={group}>{formatBloodGroup(group)}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Risk level
          <select className="mt-1 w-full rounded border p-2" value={riskLevel} onChange={(event) => setRiskLevel(event.target.value)}>
            <option value="">All levels</option>
            {['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <div className="flex items-end">
          <button className="btn-secondary w-full" type="submit" disabled={loading} aria-label="Refresh AI intelligence calculations">
            {loading ? 'Refreshing...' : 'Refresh Intelligence'}
          </button>
        </div>
      </form>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{success}</div> : null}

      {loading && !overview ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Loading AI summary cards">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card border-l-4">
              <LoadingBlock className="h-3 w-24" />
              <LoadingBlock className="mt-3 h-8 w-14" />
            </div>
          ))}
        </div>
      ) : summaryCards.length ? (
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map(({ key, value }) => (
            <div key={key} className={`card border-l-4 ${summaryAccentClass[key] ?? 'border-l-slate-300'}`}>
              <p className="text-xs font-bold uppercase text-slate-500">{formatSummaryLabel(key)}</p>
              <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
        <section className="card overflow-hidden">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Blood Stock Risk</h2>
              <p className="text-sm text-slate-500">Rule-based estimates from inventory, demand, expiry, appointments, and warning history.</p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-3 py-2" aria-label="Loading stock risk rows">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="grid gap-3 md:grid-cols-5">
                  <LoadingBlock className="h-5" />
                  <LoadingBlock className="h-5" />
                  <LoadingBlock className="h-5" />
                  <LoadingBlock className="h-5" />
                  <LoadingBlock className="h-5" />
                </div>
              ))}
            </div>
          ) : risks.length === 0 ? (
            <p className="py-8 text-sm text-slate-500">No stock risks detected. There is not enough historical data yet for the selected filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-3 py-3">Hospital</th>
                    <th className="px-3 py-3">Blood Group</th>
                    <th className="px-3 py-3">Current</th>
                    <th className="px-3 py-3">Minimum</th>
                    <th className="px-3 py-3">Pending</th>
                    <th className="px-3 py-3">Expiring</th>
                    <th className="px-3 py-3">Days</th>
                    <th className="px-3 py-3">Risk</th>
                    <th className="px-3 py-3">Confidence</th>
                    <th className="px-3 py-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {risks.map((risk) => (
                    <tr key={`${risk.hospitalId}-${risk.bloodGroup}`} className="border-t hover:bg-slate-50">
                      <td className="px-3 py-3 font-semibold">{formatHospitalDisplayName(risk.hospitalName)}</td>
                      <td className="px-3 py-3">{formatBloodGroup(risk.bloodGroup)}</td>
                      <td className="px-3 py-3">{risk.currentUnits}</td>
                      <td className="px-3 py-3">{risk.minimumThreshold}</td>
                      <td className="px-3 py-3">{risk.pendingRequestUnits}</td>
                      <td className="px-3 py-3">{risk.expiringSoonUnits}</td>
                      <td className="px-3 py-3">{risk.estimatedDaysRemaining ?? 'Insufficient data'}</td>
                      <td className="px-3 py-3">{badge(risk.riskLevel, riskClass)}</td>
                      <td className="px-3 py-3">{badge(risk.confidenceLevel, confidenceClass)}</td>
                      <td className="px-3 py-3">
                        <button className="text-sm font-bold text-primary underline" type="button" onClick={() => setSelectedRisk(risk)}>
                          Why?
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="card">
            <h2 className="text-lg font-bold text-slate-900">Risk Explanation</h2>
            {selectedRisk ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="font-semibold">{formatHospitalDisplayName(selectedRisk.hospitalName)} - {formatBloodGroup(selectedRisk.bloodGroup)}</p>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Risk Level</p>
                  <div className="mt-1">{badge(selectedRisk.riskLevel, riskClass)}</div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Confidence</p>
                  <div className="mt-1">{badge(selectedRisk.confidenceLevel, confidenceClass)}</div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Reasons</p>
                  {(selectedRisk.reasons ?? []).length ? (
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
                      {(selectedRisk.reasons ?? []).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-500">No additional explanation available.</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-500">Recommended Action</p>
                  <p className="mt-1 text-slate-600">{selectedRisk.recommendedAction || 'Continue monitoring.'}</p>
                </div>
                {(selectedRisk.limitations ?? []).map((item) => <p key={item} className="text-xs text-slate-500">{item}</p>)}
                <div className="grid gap-2 sm:grid-cols-2">
                  <button className="btn-secondary" type="button" onClick={() => generateDonors()} disabled={donorLoading}>Generate Donors</button>
                  <button className="btn-primary" type="button" onClick={previewMobilization} disabled={donorLoading}>Preview Mobilization</button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">Select a risk row to view its explanation.</p>
            )}
          </section>

          {preview ? (
            <section className="card">
              <h2 className="text-lg font-bold text-slate-900">Mobilization Preview</h2>
              <p className="mt-2 text-sm text-slate-600">{preview.reason}</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{preview.suggestedMessage}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded border p-2"><strong>{preview.matchingDonorsFound}</strong><br />Matched</div>
                <div className="rounded border p-2"><strong>{preview.recommendedRecipientCount}</strong><br />Target</div>
                <div className="rounded border p-2"><strong>{preview.estimatedSmsCredits}</strong><br />Credits</div>
              </div>
              <button className="btn-primary mt-3 w-full" type="button" onClick={handoff} disabled={handoffLoading}>
                {isAdmin ? 'Open Donor Communications' : 'Open Donor Mobilization'}
              </button>
            </section>
          ) : null}
        </aside>
      </div>

      <section className="card">
        <h2 className="text-xl font-bold text-slate-900">Recommended Donors</h2>
        {donors.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No donor recommendations available. Generate recommendations from a risk row to review compatible donors.</p>
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {donors.map((donor) => (
              <article key={donor.donorId} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">{donor.donorName}</h3>
                    <dl className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                      <div>
                        <dt className="font-bold text-slate-500">Blood Group</dt>
                        <dd>{formatBloodGroup(donor.bloodGroup)}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-500">Priority</dt>
                        <dd>{donor.priority}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-500">Distance</dt>
                        <dd>{donor.distanceKm === null ? 'Distance unavailable' : `${donor.distanceKm} km`}</dd>
                      </div>
                      <div>
                        <dt className="font-bold text-slate-500">Eligibility</dt>
                        <dd>{donor.eligibleNow ? 'Eligible' : 'Review needed'}</dd>
                      </div>
                    </dl>
                  </div>
                  <span className="rounded-full bg-slate-900 px-2 py-1 text-xs font-bold text-white">{donor.score}</span>
                </div>
                <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <summary className="font-bold text-slate-800">Why did AI recommend this?</summary>
                  {(donor.reasons ?? []).length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-600">
                      {(donor.reasons ?? []).map((reason) => <li key={reason}>{reason}</li>)}
                    </ul>
                  ) : (
                    <p className="mt-2 text-slate-500">No additional explanation available.</p>
                  )}
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      {(overview?.insights ?? []).length ? (
        <section className="card">
          <h2 className="text-xl font-bold text-slate-900">AI Insights</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(overview?.insights ?? []).map((insight) => <p key={insight} className="rounded-lg border border-slate-200 p-3 text-sm text-slate-700">{insight}</p>)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
