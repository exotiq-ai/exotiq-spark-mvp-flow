/** Canonical transport-independent v1 schemas. OpenAPI and adapters consume these.
 * JSON Schema 2020-12: https://json-schema.org/draft/2020-12/json-schema-validation
 * OpenAPI: https://spec.openapis.org/oas/v3.1.2.html
 * Cross-field invariants additionally require validateContract; format annotations
 * alone do not enforce timezone, quote arithmetic, visibility or authorization.
 * Source writer is create_marketplace_booking; applied overload/ACL parity remains gated.
 */
export interface JsonSchema {
  type?: string; properties?: Record<string, JsonSchema>; required?: readonly string[];
  additionalProperties?: boolean; items?: JsonSchema; minItems?: number; maxItems?: number;
  uniqueItems?: boolean; minLength?: number; maxLength?: number; pattern?: string;
  format?: string; minimum?: number; maximum?: number; enum?: readonly unknown[];
  const?: unknown; anyOf?: readonly JsonSchema[]; oneOf?: readonly JsonSchema[];
  description?: string; default?: unknown;
}
const text = (maxLength: number, minLength = 1): JsonSchema => ({ type: 'string', minLength, maxLength });
const enumeration = (...values: string[]): JsonSchema => ({ type: 'string', enum: values });
const integer = (maximum = Number.MAX_SAFE_INTEGER, minimum = 0): JsonSchema => ({ type: 'integer', minimum, maximum });
const object = (properties: Record<string, JsonSchema>, optional: string[] = []): JsonSchema => ({ type: 'object', properties, required: Object.keys(properties).filter((key) => !optional.includes(key)), additionalProperties: false });
const array = (items: JsonSchema, maxItems: number, minItems = 0): JsonSchema => ({ type: 'array', items, maxItems, minItems });
const nullable = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: 'null' }] });
const timestamp: JsonSchema = { ...text(35), format: 'date-time', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?(?:Z|[+-]\\d{2}:\\d{2})$' };
const uuid: JsonSchema = { ...text(36, 36), format: 'uuid' };
const httpsUrl: JsonSchema = { ...text(2048), format: 'https-url', pattern: '^https://' };
const cursor: JsonSchema = { ...text(2048), pattern: '^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$' };
const slug: JsonSchema = { ...text(80), pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' };
const metadata = { api_version: { const: 'v1' }, source_checked_at: timestamp };
const rentalWindow = { operator_id: uuid, vehicle_id: uuid, pickup_at: timestamp, return_at: timestamp, timezone: { ...text(80), format: 'iana-timezone' } };
const options: JsonSchema = { ...array(enumeration('premium', 'standard', 'decline'), 1, 1), uniqueItems: true, description: 'Current backend protection IDs. No unrecognized add-ons or client amounts.' };
export const BACKEND_STATUSES = ['pending_documents', 'requested', 'pending', 'pending_payment', 'confirmed', 'active', 'declined', 'cancelled', 'expired', 'completed', 'refunded'] as const;
export const NEXT_ACTIONS = ['verify_identity', 'await_operator', 'hosted_checkout', 'await_payment_settlement', 'await_reconciliation', 'confirmed', 'rental_active', 'declined', 'cancelled', 'expired', 'completed', 'refunded', 'recover_authorization'] as const;
export const ERROR_CODES = ['invalid_input', 'unauthorized', 'forbidden', 'not_found', 'dates_unavailable', 'quote_changed', 'idempotency_conflict', 'consent_mismatch', 'quote_expired', 'consent_expired', 'payment_window_expired', 'rate_limited', 'upstream_unavailable'] as const;
export const SCOPES = ['catalog:read', 'quotes:create', 'rental_requests:create', 'rental_requests:read', 'checkout:handoff'] as const;
export const OperatorsQuery = object({ city: text(80), operator_slug: slug, cursor, limit: { ...integer(50, 1), default: 20 } }, ['city', 'operator_slug', 'cursor', 'limit']);
export const VehiclesQuery = object({ operator_id: uuid, city: text(80), cursor, limit: { ...integer(50, 1), default: 20 }, pickup_at: timestamp, return_at: timestamp, timezone: rentalWindow.timezone }, ['operator_id', 'city', 'cursor', 'limit', 'pickup_at', 'return_at', 'timezone']);
export const Operator = object({ operator_id: uuid, slug, name: text(160), city: text(80), timezone: rentalWindow.timezone, storefront_url: httpsUrl });
export const Vehicle = object({ operator_id: uuid, vehicle_id: uuid, slug, name: text(160), city: text(80), timezone: rentalWindow.timezone, vehicle_url: httpsUrl, availability_requires_check: { const: true } });
export const OperatorsPage = object({ ...metadata, items: array(Operator, 50), next_cursor: nullable(cursor) });
export const VehiclesPage = object({ ...metadata, items: array(Vehicle, 50), next_cursor: nullable(cursor) });
export const AvailabilityRequest = object(rentalWindow);
export const AvailabilityResult: JsonSchema = { oneOf: [
  object({ ...metadata, ...rentalWindow, availability: enumeration('AVAILABLE', 'UNAVAILABLE') }),
  object({ ...metadata, ...rentalWindow, availability: { const: 'UNKNOWN' }, reason_code: enumeration('upstream_unavailable'), retry_after_seconds: integer(3600, 1) }),
] };
export const QuoteRequest = object({ ...rentalWindow, selected_options: options });
export const QuoteItemization = object({ rental_subtotal_cents: integer(), operator_tax_cents: integer(), operator_tax_inclusive: { type: 'boolean' }, platform_fee_cents: integer(), protection_total_cents: integer(), state_fee_cents: integer(), processing_fee_cents: integer(), deposit_cents: { ...integer(), description: 'Separate security deposit disclosure; excluded from both rental charge totals. No card authorization is created by quoting.' } });
export const PaymentScheduleItem = object({ payee: enumeration('operator', 'exotiq'), amount_cents: integer(), due: enumeration('after_operator_approval', 'after_operator_charge') });
export const QuoteResult = object({ ...metadata, ...rentalWindow, quote_id: uuid, principal_scope: object({ subject: text(256), operator_id: uuid }), expires_at: timestamp, pricing_version: text(128), terms_version: text(128), terms_hash: { ...text(64, 64), pattern: '^[a-f0-9]{64}$' }, selected_options: options, currency: { ...text(3, 3), enum: ['USD'], description: 'ISO 4217 currency. v1 supports USD only; adding a currency requires backend charge-leg and rounding proof.' }, itemization: QuoteItemization, operator_total_cents: integer(), exotiq_total_cents: integer(), total_cents: integer(), payment_schedule: array(PaymentScheduleItem, 2, 2), availability_checked_at: timestamp, holds_inventory: { const: false }, consent_url: httpsUrl });
export const RentalRequestInput = object({ quote_id: uuid, consent_receipt_id: uuid });
export const ScopedLinks = object({ status: httpsUrl, consent: httpsUrl, recovery: httpsUrl, identity: httpsUrl, checkout_handoff: httpsUrl }, ['consent', 'recovery', 'identity', 'checkout_handoff']);
export const RentalRequestResult = object({ ...metadata, ref: { ...text(80), pattern: '^[A-Za-z0-9_-]+$' }, status: enumeration(...BACKEND_STATUSES), next_action: enumeration(...NEXT_ACTIONS), hold_expires_at: nullable(timestamp), links: ScopedLinks });
export const RentalStatusResult = object({ ...RentalRequestResult.properties, payment_due_at: nullable(timestamp), inventory_blocked: { type: 'boolean' }, poll_after_seconds: integer(3600, 1) });
export const CheckoutHandoffResult = object({ ...metadata, customer_url: httpsUrl, expires_at: timestamp, state: enumeration('pending_payment'), next_action: enumeration('hosted_checkout') });
export const ConsentResult = object({ ...metadata, quote_id: uuid, state: enumeration('waiting', 'authorized'), consent_receipt_id: uuid, expires_at: timestamp }, ['consent_receipt_id', 'expires_at']);
export const RecoveryResult = object({ ...metadata, ref: text(80), state: enumeration('authorization_required', 'authorized'), customer_url: httpsUrl, expires_at: timestamp });
export const ApiError = object({ code: enumeration(...ERROR_CODES), message: text(200), request_id: { ...text(80, 16), pattern: '^[A-Za-z0-9_-]+$' }, retryable: { type: 'boolean' }, details: object({ retry_after_seconds: integer(3600, 1), field: enumeration('operator_id', 'vehicle_id', 'pickup_at', 'return_at', 'timezone', 'quote_id', 'consent_receipt_id', 'selected_options', 'cursor', 'limit', 'Idempotency-Key') }, ['retry_after_seconds', 'field']) }, ['details']);
export const schemas = { OperatorsQuery, VehiclesQuery, Operator, Vehicle, OperatorsPage, VehiclesPage, AvailabilityRequest, AvailabilityResult, QuoteRequest, QuoteItemization, PaymentScheduleItem, QuoteResult, RentalRequestInput, ScopedLinks, RentalRequestResult, RentalStatusResult, CheckoutHandoffResult, ConsentResult, RecoveryResult, ApiError };
export type ContractName = keyof typeof schemas;
export type ValidationResult = { ok: true } | { ok: false; issues: string[] };
type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseTimestamp(value: string): { instant: number; wall: number; offset: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || match[8] === '-00:00') return null;
  const [, y, m, d, h, min, sec, fraction = '', zone] = match;
  const numbers = [y, m, d, h, min, sec].map(Number);
  if (numbers[0] < 2000 || numbers[0] > 9999 || numbers[1] < 1 || numbers[1] > 12 || numbers[2] < 1 || numbers[2] > 31 || numbers[3] > 23 || numbers[4] > 59 || numbers[5] > 59) return null;
  const wall = Date.UTC(numbers[0], numbers[1] - 1, numbers[2], numbers[3], numbers[4], numbers[5], Number(fraction.padEnd(3, '0')));
  const date = new Date(wall);
  if (date.getUTCMonth() !== numbers[1] - 1 || date.getUTCDate() !== numbers[2]) return null;
  const offset = zone === 'Z' ? 0 : (zone[0] === '-' ? -1 : 1) * (Number(zone.slice(1, 3)) * 60 + Number(zone.slice(4, 6)));
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 14 || Number(zone.slice(4, 6)) > 59 || Math.abs(offset) > 840)) return null;
  return { instant: wall - offset * 60000, wall, offset };
}
function validTimezone(value: string): boolean {
  if (value !== 'UTC' && !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)+$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; } catch { return false; }
}
function zonedWall(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(instant);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second) + ((instant % 1000) + 1000) % 1000;
}
function validFormat(format: string, value: string): boolean {
  if (format === 'uuid') return uuidPattern.test(value);
  if (format === 'date-time') return parseTimestamp(value) !== null;
  if (format === 'iana-timezone') return validTimezone(value);
  if (format === 'https-url') {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !/[?&](?:t|token|confirmation_token|access_token)=/i.test(url.search); } catch { return false; }
  }
  throw new Error(`Unsupported contract format: ${format}`);
}
/** Validator for exactly the JSON Schema vocabulary used by the canonical schemas.
 * New keywords must be implemented here before adoption; do not silently ignore them.
 * Issues expose field paths only, never caller values or sensitive exception text.
 */
