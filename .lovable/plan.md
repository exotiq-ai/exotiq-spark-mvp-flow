
# Remove Hardcoded Data from New Customer Accounts

## Problem Summary

A new customer (`denverexoticrentalcars@gmail.com`) sees fake/hardcoded data throughout their account that doesn't reflect their actual data state. The screenshots show:

1. **Subscription Section** - Fake "Professional" plan, fake billing date (Jan 23, 2025), fake "12 of 25" vehicle usage, fake payment history
2. **Compliance Chart** - Hardcoded document counts (Insurance: 12 items, Registration: 10 items, etc.)
3. **Vault Module** - Hardcoded compliance scores, fake urgent alerts

---

## Hardcoded Data Found

### 1. SubscriptionSection.tsx (Lines 39-52, 260-264)

```typescript
// HARDCODED: Fake plan data
const currentPlan = {
  name: "Professional",
  status: "active", 
  renewalDate: "2025-01-24",
  vehicleLimit: 25,
  vehiclesUsed: 12,  // ← Fake vehicle count
  features: [...]
};

// HARDCODED: Fake payment history
{[
  { date: "Dec 24, 2024", amount: 249, status: "Paid" },
  { date: "Nov 24, 2024", amount: 249, status: "Paid" },
  { date: "Oct 24, 2024", amount: 249, status: "Paid" }
].map(...)}
```

### 2. ComplianceStackedBar.tsx (Lines 9-42)

```typescript
// HARDCODED: Fake compliance data
const complianceData = [
  { category: 'Insurance', compliant: 10, expiringSoon: 2, expired: 0, total: 12 },
  { category: 'Registration', compliant: 6, expiringSoon: 3, expired: 1, total: 10 },
  { category: 'Inspections', compliant: 7, expiringSoon: 1, expired: 0, total: 8 },
  { category: 'Licenses', compliant: 4, expiringSoon: 1, expired: 1, total: 6 }
];
```

### 3. VaultEnhanced.tsx (Lines 42-62)

```typescript
// HARDCODED: Fake urgent alert
const urgentAlert = {
  title: "License Expiring Soon",
  document: "Driver License - Sarah M.",
  vehicle: "Porsche 911 GT3",
  daysLeft: 5,
};

// HARDCODED: Fake compliance score
const complianceScore = {
  percentage: 87,
  status: "good",
  itemsCompliant: 36,
  itemsTotal: 42
};

// HARDCODED: Fake category counts
const categories = [
  { name: "Insurance", status: "compliant", items: 12, expiring: 2 },
  ...
];
```

---

## Solution Plan

### Fix 1: SubscriptionSection - Use Real Stripe Data

**File:** `src/components/dashboard/settings/SubscriptionSection.tsx`

**Changes:**
1. Import `useAuth` to get real subscription state from AuthContext
2. Import `useFleet` to get real vehicle count
3. Replace hardcoded `currentPlan` with data from `subscription` context
4. Show empty state / "No subscription" for unsubscribed users
5. Remove fake payment history - either:
   - Show empty state: "No payment history yet"
   - OR fetch real invoices from Stripe via edge function (future enhancement)

**Logic:**
```typescript
const { subscription } = useAuth();
const { vehicles } = useFleet();

// Real vehicle count
const vehiclesUsed = vehicles.length;

// Map tier to vehicle limit
const tierLimits = {
  starter: 10,
  growth: 25,
  professional: 50,
  enterprise: Infinity
};
const vehicleLimit = tierLimits[subscription.tier] || 0;

// If no subscription, show different UI
if (!subscription.subscribed) {
  return <NoSubscriptionState />;
}
```

### Fix 2: ComplianceStackedBar - Use Real Documents

**File:** `src/components/charts/ComplianceStackedBar.tsx`

**Changes:**
1. Import `useLocationFilteredFleet` to get real documents
2. Calculate compliance data dynamically from actual documents
3. Show empty state when no documents exist

**Logic:**
```typescript
const { documents } = useLocationFilteredFleet();

// Calculate real compliance from documents
const complianceData = useMemo(() => {
  const categories = ['Insurance', 'Registration', 'Inspections', 'Licenses'];
  const now = new Date();
  const soonDays = 30; // Documents expiring within 30 days
  
  return categories.map(category => {
    const categoryDocs = documents.filter(d => 
      d.type?.toLowerCase().includes(category.toLowerCase())
    );
    
    const expired = categoryDocs.filter(d => 
      d.expires_at && new Date(d.expires_at) < now
    ).length;
    
    const expiringSoon = categoryDocs.filter(d => {
      if (!d.expires_at) return false;
      const expiry = new Date(d.expires_at);
      const daysUntil = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return daysUntil > 0 && daysUntil <= soonDays;
    }).length;
    
    const compliant = categoryDocs.length - expired - expiringSoon;
    
    return { category, compliant, expiringSoon, expired, total: categoryDocs.length };
  });
}, [documents]);

// If no documents, show empty state
if (documents.length === 0) {
  return <EmptyComplianceState />;
}
```

### Fix 3: VaultEnhanced - Use Real Data

**File:** `src/components/dashboard/VaultEnhanced.tsx`

**Changes:**
1. Calculate `urgentAlert` from real documents with nearest expiry
2. Calculate `complianceScore` from real document data
3. Calculate `categories` dynamically from documents
4. Only show urgent alert if there's actually an expiring document
5. Show appropriate empty states for new accounts

**Logic:**
```typescript
// Find actually expiring documents
const urgentDocs = documents
  .filter(d => d.expires_at && new Date(d.expires_at) > new Date())
  .sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime());

const urgentAlert = urgentDocs.length > 0 ? {
  title: `${urgentDocs[0].type} Expiring Soon`,
  document: urgentDocs[0].name,
  vehicle: urgentDocs[0].vehicle_id ? "Related Vehicle" : null,
  daysLeft: Math.ceil((new Date(urgentDocs[0].expires_at!).getTime() - Date.now()) / (1000*60*60*24))
} : null;

// Only render alert if urgentAlert exists
{urgentAlert && !alertDismissed && (...)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/dashboard/settings/SubscriptionSection.tsx` | Use real subscription + vehicle data, show empty states |
| `src/components/charts/ComplianceStackedBar.tsx` | Calculate from real documents, add empty state |
| `src/components/dashboard/VaultEnhanced.tsx` | Calculate alerts/scores from real documents, add empty states |

---

## Empty State Design

For new accounts with no data, show clean empty states instead of fake data:

**Subscription (no active plan):**
- "No Active Subscription"
- "Choose a plan to unlock fleet management features"
- [View Plans] button

**Compliance (no documents):**
- "No Documents Yet"
- "Upload insurance, registration, and inspection documents to track compliance"
- [Upload Document] button

**Urgent Alerts (nothing expiring):**
- Simply don't show the alert card at all

---

## Technical Details

### Data Sources Available

- **Subscription:** `useAuth().subscription` (tier, subscriptionEnd, subscribed)
- **Vehicles:** `useFleet().vehicles` or `useLocationFilteredFleet().vehicles`
- **Documents:** `useLocationFilteredFleet().documents` (has `type`, `expires_at`, `status`)

### Vehicle Limits by Tier

| Tier | Vehicle Limit |
|------|---------------|
| Starter | 10 |
| Growth | 25 |
| Professional | 50 |
| Enterprise | Unlimited |

---

## Expected Outcome

After these changes:
- New customers see accurate "No subscription" or "No documents" states
- Existing customers see their real data
- No fake demo data appears unless the account has `is_demo_account: true`
- Compliance percentages calculated from actual uploaded documents
- Payment history shows real Stripe data or appropriate empty state
