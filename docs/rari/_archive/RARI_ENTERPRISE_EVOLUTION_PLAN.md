# 🚀 RARI Enterprise Evolution Plan
## Transforming Rari into a Siri/Gemini-Style Agentic AI Assistant

**Document Version:** 1.0  
**Date:** January 8, 2026  
**Author:** AI Architecture Review  
**Status:** Strategic Roadmap

---

## 📊 Current State Assessment

### What Rari Can Do Today ✅

| Capability | Status | Implementation |
|------------|--------|----------------|
| **Voice Conversations** | ✅ Working | ElevenLabs Conversational AI |
| **Fleet Vehicle Queries** | ✅ Working | `get_fleet_vehicles`, `getVehicleDetails` |
| **Booking Management** | ✅ Working | `get_bookings`, `searchBookings`, `checkAvailability` |
| **Revenue Analysis** | ✅ Partial | `getRevenueAnalysis`, `getFleetMetrics` |
| **Location Metrics** | ✅ Working | `getLocationMetrics` (Miami vs Scottsdale) |
| **Customer Profiles** | ✅ Working | `getCustomerProfile`, `getCustomerLifetimeValue` |
| **Pricing Recommendations** | ✅ Working | `getPricingRecommendation`, `getFleetPricingOverview` |
| **Demand Forecasting** | ✅ Working | `getDemandForecast` + PredictHQ integration |
| **Peak Season Awareness** | ✅ Working | Built-in PEAK_SEASONS calendar |
| **Maintenance Tracking** | ✅ Basic | `getUpcomingMaintenance` |
| **Damage Reports** | ✅ Working | `getDamageReports` |
| **Payment Summary** | ✅ Working | `getPaymentSummary` |
| **Top Performers** | ✅ Working | `getTopPerformers` |
| **Natural Language Processing** | ✅ Working | `rari-universal-query` Edge Function |
| **Real-time Subscriptions** | ✅ Working | Supabase Realtime on all critical tables |
| **Conversation Persistence** | ✅ Working | `rari_conversations`, `rari_messages` tables |

### Architecture Strengths 💪

1. **Dual-System Architecture**
   - Supabase MCP (29 database tools)
   - Universal Query (natural language → SQL)
   
2. **Multi-Tenant Ready**
   - `user_id` filtering on all queries
   - `team_id` support in schema
   - Location-based data isolation

3. **Real-time Infrastructure**
   - All critical tables have realtime enabled
   - Toast notifications for live updates
   - Component auto-refresh on data changes

4. **Extensible Tool System**
   - `elevenlabs-tools` handles 25+ function calls
   - Easy to add new handlers
   - Feedback logging for unknown requests

---

## 🎯 Feature Priority Matrix

### TIER 1: HIGH IMPACT / LOW EFFORT (This Week)
*These can be added by extending existing handlers*

| Feature | Current Gap | Solution | Effort |
|---------|-------------|----------|--------|
| **Revenue by Vehicle (P/L)** | Only totals, no per-vehicle P/L | Add expense tracking to vehicle, calculate profit margin | 2-3 hrs |
| **Location Comparison** | Basic metrics only | Create `compareLocations` handler with side-by-side analytics | 2 hrs |
| **Outstanding Balances** | Payment status exists but not aggregated | Add `getOutstandingBalances` handler | 1 hr |
| **Idle Vehicle Alerts** | Utilization exists but no alerts | Add `getIdleVehicles` with threshold logic | 1 hr |
| **Multi-Location Availability** | Single location only | Modify `checkAvailability` to return all locations | 1 hr |

### TIER 2: HIGH IMPACT / MEDIUM EFFORT (Next 2 Weeks)
*Requires new database tables or external integrations*

