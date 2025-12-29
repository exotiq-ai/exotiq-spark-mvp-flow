# User Request Analytics - Setup Guide

## Quick Start

### 1. Database Migration

Run the migration to create the analytics tables:

```bash
# If using Supabase CLI
supabase db push

# Or apply the migration manually in Supabase Dashboard
# SQL Editor > New query > Paste contents of:
# supabase/migrations/20251229000000_user_request_analytics.sql
```

### 2. Deploy Edge Function

Deploy the analytics edge function:

```bash
# Using Supabase CLI
supabase functions deploy user-request-analytics

# Or deploy via Supabase Dashboard:
# Edge Functions > Deploy new function
# Name: user-request-analytics
# Code: supabase/functions/user-request-analytics/index.ts
```

### 3. Verify Permissions

Ensure your user has admin role to access the analytics dashboard:

```sql
-- Check your role
SELECT role FROM user_roles WHERE user_id = auth.uid();

-- Grant admin role (run as service role)
INSERT INTO user_roles (user_id, role)
VALUES ('your-user-id', 'admin')
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
```

### 4. Access the Dashboard

1. Log into your application
2. Navigate to the sidebar
3. Under "Management" section, click "Request Analytics"
4. Start exploring user feedback!

## Testing the System

### Test User Request Logging

Open browser console and run:

```javascript
import { logUserRequest } from '@/lib/requestAnalytics';

// Log a test feature request
await logUserRequest({
  requestType: 'feature_suggestion',
  requestContent: 'It would be great to have a dark mode toggle in the settings',
  moduleId: 'settings',
  context: { 
    feature: 'dark_mode',
    page: '/dashboard/settings'
  }
});
```

### Test Feedback Button

1. Click the purple floating feedback button (bottom right)
2. Select a feedback type
3. Enter sample feedback
4. Submit
5. Check the analytics dashboard to see your feedback

### Verify Edge Function

Test the edge function directly:

```bash
# Using curl
curl -X POST https://your-project.supabase.co/functions/v1/user-request-analytics \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "get_analytics",
    "timeframe": "week"
  }'
```

## Configuration

### Environment Variables

No additional environment variables needed - uses existing Supabase configuration.

### Customize Priority Scoring

Edit `/workspace/supabase/functions/user-request-analytics/index.ts`:

```typescript
// Adjust base scores
const typeScores: Record<string, number> = {
  'tool_request': 30,        // Change these values
  'feature_suggestion': 25,
  'help_query': 15,
  'general_feedback': 10
};

// Add/modify urgency keywords
const urgentKeywords = ['urgent', 'critical', 'important', 'asap', 'immediately', 'broken', 'error', 'bug', 'crash'];
```

### Customize Sentiment Analysis

Add more keywords for better sentiment detection:

```typescript
const positiveWords = ['great', 'awesome', 'excellent', 'love', 'perfect', 'amazing', 'wonderful'];
const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'poor', 'broken', 'wrong', 'issue', 'problem'];
```

## Common Use Cases

### 1. Track Feature Requests

```typescript
import { logFeatureSuggestion } from '@/lib/requestAnalytics';

// When user requests a feature
await logFeatureSuggestion(
  'Add export to PDF functionality for reports',
  'reports'
);
```

### 2. Track Help Queries

```typescript
import { logHelpQuery } from '@/lib/requestAnalytics';

// When user asks for help
await logHelpQuery(
  'How do I add a new vehicle to the fleet?',
  'Click the + button in the Vehicles section...',
  'vehicles'
);
```

### 3. Track Tool Usage

```typescript
import { logToolRequest } from '@/lib/requestAnalytics';

// When user tries to use a non-existent tool
await logToolRequest('calendar_sync', {
  attempted_action: 'sync_google_calendar',
  user_flow: 'settings_integrations'
});
```

### 4. Generate Monthly Report

```typescript
import { generateReport } from '@/lib/requestAnalytics';

// Generate report for last month
const startDate = new Date();
startDate.setMonth(startDate.getMonth() - 1);
startDate.setDate(1);

const endDate = new Date();
endDate.setDate(0); // Last day of previous month

const report = await generateReport({
  startDate: startDate.toISOString(),
  endDate: endDate.toISOString()
});

// Download the report
const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `analytics-report-${startDate.toISOString().split('T')[0]}.json`;
a.click();
```

