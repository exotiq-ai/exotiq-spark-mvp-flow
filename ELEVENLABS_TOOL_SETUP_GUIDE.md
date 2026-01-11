# 📋 ElevenLabs Tool Setup Guide - Step by Step

## 🔐 FIRST: Create the Secret in ElevenLabs

Before adding any tools, you need to create the secret that will hold the auth token:

1. In ElevenLabs Agent Dashboard, go to **Agent Settings** → **Secrets**
2. Click **"Add Secret"**
3. Create a secret with:
   - **Name:** `rari_tool_token`
   - **Value:** Leave empty or put placeholder (it will be dynamically filled)
4. Save

---

## 🔧 UNIVERSAL SETTINGS FOR ALL TOOLS

Every tool uses these same settings:

| Setting | Value |
|---------|-------|
| **Method** | `POST` |
| **URL** | `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools` |
| **Response timeout** | `20 seconds` (default) |
| **Pre-tool speech** | `Auto` |
| **Execution mode** | `Immediate` |

### Header Configuration (SAME FOR ALL TOOLS)

Click **"Add header"** and configure:
- **Type:** `Secret`
- **Name:** `Authorization`
- **Secret:** Select `rari_tool_token` (the secret you created)

---

## 📦 TOOL #1: get_fleet_vehicles

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `get_fleet_vehicles` |
| **Description** | `Get all vehicles in the fleet, optionally filtered by status and location` |

### Body Parameters
Click **"Add param"** for each:

**Parameter 1: status**
- **Description:** `Filter vehicles by status`
- **Data type:** `String`
- **Identifier:** `status`
- **Required:** ❌ (unchecked)
- **Value Type:** `LLM Prompt`
- **Enum Values:** Add these one by one: `all`, `available`, `rented`, `maintenance`

**Parameter 2: location**
- **Description:** `Filter by location (e.g., 'miami', 'scottsdale')`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌ (unchecked)
- **Value Type:** `LLM Prompt`

---

## 📦 TOOL #2: get_bookings

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `get_bookings` |
| **Description** | `Get bookings with optional filters for status, date range, and location` |

### Body Parameters

**Parameter 1: status**
- **Description:** `Filter by booking status`
- **Data type:** `String`
- **Identifier:** `status`
- **Required:** ❌
- **Enum Values:** `all`, `pending`, `confirmed`, `active`, `completed`, `cancelled`

**Parameter 2: start_date**
- **Description:** `Filter bookings starting from this date (YYYY-MM-DD)`
- **Data type:** `String`
- **Identifier:** `start_date`
- **Required:** ❌

**Parameter 3: end_date**
- **Description:** `Filter bookings ending before this date (YYYY-MM-DD)`
- **Data type:** `String`
- **Identifier:** `end_date`
- **Required:** ❌

**Parameter 4: location**
- **Description:** `Filter by location (e.g., 'miami', 'scottsdale')`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #3: get_recent_activity

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `get_recent_activity` |
| **Description** | `Get recent activity feed including bookings, payments, and other events` |

### Body Parameters

**Parameter 1: limit**
- **Description:** `Number of activities to return (default: 10)`
- **Data type:** `Integer`
- **Identifier:** `limit`
- **Required:** ❌

**Parameter 2: activity_type**
- **Description:** `Filter by activity type`
- **Data type:** `String`
- **Identifier:** `activity_type`
- **Required:** ❌
- **Enum Values:** `all`, `bookings`, `payments`, `maintenance`

---

## 📦 TOOL #4: getFleetMetrics

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getFleetMetrics` |
| **Description** | `Get fleet performance metrics including total vehicles, active bookings, revenue, and utilization over a specified timeframe and location` |

### Body Parameters

**Parameter 1: timeframe** ⚠️ REQUIRED
- **Description:** `The time period to analyze metrics for`
- **Data type:** `String`
- **Identifier:** `timeframe`
- **Required:** ✅ (checked)
- **Enum Values:** `today`, `week`, `month`, `year`

**Parameter 2: location**
- **Description:** `Filter by location (e.g., 'miami', 'scottsdale')`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #5: getLocationMetrics

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getLocationMetrics` |
| **Description** | `Get detailed metrics for a specific location or overview of all locations including vehicle count, revenue, utilization, and active bookings` |

### Body Parameters

