export type ApiEnvelope<T> = {
  success?: boolean;
  data: T;
  timestamp?: string;
};

export function unwrapApiResponse<T>(payload: T | ApiEnvelope<T>): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    ('success' in payload || 'timestamp' in payload)
  ) {
    return (payload as ApiEnvelope<T>).data;
  }

  return payload as T;
}
