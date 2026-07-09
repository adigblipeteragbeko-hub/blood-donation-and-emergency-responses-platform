import { api, unwrap } from './api';

export type Appointment = {
  id: string;
  appointmentReference?: string | null;
  scheduledAt: string;
  status: string;
  appointmentType?: string | null;
  notes?: string | null;
  hospital?: { hospitalName?: string | null; location?: string | null; city?: string | null; region?: string | null } | null;
};

export async function getAppointments(params?: { skip?: number; take?: number }) {
  const response = await api.get('/appointments', { params });
  return unwrap<Appointment[]>(response.data);
}
