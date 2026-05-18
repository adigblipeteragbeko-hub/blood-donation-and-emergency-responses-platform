export type SmartBloodBankCenterType = 'hospital' | 'blood_bank' | 'donation_center';

export type SmartBloodStockStatus = 'stable' | 'low' | 'critical' | 'unpublished';

export type SmartBloodAvailability = {
  bloodGroup: string;
  label: string;
  availableUnits: number;
  expiringUnits: number;
  status: SmartBloodStockStatus;
};

export type SmartBloodBankCenter = {
  id: string;
  source: 'hospital' | 'partner_hospital';
  name: string;
  centerType: SmartBloodBankCenterType;
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
  emergencyLevel: 'normal' | 'watch' | 'urgent' | 'critical';
  totalUnits: number;
  lowStockCount: number;
  criticalStockCount: number;
  availableBloodGroups: string[];
  bloodAvailability: SmartBloodAvailability[];
  activeEmergencyRequests: number;
  lastUpdated: string | null;
};

export type SmartEmergencyRequest = {
  id: string;
  hospitalId: string;
  hospitalName: string;
  bloodGroup: string;
  bloodGroupLabel: string;
  unitsNeeded: number;
  priority: string;
  status: string;
  location: string;
  latitude: number;
  longitude: number;
  createdAt: string;
  requiredBy: string;
  distanceKm: number | null;
};

export type SmartBloodBankSummary = {
  totalCenters: number;
  centersWithPublishedInventory: number;
  totalUnitsAvailable: number;
  lowStockCenters: number;
  criticalStockCenters: number;
  activeEmergencyRequests: number;
  nearestCenter: SmartBloodBankCenter | null;
  nearestMatchingSource: SmartBloodBankCenter | null;
};

export type SmartBloodBankMapResponse = {
  centers: SmartBloodBankCenter[];
  emergencyRequests: SmartEmergencyRequest[];
  summary: SmartBloodBankSummary;
  filters: {
    search: string | null;
    bloodGroup: string | null;
    radiusKm: number | null;
    latitude: number | null;
    longitude: number | null;
    emergencyMode: boolean;
  };
};
