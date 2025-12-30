# User Feedback System - Quick Start Guide

## 🚀 Quick Deploy (5 minutes)

### Step 1: Deploy Database
```bash
cd /workspace
supabase db push
```

### Step 2: Deploy Edge Function
```bash
supabase functions deploy feedback-notification
supabase secrets set RESEND_API_KEY=your_key_here
supabase secrets set APP_URL=https://your-app.com
```

### Step 3: Test It!
- Log in to your app
- Click "Feedback" button in header
- Submit test feedback
- Check Settings → User Feedback (admin only)

## 📋 What You Get

### For Users
- ✅ Easy feedback submission from header button
- ✅ Choose category (feature/bug/improvement/question)
- ✅ Set priority (low/medium/high/critical)
- ✅ Upvote others' feedback

### For Admins
- ✅ Centralized dashboard in Settings
- ✅ Filter & search capabilities
- ✅ Status tracking (new → completed)
- ✅ Email notifications for new feedback
- ✅ Assign to team members
- ✅ Internal notes

## 🎯 Quick Usage

### Submit Feedback (User)
1. Click "Feedback" in header
2. Select category and priority
3. Write description
4. Submit!

### Manage Feedback (Admin)
1. Go to Settings → User Feedback
2. View all feedback with filters
3. Click item to manage
4. Update status/priority/assignment
5. Save changes

## 📁 Files Created

```
Database:
  └─ supabase/migrations/20251229000000_user_feedback_system.sql

Backend:
  └─ supabase/functions/feedback-notification/index.ts

Frontend:
  ├─ src/components/feedback/FeedbackButton.tsx
  ├─ src/components/feedback/FeedbackSubmissionDialog.tsx
  ├─ src/components/feedback/FeedbackManagementDashboard.tsx
  └─ src/components/feedback/index.ts

Hooks:
  └─ src/hooks/useFeedback.ts

Modified:
  ├─ src/components/dashboard/DashboardHeader.tsx
  └─ src/components/dashboard/settings/SettingsLayout.tsx
```

## 🔧 Configuration

### Admin Notifications (Optional)
```sql
INSERT INTO admin_notification_settings (
  user_id, 
  email_new_feedback, 
  email_high_priority, 
  email_critical_priority
)
VALUES ('your-admin-user-id', true, true, true);
```

### Slack Integration (Optional)
Configure in notification_preferences table:
- Set slack_enabled = true
- Add slack_webhook_url
- Configure slack notification preferences

## 🎨 Customization

### Add Feedback Button Anywhere
```tsx
import { FeedbackButton } from "@/components/feedback";

<FeedbackButton 
  variant="outline"
  context={{ page: "my-page" }}
/>
```

### Use Hook Directly
```tsx
import { useFeedback } from "@/hooks/useFeedback";

const { submitFeedback } = useFeedback();

await submitFeedback({
  category: "feature_request",
  priority: "high",
  description: "My suggestion...",
  context: { extra: "data" }
});
```

## 📊 Database Tables

- `rari_feedback` - Main feedback table
- `feedback_comments` - Comments on feedback
- `feedback_attachments` - File attachments
- `feedback_upvotes` - User votes
- `admin_notification_settings` - Notification config

## 🔒 Security

- ✅ Row Level Security (RLS) enabled
- ✅ Users can only edit their own feedback
- ✅ Admins can edit all feedback
- ✅ Internal comments hidden from users

## 📖 Full Documentation

For complete details, see:
- `FEEDBACK_SYSTEM_README.md` - Full documentation
- `FEEDBACK_SYSTEM_IMPLEMENTATION.md` - Implementation details

## 🐛 Troubleshooting

**Feedback not appearing?**
- Check user is authenticated
- Verify RLS policies applied

**Notifications not working?**
- Check RESEND_API_KEY is set
- Verify admin has notification settings
- Check edge function logs

**Can't see admin dashboard?**
- Verify user has admin/manager role
- Check user_roles table

## ✨ Features Coming Soon

- [ ] User notifications on status changes
- [ ] File attachment uploads
- [ ] Comments & discussions
- [ ] Public feedback roadmap
- [ ] Duplicate detection
- [ ] Analytics dashboard

## 🎉 You're Done!

The feedback system is ready to use. Start collecting valuable user input and track feature requests with ease!

---

**Quick Links:**
- Submit Feedback: Header → "Feedback" button
- Manage Feedback: Settings → "User Feedback"
- Edge Function Logs: `supabase functions logs feedback-notification`