**Parameter 1: location**
- **Description:** `Specific location to get metrics for (e.g., 'miami', 'scottsdale'), or leave empty for all locations`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #6: getVehicleDetails

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getVehicleDetails` |
| **Description** | `Get detailed information about a specific vehicle, optionally including recent booking history` |

### Body Parameters

**Parameter 1: vehicleName** ⚠️ REQUIRED
- **Description:** `Name or partial name of the vehicle to search for (e.g., 'Ferrari', 'Lamborghini Huracan')`
- **Data type:** `String`
- **Identifier:** `vehicleName`
- **Required:** ✅

**Parameter 2: includeBookings**
- **Description:** `Whether to include the last 10 bookings for this vehicle`
- **Data type:** `Boolean`
- **Identifier:** `includeBookings`
- **Required:** ❌

---

## 📦 TOOL #7: getCustomerProfile

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getCustomerProfile` |
| **Description** | `Get customer information and optionally their complete booking history` |

### Body Parameters

**Parameter 1: customerName** ⚠️ REQUIRED
- **Description:** `Full name or partial name of the customer`
- **Data type:** `String`
- **Identifier:** `customerName`
- **Required:** ✅

**Parameter 2: includeHistory**
- **Description:** `Whether to include full booking history`
- **Data type:** `Boolean`
- **Identifier:** `includeHistory`
- **Required:** ❌

---

## 📦 TOOL #8: checkAvailability

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `checkAvailability` |
| **Description** | `Check if vehicles are available for a given date range, optionally filtered by vehicle name or location` |

### Body Parameters

**Parameter 1: vehicleName**
- **Description:** `Name of the vehicle to check availability for`
- **Data type:** `String`
- **Identifier:** `vehicleName`
- **Required:** ❌

**Parameter 2: startDate** ⚠️ REQUIRED
- **Description:** `Start date in ISO format (YYYY-MM-DD)`
- **Data type:** `String`
- **Identifier:** `startDate`
- **Required:** ✅

**Parameter 3: endDate** ⚠️ REQUIRED
- **Description:** `End date in ISO format (YYYY-MM-DD)`
- **Data type:** `String`
- **Identifier:** `endDate`
- **Required:** ✅

**Parameter 4: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #9: getRevenueAnalysis

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getRevenueAnalysis` |
| **Description** | `Analyze revenue for the fleet or a specific vehicle over a timeframe and location` |

### Body Parameters

**Parameter 1: timeframe** ⚠️ REQUIRED
- **Description:** `Time period to analyze`
- **Data type:** `String`
- **Identifier:** `timeframe`
- **Required:** ✅
- **Enum Values:** `today`, `week`, `month`, `year`

**Parameter 2: vehicleName**
- **Description:** `Optional: specific vehicle name to analyze (leave empty for all vehicles)`
- **Data type:** `String`
- **Identifier:** `vehicleName`
- **Required:** ❌

**Parameter 3: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #10: getTopPerformers

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getTopPerformers` |
| **Description** | `Get top performing vehicles or customers based on revenue, utilization, or bookings` |

### Body Parameters

**Parameter 1: metric** ⚠️ REQUIRED
- **Description:** `The metric to rank by`
- **Data type:** `String`
- **Identifier:** `metric`
- **Required:** ✅
- **Enum Values:** `revenue`, `utilization`, `bookings`

**Parameter 2: limit**
- **Description:** `Number of top performers to return (default: 5)`
- **Data type:** `Integer`
- **Identifier:** `limit`
- **Required:** ❌

**Parameter 3: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #11: searchBookings

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `searchBookings` |
| **Description** | `Search for bookings by status, date range, and location` |

### Body Parameters

**Parameter 1: status**
- **Description:** `Filter by booking status (leave empty for all)`
- **Data type:** `String`
- **Identifier:** `status`
- **Required:** ❌
- **Enum Values:** `pending`, `confirmed`, `active`, `completed`, `cancelled`

**Parameter 2: daysRange**
- **Description:** `Number of days in the past to search (leave empty for all time)`
- **Data type:** `Integer`
- **Identifier:** `daysRange`
- **Required:** ❌

**Parameter 3: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #12: getDamageReports

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getDamageReports` |
| **Description** | `Get damage claim reports filtered by status and location` |

### Body Parameters

**Parameter 1: status**
- **Description:** `Filter by claim status`
- **Data type:** `String`
- **Identifier:** `status`
- **Required:** ❌
- **Enum Values:** `all`, `pending`, `approved`, `rejected`, `settled`

**Parameter 2: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #13: getUpcomingMaintenance

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getUpcomingMaintenance` |
| **Description** | `Get upcoming maintenance schedules within a specified number of days, optionally filtered by location` |

