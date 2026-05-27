# Setting Up Stripe Connect — Customer Guide

**For:** Exotiq Command Center Tenants (Fleet Owners/Managers)  
**Purpose:** Accept card payments, process security deposit holds, and receive payouts through Stripe

---

## What Is Stripe Connect?

Stripe Connect lets you accept card payments from your rental customers directly through Exotiq. When a customer pays, the money goes to **your own Stripe account** and is deposited into **your bank account** on your schedule.

You maintain full control over:
- Your bank account and payout schedule
- Your transaction history
- Tax documents (1099s)
- Dispute management

---

## Before You Begin

You will need:

- An active Exotiq Command Center subscription
- Owner or Admin role on your team
- Your business information (legal name, EIN or SSN, address)
- A bank account for receiving payouts
- A government-issued ID for identity verification

### Setting Up Your Stripe Account First

If you don't already have a Stripe account, Exotiq will create a **Stripe Express** account for you during the connection process. Stripe Express is a simplified account type designed specifically for platforms like Exotiq.

If you'd like to learn more about Stripe before connecting, here are helpful resources from Stripe:

- [What is Stripe?](https://stripe.com/resources/more/what-is-stripe) — Overview of how Stripe works
- [Stripe Express Account FAQ](https://support.stripe.com/topics/express-accounts) — Common questions about Express accounts
- [Stripe's Identity Verification](https://support.stripe.com/questions/common-questions-about-identity-verification) — What documents you'll need
- [Understanding Payouts](https://support.stripe.com/questions/understanding-payouts) — How and when you get paid

---

## Step-by-Step Setup

### Step 1: Navigate to Payment Settings

1. Log in to your Exotiq Command Center
2. Click **Settings** in the sidebar (gear icon)
3. Select the **Payments** tab

You'll see a card labeled **"Payment Processing"** with a button to connect your Stripe account.

### Step 2: Start the Connection

1. Click **"Connect Stripe Account"**
2. A new browser tab will open with Stripe's onboarding form

### Step 3: Complete Stripe Onboarding

Stripe will walk you through the following (typically takes 5-10 minutes):

**Business Information**
- Business type (sole proprietor, LLC, corporation, etc.)
- Legal business name
- Business address
- Industry (select "Vehicle rental" or similar)
- EIN or Tax ID (for businesses) or SSN (for sole proprietors)

**Personal Information**
- Your legal name
- Date of birth
- Last 4 digits of SSN (for identity verification)
- Phone number

**Bank Account**
- Routing number
- Account number
- Account type (checking or savings)

**Identity Verification**
- Upload a photo of a government-issued ID (driver's license, passport, etc.)
- Stripe may require a selfie for additional verification

### Step 4: Return to Exotiq

After completing the Stripe form:

1. You'll be redirected back to Exotiq (or you can close the Stripe tab)
2. Return to **Settings → Payments**
3. Your status should now show **"Active"** with green checkmarks for:
   - Card Payments: Enabled
   - Payouts: Enabled

**If your status shows "Onboarding" instead of "Active":**
- Stripe may still be reviewing your information (usually instant, but can take up to 24 hours)
- Click **"Refresh Status"** to check for updates
- If prompted, click **"Continue Setup"** to provide any missing information

---

## After Setup

### Accepting Payments

Once connected, you can:
- Process card payments for bookings using the "Record Payment" button
- Place security deposit holds on customer cards
- Issue refunds directly from Exotiq

### Viewing Your Stripe Dashboard

1. Go to **Settings → Payments**
2. Click **"View Stripe Dashboard"**
3. A new tab opens where you can see:
   - Your balance (available and pending)
   - Payout schedule and history
   - Individual transaction details
   - Tax documents (1099-K)

### Understanding Payouts

- Payouts go to the bank account you provided during setup
- Default schedule: Stripe sends payouts daily (2-day rolling window)
- You can change your payout schedule in the Stripe Dashboard
- Minimum payout: $0.01 (no minimum hold)

### Understanding Fees

| Fee Type | Amount | When It Applies |
|----------|--------|-----------------|
| Stripe processing | 2.9% + $0.30 per transaction | Every card payment |
| Exotiq marketplace fee | 20% of transaction | Only for bookings acquired through the Exotiq marketplace |
| Direct booking fee | $0 | Bookings from your own customers — you keep 100% (minus Stripe processing) |

---

## Managing Security Deposits

### How Holds Work

Security deposit holds **authorize** an amount on the customer's card without charging them. The funds are "frozen" on their card for up to 7 days.

- **Full release:** If no damage, release the hold. Customer is never charged.
- **Full capture:** If damage occurs, capture the full deposit amount.
- **Partial capture:** Deduct only the damage cost. The remainder is automatically released.

### Important: 7-Day Window

Authorization holds expire after **7 days**. You must capture or release within this window. After 7 days, the hold is automatically released by Stripe.

---

## Troubleshooting

### "Your Stripe account is not yet enabled for charges"

**Cause:** Onboarding is incomplete.  
**Fix:** Go to Settings → Payments → click "Continue Setup" and complete any remaining steps.

### "No Stripe account connected"

**Cause:** You haven't started the connection process.  
**Fix:** Click "Connect Stripe Account" in Settings → Payments.

### Status stuck on "Onboarding"

**Cause:** Stripe is still verifying your information.  
**What to do:**
1. Click "Refresh Status" to check for updates
2. Check your email for messages from Stripe requesting additional information
3. If it's been more than 24 hours, click "Continue Setup" to see if there are incomplete steps
4. Contact Exotiq support if issues persist

### Account shows "Restricted"

**Cause:** Stripe has flagged your account for additional verification or compliance review.  
**What to do:**
1. Click "View Dashboard" to see Stripe's requirements
2. Provide any requested documents or information directly in the Stripe Dashboard
3. Once resolved, click "Refresh Status" in Exotiq

### I need to change my bank account

This is managed directly through your Stripe Express Dashboard:
1. Go to Settings → Payments → "View Stripe Dashboard"
2. Navigate to the banking section
3. Update your bank account information

### I need to update my business information

Same as above — all account details are managed through your Stripe Dashboard.

---

## Frequently Asked Questions

**Q: Do I need an existing Stripe account?**  
A: No. Exotiq creates a Stripe Express account for you automatically. Just click "Connect Stripe Account" and follow the steps.

**Q: Is there a monthly fee for Stripe?**  
A: No monthly fee. You only pay per-transaction processing fees (2.9% + $0.30).

**Q: How fast do I get my money?**  
A: Standard payouts arrive in 2 business days. You can adjust this in your Stripe Dashboard.

**Q: Can I use my existing Stripe account?**  
A: The current integration creates a new Stripe Express account linked to Exotiq. If you have a standalone Stripe account, the Express account is separate.

**Q: What if a customer disputes a payment?**  
A: You'll receive a notification in Exotiq. Disputes are managed through your Stripe Dashboard where you can submit evidence.

**Q: Can multiple team members access Stripe settings?**  
A: Only team Owners and Admins can initiate or manage the Stripe connection. All active team members can process payments and view the Stripe Dashboard.

**Q: Is my data secure?**  
A: Yes. Exotiq never sees or stores your bank account details. All sensitive financial data is handled directly by Stripe, which is PCI DSS Level 1 certified.

---

## Need Help?

- **Stripe Support:** [support.stripe.com](https://support.stripe.com) — for account verification, banking, or payout issues
- **Exotiq Support:** Contact us through the Command Center for integration-specific questions
- **Stripe Status:** [status.stripe.com](https://status.stripe.com) — check if Stripe is experiencing issues
