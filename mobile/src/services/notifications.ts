import { api, unwrap } from './api';

export type NotificationItem = {
  id: string;
  title: string;
  body?: string | null;
  delivered?: boolean;
  createdAt: string;
  bloodRequestId?: string | null;
  campaignId?: string | null;
  type?: string | null;
};

export async function getNotifications(params?: { skip?: number; take?: number }) {
  const response = await api.get('/notifications', { params });
  return unwrap<NotificationItem[]>(response.data);
}

export async function markNotificationDelivered(notificationId: string, delivered = true) {
  const response = await api.patch('/notifications/delivery', { notificationId, delivered });
  return unwrap<NotificationItem>(response.data);
}

export async function respondToMobilizationCampaign(payload: {
  campaignId: string;
  responseStatus: 'INTERESTED' | 'NOT_AVAILABLE' | 'APPOINTMENT_SCHEDULED';
  notes?: string;
}) {
  const response = await api.post('/notifications/mobilization-response', payload);
  return unwrap<{ responseStatus: string; message: string }>(response.data);
}
