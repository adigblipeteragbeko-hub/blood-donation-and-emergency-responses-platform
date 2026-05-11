import api from './api';

export type WebsiteAlertItem = {
  id: string;
  title: string;
  message: string;
  bloodType: string | null;
  hospitalName: string;
  urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  isActive: boolean;
  isSticky: boolean;
  isScrolling: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteStatisticItem = {
  id: string;
  key: 'REGISTERED_DONORS' | 'EMERGENCY_MATCHES' | 'PARTNER_HOSPITALS' | 'REQUESTS_COMPLETED';
  label: string;
  description: string | null;
  overrideValue: number | null;
  isOverrideEnabled: boolean;
  liveValue: number;
  value: number;
  createdAt: string;
  updatedAt: string;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TestimonialItem = {
  id: string;
  name: string;
  role: string;
  message: string;
  location: string | null;
  isApproved: boolean;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AwarenessPostItem = {
  id: string;
  title: string;
  content: string;
  image: string | null;
  category: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PartnerHospitalItem = {
  id: string;
  hospitalName: string;
  location: string;
  phone: string;
  email: string;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteFooterSettingsItem = {
  id: string;
  singletonKey: string;
  emergencyPhonePrimary: string;
  emergencyPhoneSecondary: string;
  supportEmail: string;
  facebookUrl: string | null;
  instagramUrl: string | null;
  linkedinUrl: string | null;
  footerText: string;
  createdAt: string;
  updatedAt: string;
};

export type WebsiteAnnouncementItem = {
  id: string;
  type: 'ALERT' | 'AWARENESS' | 'SYSTEM';
  title: string;
  message: string;
  href: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  badge: string | null;
  isPublished: boolean;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean;
};

export type PublicWebsiteContent = {
  alert: WebsiteAlertItem | null;
  statistics: WebsiteStatisticItem[];
  faqs: FaqItem[];
  testimonials: TestimonialItem[];
  awarenessPosts: AwarenessPostItem[];
  partnerHospitals: PartnerHospitalItem[];
  footerSettings: WebsiteFooterSettingsItem;
};

export type WebsiteManagementDashboard = PublicWebsiteContent & {
  alerts: WebsiteAlertItem[];
};

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;
const WEBSITE_MANAGEMENT_CACHE_KEY = 'website-management-dashboard-cache-v1';
const PUBLIC_WEBSITE_CACHE_KEY = 'public-website-cache-v1';

const readSessionCache = <T>(key: string): T | null => {
  try {
    const cached = window.sessionStorage.getItem(key);
    return cached ? (JSON.parse(cached) as T) : null;
  } catch {
    return null;
  }
};

const writeSessionCache = (key: string, value: unknown) => {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Cache is only a speed boost; API data remains the source of truth.
  }
};

export const getCachedWebsiteManagementDashboard = () =>
  readSessionCache<WebsiteManagementDashboard>(WEBSITE_MANAGEMENT_CACHE_KEY);

export const getCachedPublicWebsiteContent = () =>
  readSessionCache<PublicWebsiteContent>(PUBLIC_WEBSITE_CACHE_KEY);

export async function getWebsiteManagementDashboard() {
  const response = await api.get('/admin/website-management');
  const data = unwrap<WebsiteManagementDashboard>(response);
  writeSessionCache(WEBSITE_MANAGEMENT_CACHE_KEY, data);
  return data;
}

export async function updateWebsiteStatistic(
  key: WebsiteStatisticItem['key'],
  payload: Partial<Pick<WebsiteStatisticItem, 'label' | 'description' | 'overrideValue' | 'isOverrideEnabled'>>,
) {
  const response = await api.patch(`/admin/website-management/statistics/${key}`, payload);
  return unwrap<WebsiteStatisticItem>(response);
}

export async function createWebsiteAlert(payload: {
  title: string;
  message: string;
  bloodType?: string | null;
  hospitalName: string;
  urgencyLevel: WebsiteAlertItem['urgencyLevel'];
  isActive: boolean;
  isSticky: boolean;
  isScrolling: boolean;
  expiresAt?: string | null;
}) {
  const response = await api.post('/admin/website-management/alerts', payload);
  return unwrap<WebsiteAlertItem>(response);
}

export async function updateWebsiteAlert(id: string, payload: Partial<{
  title: string;
  message: string;
  bloodType: string | null;
  hospitalName: string;
  urgencyLevel: WebsiteAlertItem['urgencyLevel'];
  isActive: boolean;
  isSticky: boolean;
  isScrolling: boolean;
  expiresAt: string | null;
}>) {
  const response = await api.patch(`/admin/website-management/alerts/${id}`, payload);
  return unwrap<WebsiteAlertItem>(response);
}

export async function deleteWebsiteAlert(id: string) {
  const response = await api.delete(`/admin/website-management/alerts/${id}`);
  return unwrap<{ message: string }>(response);
}

export async function createFaq(payload: Pick<FaqItem, 'question' | 'answer' | 'isPublished'>) {
  const response = await api.post('/admin/website-management/faqs', payload);
  return unwrap<FaqItem>(response);
}

export async function updateFaq(id: string, payload: Partial<Pick<FaqItem, 'question' | 'answer' | 'isPublished'>>) {
  const response = await api.patch(`/admin/website-management/faqs/${id}`, payload);
  return unwrap<FaqItem>(response);
}

export async function deleteFaq(id: string) {
  const response = await api.delete(`/admin/website-management/faqs/${id}`);
  return unwrap<{ message: string }>(response);
}

export async function createTestimonial(payload: Pick<TestimonialItem, 'name' | 'role' | 'message' | 'location' | 'isApproved' | 'isPublished'>) {
  const response = await api.post('/admin/website-management/testimonials', payload);
  return unwrap<TestimonialItem>(response);
}

export async function updateTestimonial(
  id: string,
  payload: Partial<Pick<TestimonialItem, 'name' | 'role' | 'message' | 'location' | 'isApproved' | 'isPublished'>>,
) {
  const response = await api.patch(`/admin/website-management/testimonials/${id}`, payload);
  return unwrap<TestimonialItem>(response);
}

export async function deleteTestimonial(id: string) {
  const response = await api.delete(`/admin/website-management/testimonials/${id}`);
  return unwrap<{ message: string }>(response);
}

export async function createAwarenessPost(
  payload: Pick<AwarenessPostItem, 'title' | 'content' | 'image' | 'category' | 'isPublished'>,
) {
  const response = await api.post('/admin/website-management/awareness-posts', payload);
  return unwrap<AwarenessPostItem>(response);
}

export async function updateAwarenessPost(
  id: string,
  payload: Partial<Pick<AwarenessPostItem, 'title' | 'content' | 'image' | 'category' | 'isPublished'>>,
) {
  const response = await api.patch(`/admin/website-management/awareness-posts/${id}`, payload);
  return unwrap<AwarenessPostItem>(response);
}

export async function deleteAwarenessPost(id: string) {
  const response = await api.delete(`/admin/website-management/awareness-posts/${id}`);
  return unwrap<{ message: string }>(response);
}

export async function createPartnerHospital(
  payload: Pick<PartnerHospitalItem, 'hospitalName' | 'location' | 'phone' | 'email' | 'description' | 'latitude' | 'longitude'>,
) {
  const response = await api.post('/admin/website-management/partner-hospitals', payload);
  return unwrap<PartnerHospitalItem>(response);
}

export async function updatePartnerHospital(
  id: string,
  payload: Partial<Pick<PartnerHospitalItem, 'hospitalName' | 'location' | 'phone' | 'email' | 'description' | 'latitude' | 'longitude'>>,
) {
  const response = await api.patch(`/admin/website-management/partner-hospitals/${id}`, payload);
  return unwrap<PartnerHospitalItem>(response);
}

export async function deletePartnerHospital(id: string) {
  const response = await api.delete(`/admin/website-management/partner-hospitals/${id}`);
  return unwrap<{ message: string }>(response);
}

export async function getFooterSettings() {
  const response = await api.get('/admin/website-management/footer');
  return unwrap<WebsiteFooterSettingsItem>(response);
}

export async function updateFooterSettings(
  payload: Partial<
    Pick<
      WebsiteFooterSettingsItem,
      'emergencyPhonePrimary' | 'emergencyPhoneSecondary' | 'supportEmail' | 'facebookUrl' | 'instagramUrl' | 'linkedinUrl' | 'footerText'
    >
  >,
) {
  const response = await api.patch('/admin/website-management/footer', payload);
  return unwrap<WebsiteFooterSettingsItem>(response);
}

export async function getPublicWebsiteContent() {
  const response = await api.get('/public/website');
  const data = unwrap<PublicWebsiteContent>(response);
  writeSessionCache(PUBLIC_WEBSITE_CACHE_KEY, data);
  return data;
}

export async function getPublicAnnouncements() {
  const response = await api.get('/public/announcements');
  return unwrap<WebsiteAnnouncementItem[]>(response);
}

export async function getUserAnnouncements() {
  const response = await api.get('/announcements');
  return unwrap<WebsiteAnnouncementItem[]>(response);
}

export async function markAnnouncementRead(id: string) {
  const response = await api.patch(`/announcements/${id}/read`);
  return unwrap<{ id: string; isRead: boolean }>(response);
}

export async function markAllAnnouncementsRead() {
  const response = await api.post('/announcements/read-all');
  return unwrap<{ updatedCount: number }>(response);
}
