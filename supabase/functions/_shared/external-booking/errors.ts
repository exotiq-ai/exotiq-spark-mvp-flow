import { ERROR_CODES, ApiError, validateContract } from './contracts.ts';

export type ErrorCode = typeof ERROR_CODES[number];
const policies: Record<ErrorCode, { status: number; message: string; retryable: boolean }> = {
  invalid_input: { status: 400, message: 'Invalid request input.', retryable: false },
  unauthorized: { status: 401, message: 'Customer authorization is required.', retryable: false },
  forbidden: { status: 403, message: 'This operation is not permitted.', retryable: false },
  not_found: { status: 404, message: 'Rental request not found.', retryable: false },
  dates_unavailable: { status: 409, message: 'The requested dates are unavailable.', retryable: false },
  quote_changed: { status: 409, message: 'The quote or terms changed. Review a new quote.', retryable: false },
  idempotency_conflict: { status: 409, message: 'This retry key was used for a different request.', retryable: false },
  request_in_flight: { status: 409, message: 'This request is still being processed. Retry with the same key.', retryable: true },
  consent_mismatch: { status: 409, message: 'Customer consent does not match this request.', retryable: false },
  quote_expired: { status: 410, message: 'The quote expired. Review a new quote.', retryable: false },
  consent_expired: { status: 410, message: 'Customer consent expired. Authorize again.', retryable: false },
  configuration_unavailable: { status: 503, message: 'External booking configuration is temporarily unavailable.', retryable: true },
  external_writes_disabled: { status: 503, message: 'External booking writes are currently disabled.', retryable: false },
  grant_expired: { status: 409, message: 'Customer authorization expired. Authorize this rental again.', retryable: false },
  grant_revoked: { status: 409, message: 'Customer authorization was withdrawn. A new delegation requires customer approval.', retryable: false },
  payment_window_expired: { status: 410, message: 'The payment window expired.', retryable: false },
  rate_limited: { status: 429, message: 'Too many requests. Retry after the specified delay.', retryable: true },
  upstream_unavailable: { status: 503, message: 'Authoritative information is temporarily unavailable.', retryable: true },
};
type Details = { field?: string; retry_after_seconds?: number };
export class BookingApiError extends Error {
  readonly code: ErrorCode;
  readonly details?: Details;
  constructor(code: ErrorCode, details?: Details) {
    super(policies[code]?.message ?? policies.upstream_unavailable.message);
    this.name = 'BookingApiError';
    this.code = Object.hasOwn(policies, code) ? code : 'upstream_unavailable';
    this.details = details;
  }
}
export type SafeError = { status: number; body: { code: ErrorCode; message: string; request_id: string; retryable: boolean; details?: Details }; headers: Record<string, string> };

/** Only this allowlist may cross the API boundary. Never serialize an upstream
 * exception, arbitrary message/details, caller credentials or booking existence.
 * For resource lookups use not_found, not forbidden, for every authorization miss.
 */
export function safeApiError(error: unknown, requestId?: string): SafeError {
  const code = error instanceof BookingApiError ? error.code : 'upstream_unavailable';
  const policy = policies[code];
  const request_id = typeof requestId === 'string' && /^[A-Za-z0-9_-]{16,80}$/.test(requestId) ? requestId : crypto.randomUUID();
  const details: Details = {};
  const fields = ApiError.properties!.details.properties!.field.enum!;
  if (error instanceof BookingApiError && fields.includes(error.details?.field)) details.field = error.details!.field;
  if (policy.retryable) {
    const delay = error instanceof BookingApiError ? error.details?.retry_after_seconds : undefined;
    const maxDelay = code === 'request_in_flight' ? 5 : 3600;
    details.retry_after_seconds = Number.isInteger(delay) && delay! >= 1 && delay! <= maxDelay ? delay : (code === 'request_in_flight' ? 2 : 30);
  }
  const body: SafeError['body'] = { code, message: policy.message, request_id, retryable: policy.retryable, ...(Object.keys(details).length ? { details } : {}) };
  if (!validateContract('ApiError', body).ok) throw new Error('Internal error policy violates canonical contract');
  return { status: policy.status, body, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Request-Id': request_id, ...(code === 'unauthorized' ? { 'WWW-Authenticate': 'Bearer realm="external-booking", error="invalid_token"' } : {}), ...(policy.retryable ? { 'Retry-After': String(details.retry_after_seconds) } : {}) } };
}
export function errorResponse(error: unknown, requestId?: string): Response {
  const safe = safeApiError(error, requestId);
  return new Response(JSON.stringify(safe.body), { status: safe.status, headers: safe.headers });
}