### Body Parameters

**Parameter 1: daysAhead**
- **Description:** `Number of days ahead to look for maintenance (default: 30)`
- **Data type:** `Integer`
- **Identifier:** `daysAhead`
- **Required:** ❌

**Parameter 2: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #14: getCustomerLifetimeValue

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getCustomerLifetimeValue` |
| **Description** | `Get lifetime value and total bookings for a specific customer` |

### Body Parameters

**Parameter 1: customerName** ⚠️ REQUIRED
- **Description:** `Full or partial name of the customer`
- **Data type:** `String`
- **Identifier:** `customerName`
- **Required:** ✅

---

## 📦 TOOL #15: getPaymentSummary

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getPaymentSummary` |
| **Description** | `Get payment summary including total payments, breakdown by status and method, and recent transactions` |

### Body Parameters

**Parameter 1: status**
- **Description:** `Filter by payment status`
- **Data type:** `String`
- **Identifier:** `status`
- **Required:** ❌
- **Enum Values:** `all`, `pending`, `paid`, `failed`, `refunded`

**Parameter 2: timeframe**
- **Description:** `Time period to analyze`
- **Data type:** `String`
- **Identifier:** `timeframe`
- **Required:** ❌
- **Enum Values:** `today`, `week`, `month`, `year`

**Parameter 3: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #16: getVaultDocuments

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getVaultDocuments` |
| **Description** | `Get documents from the vault filtered by category and status` |

### Body Parameters

**Parameter 1: category**
- **Description:** `Document category`
- **Data type:** `String`
- **Identifier:** `category`
- **Required:** ❌
- **Enum Values:** `insurance`, `registration`, `inspection`

**Parameter 2: status**
- **Description:** `Document status`
- **Data type:** `String`
- **Identifier:** `status`
- **Required:** ❌
- **Enum Values:** `active`, `expiring`, `expired`

---

## 📦 TOOL #17: getDemandForecast

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getDemandForecast` |
| **Description** | `Get AI-powered demand forecast with upcoming events data for a specific city and time period` |

### Body Parameters

**Parameter 1: city**
- **Description:** `City name for the forecast (e.g., 'miami', 'scottsdale')`
- **Data type:** `String`
- **Identifier:** `city`
- **Required:** ❌

**Parameter 2: days**
- **Description:** `Number of days to forecast (7, 14, or 30)`
- **Data type:** `Integer`
- **Identifier:** `days`
- **Required:** ❌

**Parameter 3: location**
- **Description:** `Alternative to city - filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #18: getPricingRecommendation

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getPricingRecommendation` |
| **Description** | `Get AI-powered pricing recommendation for a specific vehicle based on utilization, demand, and seasonal factors` |

### Body Parameters

**Parameter 1: vehicleName** ⚠️ REQUIRED
- **Description:** `Name or partial name of the vehicle to get pricing recommendation for`
- **Data type:** `String`
- **Identifier:** `vehicleName`
- **Required:** ✅

**Parameter 2: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #19: getFleetPricingOverview

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getFleetPricingOverview` |
| **Description** | `Get comprehensive pricing overview for the entire fleet including average rates, utilization, and optimization recommendations` |

### Body Parameters

**Parameter 1: location**
- **Description:** `Filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #20: getEventImpact

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getEventImpact` |
| **Description** | `Get information about how a specific event might impact rental demand and pricing` |

### Body Parameters

**Parameter 1: eventName** ⚠️ REQUIRED
- **Description:** `Name of the event to analyze (e.g., 'Super Bowl', 'Art Basel', 'Miami Grand Prix')`
- **Data type:** `String`
- **Identifier:** `eventName`
- **Required:** ✅

**Parameter 2: location**
- **Description:** `Location context for the event`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #21: getWeatherInfo

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getWeatherInfo` |
| **Description** | `Get weather information for a location (simulated for demo purposes)` |

### Body Parameters

**Parameter 1: location** ⚠️ REQUIRED
- **Description:** `City or location name`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ✅

---

## 📦 TOOL #22: getCarJoke

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getCarJoke` |
| **Description** | `Get a random car-related joke to lighten the conversation` |

### Body Parameters
**No parameters needed** - leave empty

---

## 📦 TOOL #23: getVehicleSpecs

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getVehicleSpecs` |
| **Description** | `Get technical specifications for a specific vehicle model (Ferrari, Lamborghini, McLaren, Bugatti, Porsche, Rolls-Royce)` |