function schemaIssues(schema: JsonSchema, value: unknown, path = '$'): string[] {
  const vocabulary = new Set(['type', 'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'uniqueItems', 'minLength', 'maxLength', 'pattern', 'format', 'minimum', 'maximum', 'enum', 'const', 'anyOf', 'oneOf', 'description', 'default']);
  for (const key of Object.keys(schema)) if (!vocabulary.has(key)) throw new Error(`Unsupported contract keyword: ${key}`);
  if (schema.anyOf) return schema.anyOf.some((branch) => !schemaIssues(branch, value, path).length) ? [] : [path];
  if (schema.oneOf) return schema.oneOf.filter((branch) => !schemaIssues(branch, value, path).length).length === 1 ? [] : [path];
  if ('const' in schema && value !== schema.const) return [path];
  if (schema.enum && !schema.enum.includes(value)) return [path];
  if (schema.type === 'null') return value === null ? [] : [path];
  if (schema.type === 'boolean') return typeof value === 'boolean' ? [] : [path];
  if (schema.type === 'integer') return typeof value === 'number' && Number.isSafeInteger(value) && value >= (schema.minimum ?? -Infinity) && value <= (schema.maximum ?? Infinity) ? [] : [path];
  if (schema.type === 'string') return typeof value === 'string' && Array.from(value).length >= (schema.minLength ?? 0) && Array.from(value).length <= (schema.maxLength ?? Infinity) && (!schema.pattern || new RegExp(schema.pattern).test(value)) && (!schema.format || validFormat(schema.format, value)) ? [] : [path];
  if (schema.type === 'array') {
    if (!Array.isArray(value) || value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity) || (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length)) return [path];
    return value.flatMap((item, i) => schemaIssues(schema.items!, item, `${path}[${i}]`));
  }
  if (schema.type === 'object') {
    if (!isObject(value)) return [path];
    const missing = (schema.required ?? []).filter((key) => !Object.hasOwn(value, key)).map((key) => `${path}.${key}`);
    // Do not echo attacker-controlled unexpected property names.
    if (schema.additionalProperties === false && Object.keys(value).some((key) => !Object.hasOwn(schema.properties!, key))) missing.push(path);
    return [...missing, ...Object.keys(schema.properties ?? {}).filter((key) => Object.hasOwn(value, key)).flatMap((key) => schemaIssues(schema.properties![key], value[key], `${path}.${key}`))];
  }
  return [];
}
/** Half-open interval [pickup,return), explicit offset must match tenant wall-clock.
 * The source availability reader caps its range at start + one calendar year;
 * v1 conservatively caps duration to 365 days. Source writer has no maximum
 * rental duration; this bound is a new contract safeguard, not a deployed claim.
 * Caller supplies authoritative tenantTimezone and request clock when validating writes.
 */
export function validateRentalWindow(value: { pickup_at: string; return_at: string; timezone: string }, context: { now?: number; tenantTimezone?: string; maxDurationDays?: number } = {}): ValidationResult {
  const start = parseTimestamp(value.pickup_at), end = parseTimestamp(value.return_at);
  if (!start || !end || !validTimezone(value.timezone) || (context.tenantTimezone !== undefined && context.tenantTimezone !== value.timezone)) return { ok: false, issues: ['$.timezone'] };
  if (zonedWall(start.instant, value.timezone) !== start.wall || zonedWall(end.instant, value.timezone) !== end.wall) return { ok: false, issues: ['$.pickup_at', '$.return_at'] };
  if (end.instant <= start.instant || end.instant - start.instant > (context.maxDurationDays ?? 365) * 86400000 || (context.now !== undefined && start.instant < context.now)) return { ok: false, issues: ['$.pickup_at', '$.return_at'] };
  return { ok: true };
}
export function validateContract(name: ContractName, value: unknown, context: { now?: number; tenantTimezone?: string } = {}): ValidationResult {
  const issues = schemaIssues(schemas[name], value);
  if (issues.length) return { ok: false, issues };
  if (isObject(value)) {
    if (['AvailabilityRequest', 'AvailabilityResult', 'QuoteRequest', 'QuoteResult'].includes(name) || (name === 'VehiclesQuery' && ('pickup_at' in value || 'return_at' in value || 'timezone' in value))) {
      if (!['pickup_at', 'return_at', 'timezone'].every((key) => typeof value[key] === 'string')) issues.push('$.pickup_at', '$.return_at', '$.timezone');
      else {
        const result = validateRentalWindow(value as { pickup_at: string; return_at: string; timezone: string }, context);
        if (result.ok === false) issues.push(...result.issues);
      }
    }
    if (name === 'QuoteResult') {
      const item = value.itemization as Record<string, number | boolean>;
      const operator = BigInt(item.rental_subtotal_cents as number) + (item.operator_tax_inclusive ? 0n : BigInt(item.operator_tax_cents as number));
      const exotiq = ['platform_fee_cents', 'protection_total_cents', 'state_fee_cents', 'processing_fee_cents'].reduce((sum, key) => sum + BigInt(item[key] as number), 0n);
      if (operator !== BigInt(value.operator_total_cents as number) || exotiq !== BigInt(value.exotiq_total_cents as number) || operator + exotiq !== BigInt(value.total_cents as number) || (item.operator_tax_inclusive && (item.operator_tax_cents as number) > (item.rental_subtotal_cents as number))) issues.push('$.itemization');
      const schedule = value.payment_schedule as { payee: string; amount_cents: number; due: string }[];
      if (schedule.filter((leg) => leg.payee === 'operator' && BigInt(leg.amount_cents) === operator && leg.due === 'after_operator_approval').length !== 1 || schedule.filter((leg) => leg.payee === 'exotiq' && BigInt(leg.amount_cents) === exotiq && leg.due === 'after_operator_charge').length !== 1) issues.push('$.payment_schedule');
      if ((value.principal_scope as JsonObject).operator_id !== value.operator_id) issues.push('$.principal_scope');
      const checked = Date.parse(value.source_checked_at as string), expires = Date.parse(value.expires_at as string), available = Date.parse(value.availability_checked_at as string);
      if (expires <= checked || available > checked || (context.now !== undefined && expires <= context.now)) issues.push('$.expires_at');
    }
    if (name === 'ConsentResult' && (value.state === 'authorized' ? !value.consent_receipt_id || !value.expires_at : value.consent_receipt_id !== undefined || value.expires_at !== undefined)) issues.push('$.state');
  }
  return issues.length ? { ok: false, issues } : { ok: true };
}
export function validateIdempotencyKey(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{16,128}$/.test(value); }

type CursorContext = { operation: string; filters: Record<string, unknown>; now: number };
type CursorPosition = { after: string; expires_at: number };
const encoder = new TextEncoder();
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return JSON.stringify(value.map((item) => JSON.parse(stableJson(item))));
  if (isObject(value)) return JSON.stringify(Object.fromEntries(Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => [key, JSON.parse(stableJson(value[key]))])));
  return JSON.stringify(value);
}
function base64url(bytes: Uint8Array): string { return btoa(String.fromCharCode(...bytes)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_'); }
function decode64(value: string): Uint8Array {
  const decoded = Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  if (base64url(decoded) !== value) throw new Error('Invalid cursor');
  return decoded;
}
async function cursorKey(secret: Uint8Array): Promise<CryptoKey> {
  if (secret.byteLength < 32) throw new Error('Cursor signing key must contain at least 32 bytes');
  return crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
/** Opaque authenticated cursors contain no customer data. Routes must supply normalized
 * allowlisted query filters and repeat operator visibility checks on every page.
 */
export async function bindCursor(position: CursorPosition, context: CursorContext, secret: Uint8Array): Promise<string> {
  if (!uuidPattern.test(position.after) || !Number.isSafeInteger(position.expires_at) || position.expires_at <= context.now || position.expires_at - context.now > 3600000) throw new Error('Invalid cursor');
  const payload = base64url(encoder.encode(stableJson({ v: 1, operation: context.operation, filters: context.filters, ...position })));
  const signature = base64url(new Uint8Array(await crypto.subtle.sign('HMAC', await cursorKey(secret), encoder.encode(payload))));
  const token = `${payload}.${signature}`;
  if (token.length > 2048) throw new Error('Invalid cursor');
  return token;
}
export async function verifyCursor(token: string, context: CursorContext, secret: Uint8Array): Promise<CursorPosition> {
  try {
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 2048) throw new Error();
    const [payload, signature] = token.split('.');
    if (!(await crypto.subtle.verify('HMAC', await cursorKey(secret), decode64(signature), encoder.encode(payload)))) throw new Error();
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(decode64(payload)));
    if (!isObject(data) || data.v !== 1 || data.operation !== context.operation || stableJson(data.filters) !== stableJson(context.filters) || !uuidPattern.test(String(data.after)) || !Number.isSafeInteger(data.expires_at) || (data.expires_at as number) <= context.now || (data.expires_at as number) - context.now > 3600000 || Object.keys(data).length !== 5) throw new Error();
    return { after: data.after as string, expires_at: data.expires_at as number };
  } catch { throw new Error('Invalid cursor'); }
}

type ResponseSpec = { description: string; content?: Record<string, { schema: { $ref: string } }>; headers?: Record<string, unknown> };
type OperationSpec = { operationId: string; description: string; security: Record<string, string[]>[]; parameters: { name: string; in: string; required: boolean; schema: JsonSchema }[]; responses: Record<string, ResponseSpec>; requestBody?: unknown };
const response = (name: ContractName, description: string): ResponseSpec => ({ description, content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } } });
const allErrors = (): Record<string, ResponseSpec> => Object.fromEntries([400, 401, 403, 404, 409, 410, 429, 503].map((status) => [status, { ...response('ApiError', `Structured error (${status}); no private booking existence or exception disclosure.`), ...(status === 401 ? { headers: { 'WWW-Authenticate': { schema: { type: 'string', maxLength: 500 }, description: 'Bearer challenge; never echoes credentials.' } } } : {}), ...(status === 429 || status === 503 ? { headers: { 'Retry-After': { schema: integer(3600, 1) } } } : {}) }]));
function operation(id: string, output: ContractName, scopes: string[], description: string, input?: ContractName, query?: ContractName): OperationSpec {
  const parameters = query ? Object.entries(schemas[query].properties ?? {}).map(([name, schema]) => ({ name, in: 'query', required: schemas[query].required?.includes(name) ?? false, schema })) : [];
  return { operationId: id, description, security: scopes.length ? [{ customerOAuth: scopes }] : [{}, { customerOAuth: ['catalog:read'] }], parameters, responses: { '200': response(output, 'Successful authoritative response'), ...allErrors() }, ...(input ? { requestBody: { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${input}` } } } } } : {}) };
}
/** Generator only; deployment supplies verified issuer/redirects and approved server.
 * No server URL is inferred from production or demo hosts. These relative OAuth
 * paths are the contract's mounted authorization endpoints, not provider evidence.
 */
export function generateOpenApi() {
  const requests = operation('submitRentalRequest', 'RentalRequestResult', ['rental_requests:create'], 'Authenticated customer and matching one-use consent receipt required. First creation returns 201; same principal/idempotency key and identical intent returns original result with 200. Request is pending approval, never confirmation.', 'RentalRequestInput');
  requests.parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { ...text(128, 16), pattern: '^[A-Za-z0-9_-]+$' } });
  requests.responses['201'] = response('RentalRequestResult', 'First durable request creation');
  const quote = operation('createQuote', 'QuoteResult', ['quotes:create'], 'Persist server-calculated principal-bound quote; creates no inventory hold. Recheck visibility, availability and options. Customer reviews itemized charges/terms in consent_url. Missing authoritative prerequisites return 503.', 'QuoteRequest');
  delete quote.responses['200']; quote.responses['201'] = response('QuoteResult', 'Persisted expiring quote');
  const status = operation('getRentalRequest', 'RentalStatusResult', ['rental_requests:read'], 'Revalidate customer/operator/booking/action grant scope, expiry and revocation on every read. Hidden, missing and wrong-customer refs have identical 404. Browser payment redirect is never confirmation; status may report reconciliation pending.');
  const refParameter = { name: 'ref', in: 'path', required: true, schema: RentalRequestResult.properties!.ref };
  status.parameters.push(refParameter, { name: 'If-None-Match', in: 'header', required: false, schema: text(128) });
  status.responses['200'].headers = { ETag: { schema: text(128) }, 'Cache-Control': { schema: { const: 'private, no-cache' } } };
  status.responses['304'] = { description: 'Unchanged authorized resource; no body. Authorization/grant checks still run before conditional response.' };
  const handoff = operation('createCheckoutHandoff', 'CheckoutHandoffResult', ['checkout:handoff'], 'Require customer/booking/action grant, operator-approved pending_payment, valid identity and unexpired payment window. Partial payment never creates another operator charge. HTTPS scoped opaque nonce resolves in authenticated customer browser; legacy booking token remains backend.', undefined);
  handoff.parameters.push(refParameter);
  return {
    openapi: '3.1.2', jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
    info: { title: 'Exotiq External Booking API', version: '1.0.0', description: 'Generated canonical v1 contract. Implementation and staging/provider proof remain rollout gates. No authority, ranking, onboarding or rental eligibility is guaranteed. Operator approval and hosted customer payment remain mandatory.' },
    'x-generated-by': 'supabase/functions/_shared/external-booking/contracts.ts',
    paths: {
      '/v1/operators': { get: operation('listOperators', 'OperatorsPage', [], 'Only opted-in, eligible public operators. Anonymous reads are allowed only under the existing visibility/browse policy; no incidental tenant exposure.', undefined, 'OperatorsQuery') },
      '/v1/vehicles': { get: operation('listVehicles', 'VehiclesPage', [], 'Bounded eligible vehicle catalog. Optional dates filter discovery only; listing never promises availability. Cursor binds operation and normalized filters; repeat current visibility checks on every page.', undefined, 'VehiclesQuery') },
      '/v1/availability': { post: operation('checkAvailability', 'AvailabilityResult', [], 'Exact offset/tenant-timezone interval check. AVAILABLE is a checked observation, never a hold. UNKNOWN returns 200 with bounded retry delay and safe reason; quote/write prerequisites fail with 503.', 'AvailabilityRequest') },
      '/v1/quotes': { post: quote },
      '/v1/rental-requests': { post: requests },
      '/v1/rental-requests/{ref}': { get: status },
      '/v1/rental-requests/{ref}/checkout-handoff': { post: handoff },
    },
    components: { schemas, securitySchemes: { customerOAuth: { type: 'oauth2', description: 'Audience-bound verified customer OAuth. OAuth scope alone never establishes per-booking authorization or consent. Issuer/two-client compatibility requires implementation evidence.', flows: { authorizationCode: { authorizationUrl: '/oauth/authorize', tokenUrl: '/oauth/token', scopes: Object.fromEntries(SCOPES.map((scope) => [scope, scope])) } } } } },
  };
}
