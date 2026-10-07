# Renter MCP compatibility and operating requirements

The adapter exposes six tools through the official Streamable HTTP transport. It forwards authoritative API results and has no database access, pricing engine, approval action, card input, document upload or payment executor. Source cents, deposit disclosures, terms, UNKNOWN availability and pending states remain unchanged. Tool descriptions and annotations cannot grant authority.

| Tool | OAuth scope | Effects |
| --- | --- | --- |
| `search_vehicles` | `catalog:read` | Read; availability still requires a separate check |
| `check_availability` | `catalog:read` | Read; no inventory hold |
| `create_quote` | `quotes:create` | Persists a quote; no hold; not idempotent |
| `submit_rental_request` | `rental_requests:create` | Requires quote and stable idempotency key; consent receipt obtained server-side |
| `get_request_status` | `rental_requests:read` | Reads current owned request; may start customer grant recovery; consequential and not advertised as idempotent |
| `create_checkout_handoff` | `checkout:handoff` | Creates hosted customer handoff; not advertised as idempotent |

Existing-request recovery also requires `rental_requests:read`. A verified token missing the selected tool scope receives HTTP403 with `WWW-Authenticate: Bearer … error="insufficient_scope"`. Invalid, expired, revoked, wrong-resource and client-substituted tokens receive401. JSON batches are refused before SDK dispatch. Discovery is available at the configured protected-resource metadata path; browser origins and public Host must match the configured allowlists.

Each authenticated request verifies an asymmetric `at+jwt` signature using a fixed HTTPS JWKS endpoint, issuer, exact MCP audience, original consumer `client_id`, bounded claims and a maximum600second lifetime. Fresh provider metadata must match the configured JWKS, introspection and token endpoints and declare S256, token exchange and client-secret-basic support. Fresh introspection must bind active status, issuer, subject, client ID, audience, token ID, expiration and scopes. Provider URLs in JWT headers, claims or operator text never select a destination.

The adapter then performs RFC8693 token exchange for the independently configured API resource. It verifies the new token's signature, issuer, subject, audience and original consumer client ID before using it. An authorization server that replaces the original consumer `client_id` with the adapter client ID is incompatible with this configuration. The MCP bearer is never sent to the API. Requests use fixed allowlisted endpoints, refuse redirects, cap response bytes and deadlines, and never log credentials or upstream response bodies.

Premature inbound disconnect cancels active provider/API HTTP egress and prevents starting subsequent calls, including a request write after the consent read. Request-scoped JWKS resolution lets a caller cancel its own key fetch without cancelling another principal's authentication; keys are reused for the two token verifications within that request. Cancellation cannot undo an API transaction that already committed. An uncertain submission must retry the original idempotency key and reconcile the authoritative result.

For submission, the input contains only `quote_id` and `idempotency_key` (16–128 ASCII letters, numbers, dots, underscores, colons or hyphens, checked by the canonical validator without normalization). The adapter makes one authenticated consent-result read per tool call. Waiting202 returns `awaiting_customer_consent`, the fixed `/agent/consent/{quote_id}` customer URL, expiry and a five-second retry hint; it makes no rental-request write. Customer consent must occur through the hosted browser flow. An authorized receipt remains server-side and is sent only to the request API. Retrying uses the same key; durable replay and receipt-consumption authority remain in the API/database. No receipt or grant belongs in a tool argument, response, prompt or clipboard.

Expired or revoked current grants initiate ref-based hosted renewal with an empty API body. The customer must explicitly authorize a new delegation after revocation. When a previously created renewal reports authorized, the adapter checks its authenticated rendezvous and retries the original API operation once. It does not recreate bookings, extend inventory holds or create a new payment charge. Waiting recovery returns only the customer URL and expiry. A valid onboarding `Link` is returned only for the configured customer origin and `/agent/account/{operator_id}` path.

Customer-facing private URLs must use the configured customer origin and exact owned paths: `/agent/consent/{quote_id}`, `/agent/authorization/{renewal_id}`, `/agent/account/{operator_id}`, or `/agent/handoff/{43-character opaque nonce}`. Every query parameter and fragment is rejected, including encoded credential names. Status links must use the configured API resource/base prefix and the matching request ref; identity/checkout links are restricted to their exact API actions or owned customer handoff. Generic HTTPS schema validation alone does not establish this authority. Public vehicle/storefront URLs remain ordinary validated catalog data.

