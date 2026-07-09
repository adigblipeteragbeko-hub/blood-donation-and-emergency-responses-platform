import { api, unwrap } from './api';

export type DonorLocationPayload = {
  message?: string;
  donor?: {
    latitude?: number | null;
    longitude?: number | null;
    locationSharingEnabled?: boolean | null;
    accuracyMeters?: number | null;
  };
};

export async function getDonorLocation() {
  const response = await api.get('/maps/donor/location');
  return unwrap<DonorLocationPayload>(response.data);
}

export async function updateDonorLocation(payload: {
  latitude?: number;
  longitude?: number;
  locationSharingEnabled?: boolean;
  accuracyMeters?: number;
  source?: string;
}) {
  const response = await api.patch('/maps/donor/location', payload);
  return unwrap<DonorLocationPayload>(response.data);
}
