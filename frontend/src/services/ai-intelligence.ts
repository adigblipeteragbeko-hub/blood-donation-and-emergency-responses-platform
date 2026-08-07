import api from './api';

export type AiRiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
export type AiConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type BloodGroup = 'O_POS' | 'O_NEG' | 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'UNKNOWN';

export type AiStockRisk = {
  hospitalId: string;
  hospitalName: string;
  bloodGroup: BloodGroup;
  currentUnits: number;
  minimumThreshold: number;
  criticalThreshold: number;
  recentDemandUnits: number;
  pendingRequestUnits: number;
  expiringSoonUnits: number;
  estimatedNetAvailableUnits: number;
  estimatedDaysRemaining: number | null;
  riskLevel: AiRiskLevel;
  confidenceLevel: AiConfidenceLevel;
  score: number;
  reasons: string[];
  recommendedAction: string;
  limitations: string[];
};

export type AiDonorRecommendation = {
  donorId: string;
  donorName: string;
  bloodGroup: BloodGroup;
  score: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  distanceKm: number | null;
  eligibleNow: boolean;
  smsEnabled: boolean;
  reasons: string[];
};

type ApiEnvelope<T> = { success?: boolean; data?: T; timestamp?: string };

export type AiOverviewResponse = {
  advisoryNotice: string;
  summary: Record<string, number>;
  insights: string[];
  risks: AiStockRisk[];
};

export type AiStockRisksResponse = { advisoryNotice: string; total: number; items: AiStockRisk[] };

export type AiDonorRecommendationsResponse = {
  advisoryNotice: string;
  hospital: { id: string; hospitalName: string };
  bloodGroup: BloodGroup;
  compatibleGroups: BloodGroup[];
  radiusKm: number;
  smsEnabledOnly: boolean;
  confidenceLevel: AiConfidenceLevel;
  items: AiDonorRecommendation[];
};

function cleanParams<T extends Record<string, string | number | undefined>>(params: T) {
  return Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== ''));
}