| Feature | Current Gap | Solution | Effort |
|---------|-------------|----------|--------|
| **Expense Tracking** | No expense table | Create `vehicle_expenses` table + handlers | 4 hrs |
| **Profit Margin by Vehicle** | Revenue exists, costs don't | Combine revenue - expenses per vehicle | 2 hrs |
| **Proactive Insights** | Reactive only | Add scheduled analysis + push to Rari | 6 hrs |
| **Maintenance Reminders** | Schedule exists, no alerts | Add mileage/time triggers | 3 hrs |
| **Customer Segmentation** | Basic tier only | Add RFM scoring + lead tags | 4 hrs |

### TIER 3: MEDIUM IMPACT / HIGHER EFFORT (This Month)
*Significant development but transformative*

| Feature | Current Gap | Solution | Effort |
|---------|-------------|----------|--------|
| **PredictHQ Deep Integration** | Basic event fetch | Automatic pricing adjustments based on events | 8 hrs |
| **Calendar Consolidation** | No external calendars | iCal/Google Calendar sync for bookings | 6 hrs |
| **Automated Guest Onboarding** | Manual process | Workflow automation with templates | 8 hrs |
| **Advanced Booking Analytics** | Basic counts | Conversion rates, lead sources, booking patterns | 6 hrs |
| **Customer Retention Metrics** | No tracking | Churn prediction, re-engagement triggers | 6 hrs |

### TIER 4: DEFERRED (Nice to Have)
*Requires significant infrastructure or is lower priority*

| Feature | Reason for Deferral |
|---------|---------------------|
| Team Messaging Integration | Messaging feature not operational |
| ROI/Depreciation Logging | Requires accounting integration |
| Multi-Platform Scheduling | Complex external API work |

---

## 🏗️ Enterprise Schema Enhancements

### New Tables Required

```sql
-- 1. Vehicle Expenses (for P/L tracking)
CREATE TABLE vehicle_expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_id UUID REFERENCES teams(id),
  vehicle_id UUID REFERENCES vehicles(id) NOT NULL,
  expense_type VARCHAR(50) NOT NULL, -- 'fuel', 'insurance', 'maintenance', 'cleaning', 'storage', 'registration'
  amount DECIMAL(10,2) NOT NULL,
  description TEXT,
  expense_date TIMESTAMPTZ DEFAULT now(),
  recurring BOOLEAN DEFAULT false,
  recurring_interval VARCHAR(20), -- 'monthly', 'quarterly', 'yearly'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Rari Insights (Proactive AI Insights)
CREATE TABLE rari_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  team_id UUID REFERENCES teams(id),
  insight_type VARCHAR(50) NOT NULL, -- 'pricing', 'utilization', 'maintenance', 'revenue', 'customer'
  priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_items JSONB DEFAULT '[]',
  related_entity_type VARCHAR(50), -- 'vehicle', 'booking', 'customer'
  related_entity_id UUID,
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- 3. Customer Tags (for segmentation)
CREATE TABLE customer_tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  customer_id UUID REFERENCES customers(id) NOT NULL,
  tag VARCHAR(50) NOT NULL, -- 'vip', 'corporate', 'repeat', 'high_value', 'at_risk', 'new'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(customer_id, tag)
);

-- 4. Lead Sources (for ROI tracking)
CREATE TABLE lead_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  booking_id UUID REFERENCES bookings(id),
  customer_id UUID REFERENCES customers(id),
  source VARCHAR(50) NOT NULL, -- 'turo', 'getaround', 'website', 'referral', 'instagram', 'direct'
  campaign VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Scheduled Alerts (for maintenance reminders)
CREATE TABLE scheduled_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  alert_type VARCHAR(50) NOT NULL, -- 'maintenance', 'insurance_expiry', 'registration', 'inspection'
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  trigger_date TIMESTAMPTZ,
  trigger_mileage INTEGER,
  message TEXT NOT NULL,
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Database Views for Analytics

```sql
-- Vehicle Profit/Loss View
CREATE VIEW vehicle_profit_loss AS
SELECT 
  v.id as vehicle_id,
  v.user_id,
  v.name,
  v.make,
  v.model,
  v.year,
  v.location,
  COALESCE(SUM(b.total_value), 0) as total_revenue,
  COALESCE(SUM(e.amount), 0) as total_expenses,
  COALESCE(SUM(b.total_value), 0) - COALESCE(SUM(e.amount), 0) as profit,
  CASE 
    WHEN COALESCE(SUM(b.total_value), 0) > 0 
    THEN ((COALESCE(SUM(b.total_value), 0) - COALESCE(SUM(e.amount), 0)) / COALESCE(SUM(b.total_value), 0)) * 100
    ELSE 0 
  END as profit_margin_percent
