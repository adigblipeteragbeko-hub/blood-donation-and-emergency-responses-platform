import { Injectable, Logger } from '@nestjs/common';

type GeocodeResult = {
  latitude: number;
  longitude: number;
};

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly ghanaCityFallbacks: Record<string, GeocodeResult> = {
    accra: { latitude: 5.6037, longitude: -0.187 },
    tema: { latitude: 5.6698, longitude: -0.0166 },
    kumasi: { latitude: 6.6885, longitude: -1.6244 },
    tamale: { latitude: 9.4075, longitude: -0.8533 },
    'cape coast': { latitude: 5.1053, longitude: -1.2466 },
    ho: { latitude: 6.6111, longitude: 0.4703 },
    takoradi: { latitude: 4.9041, longitude: -1.7748 },
    sunyani: { latitude: 7.3399, longitude: -2.3268 },
    koforidua: { latitude: 6.0941, longitude: -0.2591 },
    bolgatanga: { latitude: 10.7856, longitude: -0.8514 },
  };

  private fallbackByGhanaLocation(input: {
    address?: string | null;
    city?: string | null;
    region?: string | null;
    location?: string | null;
  }): GeocodeResult | null {
    const haystack = [input.city, input.location, input.address, input.region]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack) return null;

    for (const [key, value] of Object.entries(this.ghanaCityFallbacks)) {
      if (haystack.includes(key)) {
        return value;
      }
    }
    return null;
  }

  async geocodeHospitalAddress(input: {
    hospitalName?: string | null;
    address?: string | null;
    city?: string | null;
    region?: string | null;
    location?: string | null;
  }): Promise<GeocodeResult | null> {
    const query = [
      input.hospitalName?.trim(),
      input.address?.trim(),
      input.city?.trim(),
      input.region?.trim(),
      input.location?.trim(),
      'Ghana',
    ]
      .filter(Boolean)
      .join(', ');

    if (!query) return null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
        {
          headers: { 'User-Agent': 'BloodPlatform/1.0 hospital-map-integration' },
          signal: controller.signal,
        },
      );
      clearTimeout(timeout);

      if (!response.ok) return null;
      const payload = (await response.json()) as Array<{ lat?: string; lon?: string }>;
      const first = payload[0];
      const latitude = first?.lat ? Number(first.lat) : NaN;
      const longitude = first?.lon ? Number(first.lon) : NaN;

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return this.fallbackByGhanaLocation(input);
      }

      return { latitude, longitude };
    } catch (error) {
      this.logger.warn('Geocoding failed, continuing with manual/fallback coordinates.');
      return this.fallbackByGhanaLocation(input);
    }
  }
}
