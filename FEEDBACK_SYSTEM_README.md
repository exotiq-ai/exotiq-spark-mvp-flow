# User Feedback and Suggestion System

A comprehensive feedback management system integrated with Supabase that allows users to submit feedback, feature requests, and bug reports, while providing admins with powerful tools to track, prioritize, and manage user suggestions.

## Features

### For Users
- **Submit Feedback**: Easy-to-use dialog for submitting feedback from anywhere in the application
- **Multiple Categories**: Feature requests, bug reports, improvements, questions, and more
- **Priority Levels**: Users can indicate urgency (low, medium, high, critical)
- **Upvoting**: Vote on feedback from other users to show support
- **Context Capture**: Automatically captures relevant context when submitting feedback

### For Admins
- **Centralized Dashboard**: View and manage all user feedback in one place
- **Advanced Filtering**: Filter by category, priority, status, and search by keywords
- **Status Management**: Track feedback through lifecycle (new → under review → planned → in progress → completed)
- **Priority Assignment**: Re-prioritize feedback based on business needs
- **Effort Estimation**: Estimate development effort (small, medium, large, x-large)
- **Version Planning**: Assign feedback to target versions
- **Internal Notes**: Add private notes visible only to admins
- **Assignment**: Assign feedback to team members
- **Real-time Updates**: Live updates as feedback is submitted or modified
- **Email Notifications**: Automatic notifications for new high-priority feedback

## Database Schema

The system uses several interconnected tables:

### `rari_feedback` (Enhanced)
Main feedback table with the following key fields:
- `id`: Unique identifier
- `user_id`: User who submitted the feedback
- `category`: Type of feedback (feature_request, bug_report, improvement, question, other)
- `priority`: Urgency level (low, medium, high, critical)
- `status`: Current state (new, under_review, planned, in_progress, completed, declined)
- `user_query`: The actual feedback content
- `context`: JSON field for additional context
- `keywords`: Array of extracted keywords for search
- `upvotes`: Number of user upvotes
- `admin_notes`: Internal admin notes
- `assigned_to`: Team member assigned
- `estimated_effort`: Development effort estimate
- `target_version`: Planned release version
- `resolved`: Boolean flag for completion
- `resolved_at`: Timestamp of resolution

### `feedback_comments`
Comments and updates on feedback items:
- `feedback_id`: Reference to feedback item
- `user_id`: Comment author
- `comment`: Comment text
- `is_internal`: Flag for admin-only comments

### `feedback_attachments`
File attachments for feedback:
- `feedback_id`: Reference to feedback item
- `file_url`: URL to uploaded file
- `file_name`, `file_type`, `file_size`: File metadata

### `feedback_upvotes`
User upvotes for feedback:
- `feedback_id`: Reference to feedback item
- `user_id`: User who upvoted
- Unique constraint ensures one vote per user per feedback

### `admin_notification_settings`
Admin notification preferences:
- `user_id`: Admin user
- Email and Slack preferences for different priority levels

## API Integration

### Supabase Edge Function: `feedback-notification`

Automatically notifies admins when new feedback is submitted. Features:
- Email notifications via Resend
- Slack integration for real-time alerts
- Respects admin notification preferences
- Priority-based filtering (only notify for high/critical if configured)
- Beautiful HTML email templates with feedback details

**Endpoint**: `/functions/v1/feedback-notification`

**Payload**:
```json
{
  "feedbackId": "uuid",
  "userId": "uuid",
  "category": "feature_request",
  "priority": "high",
  "userQuery": "Description of feedback",
  "context": {},
  "notifyAdmins": true
}
```

## Usage

### For Developers

#### Submit Feedback Programmatically

```typescript
import { useFeedback } from "@/hooks/useFeedback";

function MyComponent() {
  const { submitFeedback } = useFeedback();

  const handleSubmit = async () => {
    await submitFeedback({
      category: "feature_request",
      priority: "medium",
      description: "It would be great if...",
      context: {
        page: "dashboard",
        module: "analytics"
      }
    });
  };
}
```

#### Use Feedback Button Component

```tsx
import { FeedbackButton } from "@/components/feedback";

function Toolbar() {
  return (
    <FeedbackButton 
      variant="outline"
      context={{ page: "inventory" }}
    />
  );
}
```

#### Use Feedback Dialog Directly

```tsx
import { FeedbackSubmissionDialog } from "@/components/feedback";

function MyComponent() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Send Feedback</button>
      <FeedbackSubmissionDialog
        open={open}
        onOpenChange={setOpen}
        initialContext={{ feature: "reporting" }}
      />
    </>
  );
}
```

### For Admins