FROM vehicles v
LEFT JOIN bookings b ON v.id = b.vehicle_id AND b.status IN ('completed', 'active')
LEFT JOIN vehicle_expenses e ON v.id = e.vehicle_id
GROUP BY v.id;

-- Location Comparison View
CREATE VIEW location_comparison AS
SELECT 
  v.location,
  v.user_id,
  COUNT(DISTINCT v.id) as vehicle_count,
  COUNT(DISTINCT b.id) as booking_count,
  COALESCE(SUM(b.total_value), 0) as total_revenue,
  AVG(v.utilization) as avg_utilization,
  AVG(v.current_rate) as avg_daily_rate
FROM vehicles v
LEFT JOIN bookings b ON v.id = b.vehicle_id AND b.status IN ('completed', 'active', 'confirmed')
GROUP BY v.location, v.user_id;

-- Customer RFM Scoring View
CREATE VIEW customer_rfm AS
SELECT 
  c.id as customer_id,
  c.user_id,
  c.full_name,
  c.email,
  COUNT(b.id) as frequency,
  COALESCE(SUM(b.total_value), 0) as monetary,
  MAX(b.created_at) as last_booking,
  EXTRACT(DAY FROM NOW() - MAX(b.created_at)) as days_since_last_booking,
  CASE 
    WHEN EXTRACT(DAY FROM NOW() - MAX(b.created_at)) < 30 THEN 'active'
    WHEN EXTRACT(DAY FROM NOW() - MAX(b.created_at)) < 90 THEN 'warm'
    WHEN EXTRACT(DAY FROM NOW() - MAX(b.created_at)) < 180 THEN 'cooling'
    ELSE 'at_risk'
  END as engagement_status
FROM customers c
LEFT JOIN bookings b ON c.id = b.customer_id
GROUP BY c.id;
```

---

## 🤖 New Rari Handlers to Implement

### Phase 1: Quick Wins (Add to `elevenlabs-tools/index.ts`)

```typescript
// 1. Vehicle Profit/Loss Analysis
case "getVehicleProfitLoss": {
  const { vehicleName, timeframe, location } = args;
  // Query vehicle_profit_loss view
  // Return: revenue, expenses, profit, margin
}

// 2. Compare Locations
case "compareLocations": {
  const { locations, timeframe } = args; // e.g., ['Miami', 'Scottsdale']
  // Query location_comparison view
  // Return: side-by-side metrics
}

// 3. Get Outstanding Balances
case "getOutstandingBalances": {
  const { location, minAmount } = args;
  // Query bookings where payment_status = 'pending' or balance_due > 0
  // Return: customer, vehicle, amount, days overdue
}

// 4. Get Idle Vehicles
case "getIdleVehicles": {
  const { daysIdle, location } = args;
  // Query vehicles with no bookings in X days
  // Return: vehicle list with last booking date, utilization
}

// 5. Multi-Location Availability
case "getMultiLocationAvailability": {
  const { vehicleType, startDate, endDate } = args;
  // Query all locations for matching available vehicles
  // Return: grouped by location with rates
}

// 6. Get Proactive Insights
case "getRariInsights": {
  const { priority, limit } = args;
  // Query rari_insights table for unread insights
  // Return: prioritized list of AI-generated insights
}

