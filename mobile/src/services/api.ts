import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { getApiBaseUrl } from '../constants/config';
import { authStorageKeys } from '../constants/storageKeys';

export type ApiEnvelope<T> = { success?: boolean; data: T; message?: string };

export function unwrap<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as ApiEnvelope<T>).data;
  }
  return payload as T;
}

let refreshPromise: Promise<string | null> | null = null;

function friendlyMessage(error: AxiosError) {
  const status = error.response?.status;
  const body = error.response?.data as { error?: { message?: string }; message?: string } | undefined;
  const raw = String(body?.error?.message ?? body?.message ?? error.message ?? '').trim();
  const lower = raw.toLowerCase();
  const url = String(error.config?.url ?? '');
  const isTimeout = error.code === 'ECONNABORTED' || lower.includes('timeout') || lower.includes('exceeded');
  const isNetworkError = error.code === 'ERR_NETWORK' || lower.includes('network error') || lower.includes('network request failed');

  if (url.includes('/auth/login')) {
    if (lower.includes('verify')) return 'Please verify your email address before signing in.';
    if (lower.includes('inactive') || lower.includes('disabled')) return 'Your account is currently inactive. Please contact support.';
    if (status === 401 || lower.includes('invalid')) return 'Invalid email or password. Please check your details and try again.';
    if (isTimeout) return 'The server took too long to respond. Please check your API address and try again.';
    if (isNetworkError || !error.response) return 'Unable to reach the server. Check your connection and API address.';
  }

  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'You are not allowed to perform this action.';
  if (isTimeout) return 'The server took too long to respond. Please check your API address and try again.';
  if (isNetworkError || !error.response) return 'Unable to reach the server. Check your connection and API address.';
  return raw || 'Something went wrong. Please try again.';
}

export const api = axios.create({
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

async function refreshAccessToken() {
  const refreshToken = await SecureStore.getItemAsync(authStorageKeys.REFRESH_KEY);
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${getApiBaseUrl()}/auth/refresh`, { refreshToken }, { headers: { 'Content-Type': 'application/json' } })
      .then(async (response) => {
        const payload = unwrap<{ accessToken: string; refreshToken: string }>(response.data);
        if (!payload?.accessToken || !payload?.refreshToken) return null;
        await SecureStore.setItemAsync(authStorageKeys.ACCESS_KEY, payload.accessToken);
        await SecureStore.setItemAsync(authStorageKeys.REFRESH_KEY, payload.refreshToken);
        return payload.accessToken;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use(async (config) => {
  config.baseURL = getApiBaseUrl();
  const token = await SecureStore.getItemAsync(authStorageKeys.ACCESS_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { __retriedWithRefresh?: boolean }) | undefined;

    if (error.response?.status === 401 && originalRequest && !originalRequest.__retriedWithRefresh && !String(originalRequest.url ?? '').includes('/auth/login')) {
      originalRequest.__retriedWithRefresh = true;
      const nextToken = await refreshAccessToken();
      if (nextToken) {
        originalRequest.headers.Authorization = `Bearer ${nextToken}`;
        return api(originalRequest);
      }
    }

    return Promise.reject(new Error(friendlyMessage(error)));
  },
);

export async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(authStorageKeys.ACCESS_KEY),
    SecureStore.deleteItemAsync(authStorageKeys.REFRESH_KEY),
    SecureStore.deleteItemAsync(authStorageKeys.USER_KEY),
  ]);
}

export async function saveStoredSession(payload: { accessToken: string; refreshToken: string; user: unknown }) {
  await SecureStore.setItemAsync(authStorageKeys.ACCESS_KEY, payload.accessToken);
  await SecureStore.setItemAsync(authStorageKeys.REFRESH_KEY, payload.refreshToken);
  await SecureStore.setItemAsync(authStorageKeys.USER_KEY, JSON.stringify(payload.user));
}

export async function readStoredUser<T>() {
  const raw = await SecureStore.getItemAsync(authStorageKeys.USER_KEY);
  return raw ? (JSON.parse(raw) as T) : null;
}