1. **Access Feedback Dashboard**: Navigate to Settings → User Feedback
2. **View Feedback**: Browse all feedback with tabs for different statuses
3. **Manage Feedback**: Click any item to open management dialog
4. **Update Status**: Change status to track progress
5. **Prioritize**: Adjust priority as needed
6. **Assign**: Assign to team members
7. **Add Notes**: Add internal notes for team reference
8. **Plan Releases**: Set target versions for features

### Managing Notifications

Admins can configure notification preferences:

1. Go to database and insert/update record in `admin_notification_settings`
2. Configure preferences for:
   - New feedback notifications (email/Slack)
   - High priority alerts
   - Critical priority alerts

## Installation & Setup

### 1. Run Database Migration

```bash
# Apply the migration to create/enhance tables
supabase db push
```

The migration file is located at:
`/workspace/supabase/migrations/20251229000000_user_feedback_system.sql`

### 2. Deploy Edge Function

```bash
# Deploy the notification function
supabase functions deploy feedback-notification
```

The function is located at:
`/workspace/supabase/functions/feedback-notification/index.ts`

### 3. Configure Environment Variables

Ensure these environment variables are set in your Supabase project:

- `RESEND_API_KEY`: For email notifications
- `APP_URL`: Your application URL (for feedback links in emails)

### 4. Update Supabase Types (Optional)

```bash
# Generate TypeScript types
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## Security & Permissions

The system uses Row Level Security (RLS) policies:

### Users Can:
- View all feedback (for upvoting and discovering popular requests)
- Insert their own feedback
- Update their own feedback
- Upvote/downvote feedback
- Add public comments

### Admins Can:
- View all feedback
- Update any feedback (status, priority, assignment, etc.)
- Add internal comments (visible only to admins)
- Access admin notification settings

## Integration Points

### Current Integrations:
1. **Dashboard Header**: Feedback button in main header (visible on all pages)
2. **Settings**: Admin dashboard in Settings → User Feedback
3. **Notifications**: Automatic email/Slack notifications to admins

### Suggested Integration Points:
- Add feedback button to error boundaries
- Include in help menus
- Add to empty states ("Missing a feature? Let us know!")
- Context-aware feedback (automatically capture current page/module)

## Monitoring & Analytics

Track feedback metrics:

```sql
-- Most requested features
SELECT 
  user_query, 
  category, 
  upvotes, 
  created_at
FROM rari_feedback
WHERE category = 'feature_request'
ORDER BY upvotes DESC
LIMIT 10;

-- Feedback by status
SELECT 
  status, 
  COUNT(*) as count
FROM rari_feedback
GROUP BY status;

-- Average resolution time
SELECT 
  AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/86400) as avg_days_to_resolve
FROM rari_feedback
WHERE resolved = true;
```

## Best Practices

1. **Respond Promptly**: Update feedback status to show users their voice is heard
2. **Use Internal Notes**: Keep team aligned on feedback handling
3. **Upvote as Prioritization**: Use upvote counts to guide development priorities
4. **Regular Review**: Schedule weekly/monthly feedback review sessions
5. **Close the Loop**: Mark items as completed and consider notifying users
6. **Categorize Consistently**: Use consistent categories for better organization
7. **Context is Key**: Encourage detailed context in submissions

## Troubleshooting

### Notifications Not Sending

1. Check admin_notification_settings table for user preferences
2. Verify RESEND_API_KEY is set correctly
3. Check edge function logs: `supabase functions logs feedback-notification`
4. Ensure admin users have user_roles entries with 'admin' or 'manager' role

### Feedback Not Appearing

1. Check RLS policies are enabled
2. Verify user authentication
3. Check browser console for errors
4. Review Supabase logs for insert errors

### Upvotes Not Working

1. Verify user is authenticated
2. Check feedback_upvotes table for unique constraint violations
3. Review trigger function for upvote count updates

## Future Enhancements

Potential improvements to consider:

- [ ] User notifications when their feedback status changes
- [ ] Public feedback roadmap page
- [ ] Voting power based on user role/tenure
- [ ] AI-powered feedback categorization
- [ ] Duplicate detection using keyword matching
- [ ] Export feedback to CSV/PDF
- [ ] Feedback analytics dashboard with charts
- [ ] GitHub/JIRA integration for automatic issue creation
- [ ] User reputation system for quality feedback

## Support

For questions or issues with the feedback system:
1. Submit feedback using the system itself! (dogfooding)
2. Check Supabase logs for errors
3. Review this documentation
4. Contact the development team

---

**Version**: 1.0.0  
**Last Updated**: December 29, 2025  
**Maintained By**: ExotIQ Development Team
