/**
 * Stripe live-mode pre-flight / cutover helper.
 *
 * Read-only by default. Pass --apply to create any missing webhook endpoints
 * (it prints the signing secrets once — copy them straight into the project
 * secrets; they are never stored by this script).
 *
 * Usage:
 *   STRIPE_LIVE_KEY=sk_live_xxx bun scripts/stripe/live-preflight.ts
 *   STRIPE_LIVE_KEY=sk_live_xxx bun scripts/stripe/live-preflight.ts --apply
 *
 * The key is read from the environment only — never commit it, never paste it
 * into chat.
 */

const KEY = process.env.STRIPE_LIVE_KEY ?? "";
const APPLY = process.argv.includes("--apply");

const FUNCTIONS_BASE = "https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1";

// Subscription objects hardcoded in create-checkout-session / switch-subscription.
const PRICE_IDS = [
  ["Pro monthly  $39/veh", "price_1Tbv4IHO7nC3pJiPH4EbyVlL"],
  ["Pro annual   $390/veh", "price_1Tbv4JHO7nC3pJiPqaBeoyAX"],
  ["Business monthly $29/veh", "price_1Tbv4KHO7nC3pJiPC5emMKgJ"],
  ["Business annual  $290/veh", "price_1Tbv4LHO7nC3pJiParUQCB7y"],
] as const;

const PRODUCT_IDS = [
  ["Pro", "prod_Ub7IM2Skj93HFS"],
  ["Business", "prod_Ub7IlYXU1diSY8"],
] as const;

const REQUIRED_ENDPOINTS: Array<{
  name: string;
  url: string;
  events: string[];
  connect: boolean;
  secretName: string;
}> = [
  // stripe-webhook is a MIXED consumer but verifies ONE signing secret, so it
  // can be fed by exactly one Stripe endpoint. A Stripe endpoint delivers
  // either platform events or connected-account events, never both:
  //   - platform side: customer.subscription.* / invoice.* (Command Center
  //     billing), charge.* for renter destination charges (rent-checkout uses
  //     on_behalf_of + transfer_data, so the charge lives on the platform),
  //     payout.paid for Exotiq's own bank payouts (handler's null-team path).
  //   - connected side: account.updated onboarding flips, deauthorization,
  //     operator payouts, and charge.captured/succeeded for the manual hold
  //     flow (stripe-create-hold charges directly on the connected account).
  // The platform half carries subscriptions and renter money bookkeeping, so
  // it wins the single secret. The connected half needs a second endpoint +
  // a STRIPE_CONNECT_WEBHOOK_SECRET fallback in the function's signature
  // check before it can exist without permanently failing deliveries —
  // do NOT create it until that patch ships.
  {
    name: "platform / subscriptions + charges",
    url: `${FUNCTIONS_BASE}/stripe-webhook`,
    events: [
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "invoice.payment_failed",
      "charge.refunded",
      "charge.dispute.created",
      // succeeded logs the Stripe processing fee on renter destination charges.
      "charge.succeeded",
      "payout.paid",
    ],
    connect: false,
    secretName: "STRIPE_WEBHOOK_SECRET",
  },
  {
    name: "renter payments",
    url: `${FUNCTIONS_BASE}/rent-payment-webhook`,
    events: [
      "checkout.session.completed",
      "payment_intent.succeeded",
      "payment_intent.payment_failed",
    ],
    connect: false,
    secretName: "RENT_PAYMENT_WEBHOOK_SECRET",
  },
  {
    name: "identity verification",
    url: `${FUNCTIONS_BASE}/identity-webhook`,
    events: [
      "identity.verification_session.verified",
      "identity.verification_session.requires_input",
      "identity.verification_session.canceled",
      // identity-webhook handles all five; redacted is the PII-cleanup path
      // (clears verified_name) and must be subscribed or redaction never
      // reaches the database.
      "identity.verification_session.processing",
      "identity.verification_session.redacted",
    ],
    connect: false,
    secretName: "STRIPE_IDENTITY_WEBHOOK_SECRET",
  },
];

