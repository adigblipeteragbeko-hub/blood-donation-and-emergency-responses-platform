import api from './api';

export type DonorCommunicationFilters = {
  search?: string;
  bloodGroup?: string;
  region?: string;
  city?: string;
  hospitalId?: string;
  eligibilityStatus?: string;
  accountStatus?: string;
  smsEnabled?: string;
  lastDonationFrom?: string;
  lastDonationTo?: string;
  neverDonated?: string;
  reminderDue?: string;
  skip?: number;
  take?: number;
};

export type DonorContactItem = {
  id: string;
  donorNumber?: string | null;
  fullName: string;
  bloodGroup: string;
  region?: string | null;
  city?: string | null;
  maskedPhone: string;
  maskedEmail: string;
  eligibilityStatus: string;
  accountStatus: string;
  lastDonationDate?: string | null;
  smsEnabled: boolean;
  preferredHospital?: string | null;
};

export type DonorContactsResponse = {
  items: DonorContactItem[];
  total: number;
  skip: number;
  take: number;
  summary: {
    smsEnabledCount: number;
    validPhoneCount: number;
    excludedCount: number;
  };
};

export type SmsPreviewResponse = {
  requestedDonors: number;
  eligibleRecipients: number;
  excluded: Record<string, number>;
  estimatedCredits: number;
  messageLength: number;
  estimatedSmsParts: number;
  sampleRecipients: Array<{ donorName: string; maskedPhone: string }>;
};

export type SmsCampaignItem = {
  id: string;
  name: string;
  message: string;
  status: string;
  requestedDonorCount: number;
  eligibleRecipientCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  creditUsed: number;
  createdAt: string;
  completedAt?: string | null;
  createdBy?: { email: string; role: string } | null;
};

export async function getDonorCommunicationDonors(filters: DonorCommunicationFilters) {
  const response = await api.get('/admin/donor-communications/donors', { params: filters });
  return response.data.data ?? response.data as DonorContactsResponse;
}

export async function previewDonorSms(payload: {
  donorIds?: string[];
  filters?: DonorCommunicationFilters;
  message: string;
  selectionMode: 'EXPLICIT' | 'FILTERED';
}) {
  const response = await api.post('/admin/donor-communications/sms/preview', payload);
  return response.data.data ?? response.data as SmsPreviewResponse;
}

export async function launchDonorSmsCampaign(payload: {
  name: string;
  donorIds?: string[];
  filters?: DonorCommunicationFilters;
  message: string;
  selectionMode: 'EXPLICIT' | 'FILTERED';
  confirmationText: string;
}) {
  const response = await api.post('/admin/donor-communications/sms/campaigns', payload);
  return response.data.data ?? response.data;
}

export async function getDonorSmsCampaigns(params: { skip?: number; take?: number; status?: string; search?: string } = {}) {
  const response = await api.get('/admin/donor-communications/sms/campaigns', { params });
  return response.data.data ?? response.data as { total: number; items: SmsCampaignItem[] };
}

export async function exportDonorContacts(payload: {
  donorIds?: string[];
  filters?: DonorCommunicationFilters;
  fields: string[];
  format: 'csv';
}) {
  const response = await api.post('/admin/donor-communications/export', payload, { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  return {
    blob: response.data as Blob,
    filename: match?.[1] ?? `bloodsos-donor-contacts-${new Date().toISOString().slice(0, 10)}.csv`,
  };
}