// 7. Customer Segmentation
case "getCustomerSegments": {
  const { segment, location } = args; // 'vip', 'at_risk', 'new', 'high_value'
  // Query customer_rfm view
  // Return: customers matching segment with metrics
}
```

### Phase 2: Advanced Handlers

```typescript
// 8. Generate Proactive Insight (called by scheduled job)
case "generateInsight": {
  // Analyze fleet data
  // Create insight in rari_insights table
  // Examples:
  // - "Ferrari SF90 has been idle for 14 days. Consider reducing rate by 10%"
  // - "Miami revenue up 25% this week. Art Basel effect detected."
  // - "3 vehicles due for maintenance in next 7 days"
}

// 9. Booking Funnel Analytics
case "getBookingFunnel": {
  const { timeframe, location } = args;
  // Calculate: inquiries → quotes → confirmed → completed
  // Return: conversion rates at each stage
}

// 10. Revenue Forecast
case "getRevenueForecast": {
  const { daysAhead, location } = args;
  // Combine: confirmed bookings + demand forecast + historical patterns
  // Return: projected revenue with confidence interval
}
```

---

## 🎤 Siri/Gemini-Style Agentic Features

### 1. Proactive Insights Engine

**Concept:** Rari doesn't just answer questions—she proactively surfaces insights.

**Implementation:**
```typescript
// Scheduled Edge Function: rari-insight-generator
// Runs every 4 hours

async function generateDailyInsights(userId: string) {
  const insights = [];
  
  // Check for idle vehicles
  const idleVehicles = await getIdleVehicles(userId, 7);
  if (idleVehicles.length > 0) {
    insights.push({
      type: 'utilization',
      priority: 'medium',
      title: `${idleVehicles.length} vehicles sitting idle`,
      description: `${idleVehicles.map(v => v.name).join(', ')} haven't been booked in 7+ days`,
      action_items: ['Consider price reduction', 'Run promotion', 'Check listing quality']
    });
  }
  
  // Check for upcoming maintenance
  const dueMaintenance = await getUpcomingMaintenance(userId, 7);
  if (dueMaintenance.length > 0) {
    insights.push({
      type: 'maintenance',
      priority: 'high',
      title: `${dueMaintenance.length} vehicles need service`,
      description: `Schedule maintenance to avoid booking conflicts`,
      action_items: dueMaintenance.map(m => `${m.vehicle}: ${m.type}`)
    });
  }
  
  // Check for revenue opportunities
  const demandForecast = await getDemandForecast(userId, 14);
  if (demandForecast.demandMultiplier > 1.2) {
    insights.push({
      type: 'pricing',
      priority: 'high',
      title: 'High demand period detected',
      description: `${demandForecast.peakSeason || 'Upcoming events'} suggest ${((demandForecast.demandMultiplier - 1) * 100).toFixed(0)}% surge`,
      action_items: ['Review pricing', 'Ensure availability', 'Prepare fleet']
    });
  }
  
  // Store insights
  await supabase.from('rari_insights').insert(insights.map(i => ({
    user_id: userId,
    ...i
  })));
}
```

### 2. Contextual Awareness

**Concept:** Rari remembers conversation context and user preferences.

**Implementation:**
- Already have `rari_conversations` and `rari_messages` tables
- Add user preferences table:

```sql
CREATE TABLE rari_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  default_location VARCHAR(50),
  preferred_metrics JSONB DEFAULT '["revenue", "utilization"]',
  notification_frequency VARCHAR(20) DEFAULT 'daily',
  voice_personality VARCHAR(20) DEFAULT 'professional', -- 'professional', 'casual', 'concise'
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### 3. Multi-Step Reasoning

**Concept:** Rari can chain multiple queries to answer complex questions.

**Example:**
```
User: "Should I buy another Ferrari for Miami?"

Rari's internal reasoning:
1. Get current Ferrari utilization in Miami → 85%
2. Get Miami demand forecast → High (Art Basel coming)
3. Get Ferrari revenue vs other vehicles → Top performer
4. Calculate ROI projection → 18 months payback
5. Check competitor pricing → Room for premium

Response: "Based on my analysis, yes! Your current Ferraris in Miami 
have 85% utilization—the highest in your fleet. With Art Basel in 
December, demand will spike 35%. A new Ferrari could pay for itself 
in 18 months at current rates. Would you like me to run a detailed 
ROI projection?"
```