## Troubleshooting

### Issue: Analytics Dashboard Not Showing

**Solution:**
- Verify you have admin role: `SELECT role FROM user_roles WHERE user_id = auth.uid();`
- Check sidebar navigation permissions in `DashboardSidebarEnhanced.tsx`
- Clear browser cache and reload

### Issue: Requests Not Being Logged

**Solution:**
- Check browser console for errors
- Verify edge function is deployed: Supabase Dashboard > Edge Functions
- Test edge function directly with curl
- Check Supabase logs for errors

### Issue: RLS Policies Blocking Access

**Solution:**
```sql
-- Check current policies
SELECT * FROM pg_policies WHERE tablename = 'user_request_analytics';

-- Verify user authentication
SELECT auth.uid(); -- Should return your user ID

-- Check user role
SELECT * FROM user_roles WHERE user_id = auth.uid();
```

### Issue: Empty Analytics Data

**Solution:**
- Log some test requests using the feedback button
- Verify data is in the table: `SELECT * FROM user_request_analytics LIMIT 10;`
- Check date filters in analytics queries
- Ensure timeframe selection is appropriate

## Integration Examples

### Add to Specific Component

```typescript
// In any component
import { logUserRequest } from '@/lib/requestAnalytics';
import { useAuth } from '@/contexts/AuthContext';

export const MyComponent = () => {
  const { user } = useAuth();
  
  const handleFeatureRequest = async () => {
    await logUserRequest({
      requestType: 'feature_suggestion',
      requestContent: 'User wants to filter by multiple criteria',
      moduleId: 'bookings',
      context: {
        component: 'BookingsList',
        current_filters: ['date', 'status']
      }
    });
  };

  return (
    <Button onClick={handleFeatureRequest}>
      Request Feature
    </Button>
  );
};
```

### Add to Error Handler

```typescript
// In error boundary or global error handler
import { logGeneralFeedback } from '@/lib/requestAnalytics';

const handleError = async (error: Error) => {
  await logGeneralFeedback(
    `Error occurred: ${error.message}`,
    {
      error_type: error.name,
      stack_trace: error.stack,
      component: 'ErrorBoundary',
      severity: 'high'
    }
  );
};
```

## Analytics Best Practices

1. **Be Consistent:** Use the same terminology across all logging
2. **Provide Context:** Always include module_id and relevant context
3. **Review Regularly:** Check analytics at least weekly
4. **Act on Data:** Use insights to prioritize development
5. **Close the Loop:** Update request status when implemented
6. **Communicate:** Let users know when their requests are implemented

## Data Retention

The current implementation stores all requests indefinitely. To implement data retention:

```sql
-- Delete requests older than 1 year
DELETE FROM user_request_analytics
WHERE created_at < NOW() - INTERVAL '1 year';

-- Or create a scheduled function to run monthly
CREATE OR REPLACE FUNCTION cleanup_old_requests()
RETURNS void AS $$
BEGIN
  DELETE FROM user_request_analytics
  WHERE created_at < NOW() - INTERVAL '1 year'
  AND resolved = true;
END;
$$ LANGUAGE plpgsql;
```

## Exporting Data

### Export to CSV (Future Enhancement)

```typescript
// Add to generateReport function
if (format === 'csv') {
  const csv = requests.map(r => ({
    date: r.created_at,
    type: r.request_type,
    content: r.request_content,
    priority: r.priority_score,
    sentiment: r.sentiment,
    status: r.status
  }));
  
  // Convert to CSV and download
  // Implementation depends on your CSV library
}
```

## Support & Resources

- **Documentation:** `/workspace/ANALYTICS_IMPLEMENTATION.md`
- **Edge Function:** `/workspace/supabase/functions/user-request-analytics/index.ts`
- **Frontend Service:** `/workspace/src/lib/requestAnalytics.ts`
- **Dashboard Component:** `/workspace/src/components/dashboard/RequestAnalyticsDashboard.tsx`
- **Database Schema:** `/workspace/supabase/migrations/20251229000000_user_request_analytics.sql`

## Next Steps

1. Deploy the migration and edge function
2. Test with sample data
3. Review the analytics dashboard
4. Integrate logging into key user interactions
5. Set up regular review schedule
6. Start prioritizing development based on insights!

---

Need help? Check the implementation docs or review the edge function logs in Supabase Dashboard.
