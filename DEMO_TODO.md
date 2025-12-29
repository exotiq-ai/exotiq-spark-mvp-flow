# Demo Data Enhancement - TODO & Issues

## Status: In Progress
**Demo User ID:** `99d902d4-5878-4b59-a108-142bafb1c862`
**Current Date for Demo:** December 29, 2025

---

## Completed ✅

### Phase 0: Multi-Location Support
- [x] Added `location` column to vehicles table
- [x] Created index for efficient location filtering
- [x] Defaulted all existing vehicles to 'Miami'

### Phase 1: Vehicle Utilization & Rates Updated
- [x] Updated all 50 Miami vehicles with realistic utilization rates
- [x] Set `suggested_rate` variance for AI pricing demos
- [x] Utilization tiers applied:
  - Hypercars (AMG One, Jesko, Valkyrie, etc.): 40-55%
  - Core supercars (Ferraris, Lambos, McLarens): 75-85%
  - Luxury sedans (Rolls, Bentley, Maybach): 60-75%
  - Sports luxury (Porsche, Audi, BMW): 65-80%

### Phase 2: Scottsdale Fleet Added
- [x] Added 15 vehicles to Scottsdale location
- [x] Mix of hypercars, supercars, luxury sedans, sports luxury

### Phase 3: Customer Variety
- [x] Added 20+ new diverse customers
- [x] VIPs, corporate, weekend warriors, first-timers
- [x] Both Miami and Scottsdale markets represented

---

## Completed in This Session ✅

### Phase 4: Comprehensive Booking History
- [x] Art Basel bookings (Dec 1-8, 2025) - 30-40% premium - 7 bookings added
- [x] Christmas week (Dec 20-26) - 40-50% premium - 6 bookings added
- [x] NYE Week (Dec 27-Jan 2) - 50% premium - 13 bookings added (10 active, 3 pending)
- [x] January 2026 future bookings - 3 bookings added
- [x] Scottsdale current bookings (NYE) - 3 bookings added
- [x] Super Bowl LX week (Feb 5-12, 2026) - 50% premium - 4 bookings added

### Total New Bookings: ~36 added this session

---

## Remaining TODO 📋

### Phase 5: Payment Records (NOT YET DONE)
- [ ] Add payment records for all new bookings
- [ ] Mix of payment methods (card, wire, crypto for VIPs)
- [ ] Security deposits ($2,000-$10,000)
- [ ] Various payment statuses

### Phase 6: Vehicle Images for Scottsdale
- [ ] Update image_url for Scottsdale fleet vehicles

---

## Issues to Address ⚠️

### 1. Booking Status Constraint
**Issue:** `status` column has CHECK constraint limiting values
**Valid values:** Need to verify - likely 'pending', 'confirmed', 'active', 'completed', 'cancelled'
**Action:** Use only valid status values in inserts

### 2. Vehicle Image URLs for Scottsdale
**Issue:** Scottsdale vehicles need image_url mappings
**Current:** Using same makes/models as Miami, can share image assets
**Action:** Update image_url field for Scottsdale vehicles

### 3. Demo Login Flow
**Issue:** Need to verify demo login correctly accesses hello@exotiq.ai data
**Action:** Test demo login flow after data population

### 4. Booking Calendar Visibility
**Priority vehicles for calendar demos:**
- Bugatti Chiron Sport
- Lamborghini Sián FKP 37
- McLaren Speedtail
- Ferrari Daytona SP3
**Action:** Ensure these have current/upcoming bookings visible

### 5. Payment Status Sync
**Issue:** Booking `payment_status` must match actual payment records
**Action:** Keep consistent when adding payment records

---

## Vehicle IDs Reference (Miami)

### Hypercars (for premium bookings)
- Mercedes-AMG One: `b72ac0b9-2aa1-445e-b9b7-c1ad6fddc7fd`
- Koenigsegg Jesko: `de8e8cdc-6000-4938-8b94-6079bf9e3e6e`
- Aston Martin Valkyrie: `e1b3bdef-92b9-4015-83fd-ca23b310cac2`
- Pagani Huayra: `60bbb3ed-8f4e-4e4f-ae51-3a34e3a43c37`
- Rimac Nevera: `fdffb1ad-c5f6-48c8-811b-d3b1c90a9fb5`
- Bugatti Chiron Sport: `cd6bf72c-97f3-412e-a9f2-7dcad918e292`

### Popular Supercars (high utilization)
- Ferrari 488 GTB: `3366954a-0231-429f-a707-1990344618f8`
- Lamborghini Huracán EVO: `f9a74ebb-f2d4-40ed-abbf-cc80ce1d9952`
- Ferrari SF90 Stradale: `0dd4f240-0457-465f-985e-e575a7d8a9fb`
- McLaren 720S Spider: `a310e0e3-d2d7-4b2c-93b2-9f8cf09ffc6e`

---

## Customer IDs Reference

### VIP Customers
- Marcus Wellington III: `a5470806-c9ad-4a25-8adf-dc987a839df5`
- Sophia Blackwood: `89aefdee-9533-4a81-8d43-014d616f961a`
- James Rivera: `9185b7ea-4c4f-4c56-9108-bc31c8327158`
- David Chen: `ea954982-dfbc-4430-aa64-5604d234369b`

### Corporate Accounts
- Elena Castellano: `7d00b0f5-0c88-4cc3-bd38-249c071317d8`
- Ryan O'Sullivan: `0b610f70-5008-442d-a3ab-69465918e75f`
- Amanda Sterling: `d5d66d2f-cda0-4c06-9e72-9f17f0902d3e`

---

## Next Steps

1. Add peak season bookings with surge pricing
2. Add Scottsdale bookings (including Super Bowl week)
3. Add payment records for new bookings
4. Update Scottsdale vehicle images
5. Verify demo login flow
6. Test AI pricing recommendations display

---

## Notes

- Demo "today" date: December 29, 2025
- Peak seasons to highlight:
  - Art Basel: Dec 1-8, 2025 (just passed)
  - NYE: Dec 28, 2025 - Jan 2, 2026 (current peak!)
  - Super Bowl LX: Feb 8, 2026 (Phoenix/Scottsdale)
  - Miami Grand Prix: May 2-4, 2026