The runtime is a loopback Node HTTP listener behind trusted TLS ingress. Build with `npm --prefix packages/renter-mcp run build`; run the compiled entry with `npm --prefix packages/renter-mcp start`. Missing or unsafe configuration exits with a fixed error and opens no listener. The listener binds127.0.0.1, validates the configured public Host, ignores forwarded-origin headers, limits request bodies to64KiB, bounds connections and rejects duplicate Host/Authorization headers. The gateway must preserve the public Host and prevent untrusted direct loopback access.

Configuration is supplied through the deployment secret/configuration manager; no environment file is generated by the build:

| Setting | Meaning |
| --- | --- |
| `EXOTIQ_MCP_ENABLED` | Explicit `true`; absent means unavailable |
| `EXOTIQ_MCP_GATEWAY_PROFILE` | `distributed-limit-tls-v1`; operator attestation, not automatic deployment verification |
| `EXOTIQ_MCP_RESOURCE`, `EXOTIQ_API_RESOURCE` | Distinct pinned HTTPS resource identifiers; API base path is preserved |
| `EXOTIQ_CUSTOMER_ORIGIN` | Fixed HTTPS customer browser origin |
| `EXOTIQ_MCP_RESOURCE_METADATA_URI` | Protected-resource metadata URL on MCP origin |
| `EXOTIQ_OAUTH_ISSUER`, `EXOTIQ_OAUTH_METADATA_URI` | Pinned authorization server and its metadata |
| `EXOTIQ_OAUTH_JWKS_URI`, `EXOTIQ_OAUTH_INTROSPECTION_URI`, `EXOTIQ_OAUTH_TOKEN_URI` | Fixed issuer-origin endpoints |
| `EXOTIQ_OAUTH_ALLOWED_HOSTS` | Comma-separated explicit resource/provider hosts |
| `EXOTIQ_OAUTH_CONSUMER_CLIENT_IDS` | Comma-separated registered consumer client IDs |
| `EXOTIQ_OAUTH_EXCHANGE_CLIENT_ID`, `EXOTIQ_OAUTH_EXCHANGE_CLIENT_SECRET` | Confidential adapter registration with introspection/exchange permission |
| `EXOTIQ_MCP_ALLOWED_ORIGINS` | Optional explicit HTTPS browser origins; default MCP origin only |
| `EXOTIQ_MCP_PORT` | Optional loopback port1024–65535; default8788 |

A concrete per-process budget of 60 requests/minute and eight concurrent authentication operations apply before provider network calls. A reviewed distributed gateway limiter is a **release requirement**; the configuration profile is only an attestation and cannot prove that gateway exists. Every delegated API call additionally passes the API's persisted limiter and its customer/operator/grant checks. Restarting or horizontally scaling the adapter must not be used to avoid the distributed limit. Public metadata needs the gateway's unauthenticated request limit too.

Verified locally on 2026-10-07: official server 2.3.1, official client 2.3.1, jose 6.2.3, zod 4.6.5, TypeScript 5.9.3, Vitest 4.1.11, Node 22.22.3 and Node type definitions 24.12.0. All dependency versions are locked. Vitest was patched from 4.1.6 to 4.1.11 following the [primary Vitest advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9); the exposed development mocker traversal affects versions before 4.1.11. The scoped package audit reports zero vulnerabilities after the compatible patch.

| Local profile | Registered fixture client | Protocol | Evidence |
| --- | --- | --- | --- |
| Profile A | `profile-a` | Official legacy negotiation/fallback | Actual loopback HTTP; tools/list, schemas, quotes, pending consent, UNKNOWN and denied input |
| Profile B | `profile-b` | Pinned2026-07-28 modern protocol | Actual loopback HTTP; SDK asserts modern era/version; six tools and pending consent |

The tests use real locally generated keys, signed JWTs, HTTP JWKS/introspection/exchange fixtures and the official SDK clients. The upstream API responses in these adapter tests are synthetic protocol fixtures. They prove transport, scope and projection behavior; they do not prove deployed database authority, provider registration, browser consent, OAuth authorization-code/PKCE completion, Stripe checkout or identity verification. No authorized receipt is injected into an MCP journey. Actual provider PKCE and original-client exchange compatibility remain unverified because a separate provider/staging environment has not been supplied.

Release also requires the completed09/14 runtime handoff, source/deployed schema and ACL parity, default-disabled global/operator write gates, fixed gateway deployment evidence, both payment-leg and identity sandbox acceptance, and an actual customer browser consent/recovery journey with two independent consumer configurations. The adapter makes no promise about onboarding, listing eligibility or support from every AI provider. Protocol references: [official v2 SDK](https://ts.sdk.modelcontextprotocol.io/v2/) and [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization).
