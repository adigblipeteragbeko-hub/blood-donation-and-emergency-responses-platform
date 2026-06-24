import api from './api';

export type BloodGroup =
  | 'UNKNOWN'
  | 'O_POS'
  | 'O_NEG'
  | 'A_POS'
  | 'A_NEG'
  | 'B_POS'
  | 'B_NEG'
  | 'AB_POS'
  | 'AB_NEG';
export type BloodStockStatus = 'stable' | 'low' | 'critical' | 'unpublished';
export type CenterType = 'hospital' | 'blood_bank' | 'donation_center';
export type EmergencyLevel = 'normal' | 'watch' | 'urgent' | 'critical';

export type BloodAvailability = {
  bloodGroup: BloodGroup;
  label: string;
  availableUnits: number;
  expiringUnits: number;
  status: BloodStockStatus;
};

export type SmartBloodBankCenter = {
  id: string;
  source: 'hospital' | 'partner_hospital';
  name: string;
  centerType: CenterType;
  region: string;
  city: string;
  address: string;
  contactPhone: string;
  email?: string | null;
  description?: string | null;
  latitude: number;
  longitude: number;
  distanceKm: number | null;
  operatingStatus: 'open_24_7' | 'open' | 'limited' | 'unknown';
  emergencyLevel: EmergencyLevel;
  totalUnits: number;
  lowStockCount: number;
  criticalStockCount: number;
  availableBloodGroups: string[];
  bloodAvailability: BloodAvailability[];
  activeEmergencyRequests: number;
  lastUpdated: string | null;
};

export type SmartEmergencyRequest = {
  id: string;
  hospitalId: string;
  hospitalName: string;
  hospitalCenterName?: string | null;
  ward?: string | null;
  bloodGroup: BloodGroup;
  bloodGroupLabel: string;
  unitsNeeded: number;
  priority: string;
  status: string;
  trackingStatus: string;
  location: string;
  emergencyLocation?: string | null;
  city?: string | null;
  region?: string | null;
  locationNotes?: string | null;
  notes?: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
  requiredBy: string;
  distanceKm: number | null;
  nearby: {
    radius5km: { compatibleDonors: number; bloodBanks: number; hospitalsWithStock: number };
    radius10km: { compatibleDonors: number; bloodBanks: number; hospitalsWithStock: number };
    radius20km: { compatibleDonors: number; bloodBanks: number; hospitalsWithStock: number };
  };
};

export type SmartBloodBankMapResponse = {
  centers: SmartBloodBankCenter[];
  emergencyRequests: SmartEmergencyRequest[];
  summary: {
    totalCenters: number;
    totalMatchingCenters: number;
    withinRadiusCenters: number;
    centersWithPublishedInventory: number;
    totalUnitsAvailable: number;
    lowStockCenters: number;
    criticalStockCenters: number;
    activeEmergencyRequests: number;
    nearestCenter: SmartBloodBankCenter | null;
    nearestMatchingSource: SmartBloodBankCenter | null;
    radiusFallback: {
      applied: boolean;
      requestedRadiusKm: number | null;
      nearestOutsideRadius: SmartBloodBankCenter | null;
    };
  };
  filters: {
    search: string | null;
    bloodGroup: BloodGroup | null;
    radiusKm: number | null;
    latitude: number | null;
    longitude: number | null;
    emergencyMode: boolean;
    city: string | null;
    region: string | null;
    emergencyReadyOnly: boolean;
  };
};

export type BloodBankFilters = {
  search?: string;
  bloodGroup?: BloodGroup | '';
  city?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  emergencyMode?: boolean;
  emergencyReadyOnly?: boolean;
};

const unwrap = <T>(payload: T | { data: T }): T => {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
};

export async function getSmartBloodBanks(filters: BloodBankFilters = {}) {
  const params = new URLSearchParams();
  if (filters.search?.trim()) params.set('search', filters.search.trim());
  if (filters.bloodGroup) params.set('bloodGroup', filters.bloodGroup);
  if (filters.city?.trim()) params.set('city', filters.city.trim());
  if (filters.region?.trim()) params.set('region', filters.region.trim());
  if (typeof filters.latitude === 'number') params.set('latitude', String(filters.latitude));
  if (typeof filters.longitude === 'number') params.set('longitude', String(filters.longitude));
  if (typeof filters.radiusKm === 'number') params.set('radiusKm', String(filters.radiusKm));
  if (filters.emergencyMode) params.set('emergencyMode', 'true');
  if (filters.emergencyReadyOnly) params.set('emergencyReadyOnly', 'true');

  const response = await api.get<SmartBloodBankMapResponse | { data: SmartBloodBankMapResponse }>(
    `/public/maps/blood-banks${params.toString() ? `?${params.toString()}` : ''}`,
  );
  return unwrap<SmartBloodBankMapResponse>(response.data);
}