### Body Parameters

**Parameter 1: vehicleName** ⚠️ REQUIRED
- **Description:** `Name or model of the vehicle`
- **Data type:** `String`
- **Identifier:** `vehicleName`
- **Required:** ✅

---

## 📦 TOOL #24: logFeedback

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `logFeedback` |
| **Description** | `Log user feedback when a feature doesn't work or isn't available. Use this when you can't fulfill a user's request.` |

### Body Parameters

**Parameter 1: feedbackType** ⚠️ REQUIRED
- **Description:** `Type of feedback being logged`
- **Data type:** `String`
- **Identifier:** `feedbackType`
- **Required:** ✅
- **Enum Values:** `feature_request`, `not_working`, `other`

**Parameter 2: keywords**
- **Description:** `Comma-separated keywords related to the feedback`
- **Data type:** `String`
- **Identifier:** `keywords`
- **Required:** ❌

**Parameter 3: userQuery** ⚠️ REQUIRED
- **Description:** `What the user asked for`
- **Data type:** `String`
- **Identifier:** `userQuery`
- **Required:** ✅

**Parameter 4: rariResponse**
- **Description:** `Brief description of why this couldn't be fulfilled`
- **Data type:** `String`
- **Identifier:** `rariResponse`
- **Required:** ❌

---

## 📦 TOOL #25: featureComingSoon

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `featureComingSoon` |
| **Description** | `Use when a user asks for a feature that isn't available yet. This logs the request and tells the user it's coming soon.` |

### Body Parameters

**Parameter 1: featureName** ⚠️ REQUIRED
- **Description:** `Name of the feature that's not yet available`
- **Data type:** `String`
- **Identifier:** `featureName`
- **Required:** ✅

**Parameter 2: userRequest** ⚠️ REQUIRED
- **Description:** `What the user specifically asked for`
- **Data type:** `String`
- **Identifier:** `userRequest`
- **Required:** ✅

---

## 📦 TOOL #26: getVehicleProfitLoss

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getVehicleProfitLoss` |
| **Description** | `Get profit and loss analysis for vehicles including revenue, expenses, and profit margin. Can filter by specific vehicle, timeframe, or location. Use this when users ask about profitability, P/L, which vehicles make money, or financial performance.` |

### Body Parameters

**Parameter 1: vehicleName**
- **Description:** `Optional: specific vehicle name to analyze (e.g., 'Ferrari', 'Lamborghini')`
- **Data type:** `String`
- **Identifier:** `vehicleName`
- **Required:** ❌

**Parameter 2: timeframe**
- **Description:** `Time period to analyze`
- **Data type:** `String`
- **Identifier:** `timeframe`
- **Required:** ❌
- **Enum Values:** `today`, `week`, `month`, `year`

**Parameter 3: location**
- **Description:** `Optional: filter by location (e.g., 'miami', 'scottsdale')`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #27: compareLocations

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `compareLocations` |
| **Description** | `Compare performance metrics between different fleet locations including revenue, utilization, vehicle count, and identify the top performer. Use this when users ask to compare Miami vs Scottsdale, which location is better, or location performance.` |

### Body Parameters

**Parameter 1: locations**
- **Description:** `Optional: comma-separated list of locations to compare`
- **Data type:** `String`
- **Identifier:** `locations`
- **Required:** ❌

**Parameter 2: timeframe**
- **Description:** `Time period to compare`
- **Data type:** `String`
- **Identifier:** `timeframe`
- **Required:** ❌
- **Enum Values:** `today`, `week`, `month`, `year`

---

## 📦 TOOL #28: getOutstandingBalances

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getOutstandingBalances` |
| **Description** | `Get outstanding payment balances and overdue bookings. Shows who owes money, payment urgency, and total outstanding amounts. Use this when users ask 'who owes me money', 'outstanding balances', 'overdue payments', or 'pending payments'.` |

### Body Parameters

**Parameter 1: location**
- **Description:** `Optional: filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

**Parameter 2: minAmount**
- **Description:** `Optional: minimum balance amount to include`
- **Data type:** `Number`
- **Identifier:** `minAmount`
- **Required:** ❌

---

## 📦 TOOL #29: getIdleVehicles

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getIdleVehicles` |
| **Description** | `Find vehicles that haven't been booked recently. Includes recommendations for pricing adjustments or promotions. Use this when users ask about 'idle vehicles', 'vehicles not booked', 'sitting vehicles', or 'underutilized fleet'.` |

