# User Request Analytics Implementation

## Overview
This document describes the implementation of the user request analytics system that tracks tool requests, feature suggestions, and user feedback to help prioritize future development.

## Components

### 1. Database Schema
**File:** `/workspace/supabase/migrations/20251229000000_user_request_analytics.sql`

Created the `user_request_analytics` table with the following features:
- Tracks all types of user requests (tool_request, feature_suggestion, help_query, general_feedback)
- Automatic keyword extraction and sentiment analysis
- Priority scoring system (0-100)
- Status tracking (pending, reviewing, planned, in_progress, completed, rejected)
- Row-level security policies (users can read/insert their own, admins can see all)
- Analytics views for trending topics and summary statistics

### 2. Backend Edge Function
**File:** `/workspace/supabase/functions/user-request-analytics/index.ts`

Provides the following API endpoints:
- `log_request` - Log a new user request with automatic analysis
- `get_analytics` - Get analytics for a specific timeframe
- `get_trending_topics` - Get trending keywords and topics
- `generate_report` - Generate comprehensive reports for custom date ranges
- `update_status` - Update request status (admin only)

Features:
- Keyword extraction from request content
- Sentiment analysis (positive, neutral, negative)
- Priority scoring based on type, urgency keywords, and sentiment
- Time-based analytics (day, week, month, year)

### 3. Frontend Service
**File:** `/workspace/src/lib/requestAnalytics.ts`

TypeScript client library with:
- `logUserRequest()` - Log any type of user request
- `getAnalytics()` - Fetch analytics data
- `getTrendingTopics()` - Get trending topics
- `generateReport()` - Generate downloadable reports
- `updateRequestStatus()` - Admin function to update request status
- Helper functions for specific request types:
  - `logToolRequest()`
  - `logFeatureSuggestion()`
  - `logHelpQuery()`
  - `logGeneralFeedback()`

### 4. Admin Dashboard
**File:** `/workspace/src/components/dashboard/RequestAnalyticsDashboard.tsx`

Comprehensive analytics dashboard featuring:
- **Summary Cards:** Total requests, average priority, unique users
- **Overview Tab:**
  - Request types breakdown with visual charts
  - Sentiment analysis distribution
  - Module-specific request counts
- **Trending Topics Tab:**
  - Most frequently mentioned keywords
  - Detailed topic analysis with frequency and unique requesters
- **Priority Requests Tab:**
  - High-priority requests requiring attention
  - Sorted by priority score with sentiment indicators
- Export functionality to download reports as JSON

### 5. Feedback Collection
**File:** `/workspace/src/components/common/FeedbackButton.tsx`

Reusable feedback collection component:
- Floating button variant for persistent access
- Multiple feedback types selection
- Context-aware (tracks which module/page user is on)
- Inline and outline button variants

### 6. Integration Points

#### Rari Voice Interface
**File:** `/workspace/src/components/rari/RariVoiceInterface.tsx`
- Automatically logs all user queries and AI responses
- Tracks help queries with context

#### Main Dashboard
**File:** `/workspace/src/pages/Dashboard.tsx`
- Added "Request Analytics" module (admin-only)
- Floating feedback button for easy access
- Integrated into module navigation

#### Sidebar Navigation
**File:** `/workspace/src/components/dashboard/DashboardSidebarEnhanced.tsx`
- Added "Request Analytics" to Management section (admin-only access)

## Usage

### For Developers

#### Log a user request:
```typescript
import { logUserRequest } from '@/lib/requestAnalytics';

await logUserRequest({
  requestType: 'tool_request',
  requestContent: 'User wants dark mode toggle',
  moduleId: 'settings',
  context: { feature: 'dark_mode' }
});
```

#### Get analytics:
```typescript
import { getAnalytics } from '@/lib/requestAnalytics';

const analytics = await getAnalytics({ 
  timeframe: 'week',
  requestType: 'feature_suggestion'
});
```

#### Generate report:
```typescript
import { generateReport } from '@/lib/requestAnalytics';

const report = await generateReport({
  startDate: '2025-01-01T00:00:00Z',
  endDate: '2025-12-31T23:59:59Z'
});
```

### For Admins

1. Access the analytics dashboard from the sidebar (Management > Request Analytics)
2. View summary metrics and breakdowns
3. Explore trending topics to see what users are asking for
4. Review high-priority requests
5. Export reports for further analysis
6. Update request status as they are addressed

### For Users

1. Click the floating purple feedback button (bottom right)
2. Select feedback type
3. Enter your feedback/request
4. Submit

## Analytics Features

### Automatic Analysis
- **Keyword Extraction:** Top 5 relevant keywords from each request
- **Sentiment Analysis:** Positive, neutral, or negative
- **Priority Scoring:** 0-100 score based on:
  - Request type (tool requests = higher priority)
  - Urgency keywords (urgent, critical, broken, etc.)
  - Sentiment (negative = higher priority)

### Trending Topics
- Tracks keyword frequency over time
- Identifies most requested features/tools
- Shows unique requester count per topic
- Helps prioritize development roadmap

### Reports
- Custom date range selection
- Comprehensive breakdown by type, status, sentiment, module
- High-priority requests highlighted
- Exportable as JSON

## Security

### Row Level Security (RLS)
- Users can only read and insert their own requests
- Admins can read and update all requests
- Service role required for bulk operations

### Admin Access
- Analytics dashboard is admin-only
- Status updates require admin role
- Report generation available to all authenticated users

## Database Schema Details

### Main Table: `user_request_analytics`
```sql
- id: UUID (primary key)
- user_id: UUID (references profiles)
- request_type: TEXT (enum)
- request_content: TEXT
- request_keywords: TEXT[]
- context: JSONB
- module_id: TEXT
- priority_score: INTEGER (0-100)
- status: TEXT (enum)
- sentiment: TEXT (enum)
- ai_response: TEXT
- resolved: BOOLEAN
- resolved_at: TIMESTAMPTZ
- resolved_by: UUID
- notes: TEXT
- created_at: TIMESTAMPTZ
- updated_at: TIMESTAMPTZ
```

### Views
1. `user_request_analytics_summary` - Daily aggregations
2. `user_request_keywords_trending` - Trending keywords analysis

## Future Enhancements

Potential improvements:
1. Email notifications for high-priority requests
2. Integration with GitHub Issues for feature tracking
3. AI-powered request categorization and duplicate detection
4. User voting on feature requests
5. Public roadmap based on analytics
6. Slack integration for request notifications
7. Advanced filtering and search in dashboard
8. Export to CSV/Excel formats
9. Historical trend charts
10. Predictive analytics for request patterns

## Monitoring

The system tracks:
- Total requests per day/week/month
- Most requested features/tools
- User engagement metrics
- Request resolution rates
- Average time to resolution
- Sentiment trends

## Best Practices

1. **Log Liberally:** Log any user-facing interaction that could indicate a feature request
2. **Provide Context:** Include relevant context (module, feature, user action) with each log
3. **Review Regularly:** Check analytics weekly to identify patterns
4. **Act on Insights:** Prioritize development based on analytics data
5. **Close the Loop:** Update request status when features are implemented
6. **Communicate:** Share roadmap updates based on user requests

## Support

For questions or issues with the analytics system:
1. Check the Edge Function logs in Supabase Dashboard
2. Review the browser console for client-side errors
3. Verify RLS policies are correctly configured
4. Ensure user has appropriate role permissions