### 4. Action Execution (Future)

**Concept:** Rari can take actions, not just report.

**Phase 1 (Safe):**
- Create booking drafts
- Generate reports
- Send notifications

**Phase 2 (With Confirmation):**
- Update pricing (with approval)
- Schedule maintenance
- Send customer communications

---

## 📱 Frontend Enhancements

### 1. Rari Insights Panel

Add to Dashboard:
```tsx
<RariInsightsPanel 
  maxItems={5}
  showPriority={true}
  onDismiss={handleDismissInsight}
  onAction={handleInsightAction}
/>
```

### 2. Voice Command Shortcuts

```tsx
const QUICK_COMMANDS = [
  { label: "Daily Summary", command: "Give me today's summary" },
  { label: "Revenue Report", command: "What's my revenue this week?" },
  { label: "Idle Vehicles", command: "Which vehicles are sitting idle?" },
  { label: "Miami vs Scottsdale", command: "Compare Miami and Scottsdale" },
  { label: "Outstanding Payments", command: "Who owes me money?" },
  { label: "Demand Forecast", command: "What's the demand forecast?" },
];
```

### 3. Rari Action Items

Track and display action items from conversations:
```tsx
<RariActionItems 
  showCompleted={false}
  onComplete={handleComplete}
  onSnooze={handleSnooze}
/>
```

---

## 🗓️ Implementation Roadmap

### Week 1: Foundation
- [ ] Create `vehicle_expenses` table
- [ ] Create `rari_insights` table
- [ ] Add `getVehicleProfitLoss` handler
- [ ] Add `compareLocations` handler
- [ ] Add `getOutstandingBalances` handler
- [ ] Add `getIdleVehicles` handler

### Week 2: Intelligence
- [ ] Create database views (profit_loss, location_comparison, customer_rfm)
- [ ] Implement insight generation logic
- [ ] Add `getRariInsights` handler
- [ ] Add `getCustomerSegments` handler
- [ ] Create scheduled insight generator Edge Function

### Week 3: Integration
- [ ] Add Rari Insights Panel to Dashboard
- [ ] Implement quick command shortcuts
- [ ] Add action items tracking
- [ ] Test multi-location queries
- [ ] Performance optimization

### Week 4: Polish
- [ ] User preference system
- [ ] Conversation context improvements
- [ ] Error handling and fallbacks
- [ ] Documentation and training
- [ ] Demo data for all new features

---

## 💰 Business Impact Projections

| Feature | User Benefit | Revenue Impact |
|---------|--------------|----------------|
| **Vehicle P/L** | Know which cars make money | +15% fleet optimization |
| **Proactive Insights** | Never miss opportunities | +20% revenue capture |
| **Idle Vehicle Alerts** | Reduce dead inventory | -25% idle time |
| **Location Comparison** | Optimize market strategy | +10% market efficiency |
| **Customer Segmentation** | Target high-value clients | +30% repeat bookings |
| **Demand Forecasting** | Dynamic pricing | +18% revenue per booking |

---

## 🎯 Success Metrics

1. **Rari Engagement**
   - Daily active voice sessions
   - Average conversation length
   - Query success rate

2. **Insight Effectiveness**
   - Insights generated per user/week
   - Insight action rate
   - Revenue from insight-driven actions

3. **User Satisfaction**
   - Feature request reduction
   - Support ticket reduction
   - NPS improvement

---

## 📞 Next Steps

1. **Approve schema changes** - Review and approve new tables
2. **Prioritize features** - Confirm Tier 1 features for this week
3. **Assign resources** - Allocate development time
4. **Set milestones** - Define demo-ready checkpoints
5. **User testing** - Identify beta testers for new features

---

**This plan transforms Rari from a helpful assistant into an indispensable business intelligence partner that proactively helps fleet operators maximize revenue and minimize operational friction.**

*"Rari doesn't just answer questions—she anticipates needs."*
