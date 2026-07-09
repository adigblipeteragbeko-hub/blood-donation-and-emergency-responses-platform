import { BloodGroup } from '../constants/bloodGroups';
import { api, unwrap } from './api';

export type BloodAvailability = {
  bloodGroup: BloodGroup | string;
  label?: string;
  availableUnits: number;
  expiringUnits?: number;
  status?: 'stable' | 'low' | 'critical' | 'unpublished';
};

export type SmartBloodBankCenter = {
  id: string;
  source: 'hospital' | 'partner_hospital';
  name: string;
  centerType: 'hospital' | 'blood_bank' | 'donation_center';
  region?: string | null;
  city?: string | null;
  address?: string | null;
  contactPhone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  operatingStatus?: 'open_24_7' | 'open' | 'limited' | 'unknown';
  emergencyLevel?: 'normal' | 'watch' | 'urgent' | 'critical';
  totalUnits?: number;
  availableBloodGroups?: string[];
  bloodAvailability?: BloodAvailability[];
  activeEmergencyRequests?: number;
};

export type SmartBloodBankResponse = {
  centers: SmartBloodBankCenter[];
  summary?: {
    totalCenters?: number;
    totalMatchingCenters?: number;
    withinRadiusCenters?: number;
    totalUnitsAvailable?: number;
    nearestCenter?: SmartBloodBankCenter | null;
  };
};

export async function getSmartBloodBanks(filters: {
  search?: string;
  bloodGroup?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  emergencyReadyOnly?: boolean;
} = {}) {
  const response = await api.get('/public/maps/blood-banks', { params: filters });
  return unwrap<SmartBloodBankResponse>(response.data);
}