function unwrap<T>(payload: T | ApiEnvelope<T>): T {
  if (payload && typeof payload === 'object' && 'data' in payload && 'success' in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }
  return payload as T;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function asNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function normalizeRisk(value: unknown): AiStockRisk | null {
  if (!isRecord(value)) return null;
  const bloodGroup = typeof value.bloodGroup === 'string' ? value.bloodGroup as BloodGroup : 'UNKNOWN';
  return {
    hospitalId: typeof value.hospitalId === 'string' ? value.hospitalId : '',
    hospitalName: typeof value.hospitalName === 'string' ? value.hospitalName : 'Unknown hospital',
    bloodGroup,
    currentUnits: asNumber(value.currentUnits),
    minimumThreshold: asNumber(value.minimumThreshold),
    criticalThreshold: asNumber(value.criticalThreshold),
    recentDemandUnits: asNumber(value.recentDemandUnits),
    pendingRequestUnits: asNumber(value.pendingRequestUnits),
    expiringSoonUnits: asNumber(value.expiringSoonUnits),
    estimatedNetAvailableUnits: asNumber(value.estimatedNetAvailableUnits),
    estimatedDaysRemaining: typeof value.estimatedDaysRemaining === 'number' ? value.estimatedDaysRemaining : null,
    riskLevel: ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'].includes(String(value.riskLevel)) ? value.riskLevel as AiStockRisk['riskLevel'] : 'LOW',
    confidenceLevel: ['LOW', 'MEDIUM', 'HIGH'].includes(String(value.confidenceLevel)) ? value.confidenceLevel as AiStockRisk['confidenceLevel'] : 'LOW',
    score: asNumber(value.score),
    reasons: asStringArray(value.reasons),
    recommendedAction: typeof value.recommendedAction === 'string' ? value.recommendedAction : 'Continue operational review.',
    limitations: asStringArray(value.limitations),
  };
}

function normalizeDonor(value: unknown): AiDonorRecommendation | null {
  if (!isRecord(value)) return null;
  return {
    donorId: typeof value.donorId === 'string' ? value.donorId : '',
    donorName: typeof value.donorName === 'string' ? value.donorName : 'Recommended donor',
    bloodGroup: typeof value.bloodGroup === 'string' ? value.bloodGroup as BloodGroup : 'UNKNOWN',
    score: asNumber(value.score),
    priority: ['LOW', 'MEDIUM', 'HIGH'].includes(String(value.priority)) ? value.priority as AiDonorRecommendation['priority'] : 'LOW',
    distanceKm: typeof value.distanceKm === 'number' ? value.distanceKm : null,
    eligibleNow: value.eligibleNow === true,
    smsEnabled: value.smsEnabled === true,
    reasons: asStringArray(value.reasons),
  };
}

function normalizeOverview(payload: unknown): AiOverviewResponse {
  const data = unwrap(payload);
  if (!isRecord(data)) {
    return { advisoryNotice: '', summary: {}, insights: [], risks: [] };
  }
  const summary = isRecord(data.summary)
    ? Object.fromEntries(Object.entries(data.summary).map(([key, value]) => [key, asNumber(value)]))
    : {};
  return {
    advisoryNotice: typeof data.advisoryNotice === 'string' ? data.advisoryNotice : '',
    summary,
    insights: asStringArray(data.insights),
    risks: Array.isArray(data.risks) ? data.risks.map(normalizeRisk).filter((item): item is AiStockRisk => Boolean(item)) : [],
  };
}

function normalizeStockRisks(payload: unknown): AiStockRisksResponse {
  const data = unwrap(payload);
  if (!isRecord(data)) {
    return { advisoryNotice: '', total: 0, items: [] };
  }
  const items = Array.isArray(data.items) ? data.items.map(normalizeRisk).filter((item): item is AiStockRisk => Boolean(item)) : [];
  return {
    advisoryNotice: typeof data.advisoryNotice === 'string' ? data.advisoryNotice : '',
    total: asNumber(data.total, items.length),
    items,
  };
}

function normalizeDonorRecommendations(payload: unknown): AiDonorRecommendationsResponse {
  const data = unwrap(payload);
  const hospital = isRecord(data) && isRecord(data.hospital) ? data.hospital : {};
  const items = isRecord(data) && Array.isArray(data.items)
    ? data.items.map(normalizeDonor).filter((item): item is AiDonorRecommendation => Boolean(item))
    : [];
  return {
    advisoryNotice: isRecord(data) && typeof data.advisoryNotice === 'string' ? data.advisoryNotice : '',
    hospital: {
      id: typeof hospital.id === 'string' ? hospital.id : '',
      hospitalName: typeof hospital.hospitalName === 'string' ? hospital.hospitalName : 'Unknown hospital',
    },
    bloodGroup: isRecord(data) && typeof data.bloodGroup === 'string' ? data.bloodGroup as BloodGroup : 'UNKNOWN',
    compatibleGroups: isRecord(data) && Array.isArray(data.compatibleGroups) ? data.compatibleGroups.filter((item): item is BloodGroup => typeof item === 'string') : [],
    radiusKm: isRecord(data) ? asNumber(data.radiusKm, 20) : 20,
    smsEnabledOnly: isRecord(data) && data.smsEnabledOnly === true,
    confidenceLevel: isRecord(data) && ['LOW', 'MEDIUM', 'HIGH'].includes(String(data.confidenceLevel)) ? data.confidenceLevel as AiConfidenceLevel : 'LOW',
    items,
  };
}

export async function getAiOverview(params: Record<string, string | undefined>) {
  const response = await api.get('/ai-intelligence/overview', { params: cleanParams(params) });
  return normalizeOverview(response.data);
}

export async function getAiStockRisks(params: Record<string, string | undefined>) {
  const response = await api.get('/ai-intelligence/stock-risks', { params: cleanParams(params) });
  return normalizeStockRisks(response.data);
}

export async function getAiDonorRecommendations(params: Record<string, string | number | undefined>) {
  const response = await api.get('/ai-intelligence/donor-recommendations', { params: cleanParams(params) });
  return normalizeDonorRecommendations(response.data);
}

export async function createAiMobilizationPreview(payload: {
  hospitalId?: string;
  bloodGroup: BloodGroup;
  radiusKm?: number;
  recipientLimit?: number;
}) {
  const response = await api.post('/ai-intelligence/mobilization-preview', payload);
  const data = unwrap(response.data);
  return (isRecord(data) ? data : {}) as {
    advisoryNotice: string;
    recommendedRecipientCount: number;
    matchingDonorsFound: number;
    suggestedRadiusKm: number;
    estimatedSmsCredits: number;
    suggestedMessage: string;
    reason: string;
    donorIds: string[];
    sentMessages: boolean;
  };
}

export async function handoffAiRecommendation(payload: {
  hospitalId?: string;
  bloodGroup: BloodGroup;
  donorIds?: string[];
  suggestedMessage?: string;
  destination: 'DONOR_COMMUNICATIONS' | 'HOSPITAL_MOBILIZATION';
}) {
  const response = await api.post('/ai-intelligence/handoff', payload);
  const data = unwrap(response.data);
  return (isRecord(data) ? data : {}) as { handoffId: string; destination: string; targetRoute: string; sentMessages: boolean };
}