### Body Parameters

**Parameter 1: daysIdle**
- **Description:** `Number of days without booking to consider idle (default: 7)`
- **Data type:** `Integer`
- **Identifier:** `daysIdle`
- **Required:** ❌

**Parameter 2: location**
- **Description:** `Optional: filter by location`
- **Data type:** `String`
- **Identifier:** `location`
- **Required:** ❌

---

## 📦 TOOL #30: getCustomerSegments

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getCustomerSegments` |
| **Description** | `Get customer segmentation analysis including VIP, high-value, active, at-risk, and new customers based on booking history and lifetime value. Use this when users ask about 'VIP customers', 'top customers', 'customer segments', 'at-risk customers', or 'customer analysis'.` |

### Body Parameters

**Parameter 1: segment**
- **Description:** `Filter by customer segment`
- **Data type:** `String`
- **Identifier:** `segment`
- **Required:** ❌
- **Enum Values:** `all`, `vip`, `high_value`, `active`, `warm`, `at_risk`, `new`

**Parameter 2: limit**
- **Description:** `Number of customers to return (default: 10)`
- **Data type:** `Integer`
- **Identifier:** `limit`
- **Required:** ❌

---

## 📦 TOOL #31: getMultiLocationAvailability

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getMultiLocationAvailability` |
| **Description** | `Check vehicle availability across all locations for a specific date range. Great for finding options when a customer is flexible on location. Use this when users ask 'what's available everywhere', 'availability across locations', or 'find me a car anywhere'.` |

### Body Parameters

**Parameter 1: startDate** ⚠️ REQUIRED
- **Description:** `Start date in YYYY-MM-DD format`
- **Data type:** `String`
- **Identifier:** `startDate`
- **Required:** ✅

**Parameter 2: endDate** ⚠️ REQUIRED
- **Description:** `End date in YYYY-MM-DD format`
- **Data type:** `String`
- **Identifier:** `endDate`
- **Required:** ✅

**Parameter 3: make**
- **Description:** `Optional: filter by vehicle make (e.g., 'Ferrari', 'Lamborghini')`
- **Data type:** `String`
- **Identifier:** `make`
- **Required:** ❌

---

## 📦 TOOL #32: getRariInsights

### Configuration Section
| Field | Value |
|-------|-------|
| **Name** | `getRariInsights` |
| **Description** | `Get proactive AI-generated insights about fleet operations including utilization alerts, maintenance reminders, peak season notifications, and actionable recommendations. Use this when users ask 'any insights', 'what should I focus on', 'any issues', or 'recommendations'.` |

### Body Parameters

**Parameter 1: priority**
- **Description:** `Filter insights by priority level`
- **Data type:** `String`
- **Identifier:** `priority`
- **Required:** ❌
- **Enum Values:** `all`, `low`, `medium`, `high`, `urgent`

**Parameter 2: limit**
- **Description:** `Number of insights to return (default: 5)`
- **Data type:** `Integer`
- **Identifier:** `limit`
- **Required:** ❌

---

## ✅ QUICK CHECKLIST

For EACH tool:
1. ☐ Name matches exactly (case-sensitive)
2. ☐ Description copied correctly
3. ☐ Method is `POST`
4. ☐ URL is `https://jlgwbbqydjeokypoenoc.supabase.co/functions/v1/elevenlabs-tools`
5. ☐ Header added: Type=`Secret`, Name=`Authorization`, Secret=`rari_tool_token`
6. ☐ All required parameters marked as Required ✅
7. ☐ Enum values added for string parameters with fixed options
8. ☐ Saved the tool

---

## 🧪 TESTING

After setting up tools, test with these phrases:

| Question | Expected Tool |
|----------|---------------|
| "How many vehicles do I have?" | `get_fleet_vehicles` |
| "What's available next weekend?" | `checkAvailability` |
| "Show me my Miami metrics" | `getLocationMetrics` |
| "Who are my VIP customers?" | `getCustomerSegments` |
| "What's my revenue this month?" | `getRevenueAnalysis` |

---

## ⚠️ IMPORTANT NOTES

1. **Secret name must match exactly:** `rari_tool_token`
2. **All tools use the same URL** - you just change the name/description/parameters
3. **The tool name in Configuration is what the AI uses to call it** - must match exactly
4. **Parameter identifiers are case-sensitive** - match them exactly as shown
5. **After adding all tools, save and test** - you may need to refresh the agent
