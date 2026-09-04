import axios from 'axios';

const PRODUCTION_API_BASE_URL =
  'https://blood-donation-and-emergency-responses-platform-production.up.railway.app';

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : 'http://localhost:4000'),
  headers: {
    'Content-Type': 'application/json',
  },
});

let refreshPromise: Promise<string | null> | null = null;

const friendlyMessage = (message?: string, status?: number, url?: string) => {
  const raw = String(message ?? '').trim();
  const lower = raw.toLowerCase();
  const requestUrl = String(url ?? '');

  if (requestUrl.includes('/auth/login')) {
    if (lower.includes('not verified') || lower.includes('verify')) {
      return 'Please verify your email address before signing in.';
    }
    if (lower.includes('inactive') || lower.includes('disabled')) {
      return 'Your account is currently inactive. Please contact support.';
    }
    if (status === 401 || lower.includes('invalid credential') || lower.includes('invalid email') || lower.includes('password')) {
      return 'Invalid email or password. Please check your details and try again.';
    }
  }
  if (status === 401 || lower.includes('unauthorized') || lower.includes('invalid token')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (lower.includes('ward is required')) {
    return 'Please enter the ward or unit for this emergency request.';
  }
  if (lower.includes('city is required') || lower.includes('region is required') || lower.includes('latitude and longitude are required')) {
    return 'Use Hospital Profile Location or update Hospital Profile before submitting emergency requests.';
  }
  if (lower.includes('hospital profile location is incomplete')) {
    return 'Hospital profile location is incomplete. Please update the hospital city, region, and map coordinates before submitting emergency requests.';
  }
  if (lower.includes('server error') || lower.includes('internal server error')) {
    return 'Something went wrong while processing your request. Please try again.';
  }

  return raw || 'Something went wrong while processing your request. Please try again.';
};

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken }, { headers: { 'Content-Type': 'application/json' } })
      .then((response) => {
        const payload = response.data?.data ?? response.data;
        if (!payload?.accessToken || !payload?.refreshToken) return null;
        localStorage.setItem('accessToken', payload.accessToken);
        localStorage.setItem('refreshToken', payload.refreshToken);
        return payload.accessToken as string;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config ?? {};
    const status = error.response?.status;

    if (status === 401 && !originalRequest.__retriedWithRefresh && !String(originalRequest.url ?? '').includes('/auth/refresh')) {
      originalRequest.__retriedWithRefresh = true;
      const nextToken = await refreshAccessToken();
      if (nextToken) {
        originalRequest.headers = {
          ...(originalRequest.headers ?? {}),
          Authorization: `Bearer ${nextToken}`,
        };
        return api(originalRequest);
      }
    }

    if (error.response?.data) {
      const currentMessage =
        error.response.data?.error?.message ??
        error.response.data?.message ??
        error.message;
      const message = friendlyMessage(currentMessage, status, originalRequest.url);
      error.response.data = {
        ...error.response.data,
        message,
        error: {
          ...(error.response.data.error ?? {}),
          message,
        },
      };
    }

    return Promise.reject(error);
  },
);

export default api;