let failures = 0;
const ok = (m: string) => console.log(`  PASS  ${m}`);
const bad = (m: string) => {
  failures++;
  console.log(`  FAIL  ${m}`);
};
const warn = (m: string) => console.log(`  WARN  ${m}`);

async function stripe(path: string, init?: RequestInit) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json();
  return { res, body } as { res: Response; body: any };
}

function form(obj: Record<string, string | string[] | boolean>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((x, i) => p.append(`${k}[${i}]`, x));
    else p.append(k, String(v));
  }
  return p.toString();
}

async function main() {
  if (!/^(sk|rk)_live_/.test(KEY)) {
    console.error("STRIPE_LIVE_KEY must be a sk_live_ or rk_live_ key. Aborting.");
    process.exit(2);
  }

  console.log("\n== Account ==");
  const { body: acct } = await stripe("account");
  if (acct.error) {
    console.error("  FAIL  key rejected:", acct.error.message);
    process.exit(2);
  }
  ok(`live account ${acct.id} (${acct.business_profile?.name ?? acct.settings?.dashboard?.display_name ?? "unnamed"})`);
  if (acct.charges_enabled) ok("charges enabled"); else bad("charges NOT enabled on the platform account");

  console.log("\n== Subscription products & prices ==");
  for (const [label, id] of PRODUCT_IDS) {
    const { body } = await stripe(`products/${id}`);
    if (body.error) bad(`${label} product ${id} missing in live: ${body.error.message}`);
    else if (!body.active) bad(`${label} product ${id} is archived in live`);
    else ok(`${label} product ${id}`);
  }
  for (const [label, id] of PRICE_IDS) {
    const { body } = await stripe(`prices/${id}`);
    if (body.error) bad(`${label} price ${id} missing in live: ${body.error.message}`);
    else if (!body.active) bad(`${label} price ${id} is archived in live`);
    else ok(`${label} price ${id} — ${(body.unit_amount / 100).toFixed(2)} ${String(body.currency).toUpperCase()} / ${body.recurring?.interval ?? "one-time"}`);
  }

  console.log("\n== Billing customer portal ==");
  const { body: portal } = await stripe("billing_portal/configurations?limit=5");
  const activePortal = (portal.data ?? []).find((c: any) => c.active);
  if (activePortal) ok(`portal configuration ${activePortal.id} active`);
  else bad("no active customer portal configuration — customer-portal will fail");

  console.log("\n== Connect ==");
  const { body: accts } = await stripe("accounts?limit=3");
  if (accts.error) bad(`cannot list connected accounts: ${accts.error.message}`);
  else ok(`Connect reachable — ${accts.data.length} connected account(s) visible`);

  console.log("\n== Webhook endpoints ==");
  const { body: eps } = await stripe("webhook_endpoints?limit=100");
  const existing: any[] = eps.data ?? [];
  for (const want of REQUIRED_ENDPOINTS) {
    const found = existing.find((e) => e.url === want.url && e.status === "enabled");
    if (found) {
      const missing = want.events.filter((ev) => !(found.enabled_events ?? []).includes(ev) && !(found.enabled_events ?? []).includes("*"));
      if (missing.length) bad(`${want.name}: endpoint exists but missing events → ${missing.join(", ")}`);
      else ok(`${want.name}: ${found.id}`);
      if (want.connect && !found.connect) bad(`${want.name}: endpoint is NOT listening on connected accounts`);
      warn(`${want.name}: signing secret not readable after creation — if ${want.secretName} is unset, delete + recreate with --apply`);
      continue;
    }
    if (!APPLY) {
      bad(`${want.name}: endpoint missing (${want.url}) — rerun with --apply to create`);
      continue;
    }
    const { body: created } = await stripe("webhook_endpoints", {
      method: "POST",
      body: form({
        url: want.url,
        enabled_events: [...want.events],
        ...(want.connect ? { connect: true } : {}),
        description: `Exotiq ${want.name} (live)`,
      }),
    });
    if (created.error) bad(`${want.name}: create failed — ${created.error.message}`);
    else {
      ok(`${want.name}: created ${created.id}`);
      console.log(`        SET ${want.secretName} = ${created.secret}`);
    }
  }

  console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}\n`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
