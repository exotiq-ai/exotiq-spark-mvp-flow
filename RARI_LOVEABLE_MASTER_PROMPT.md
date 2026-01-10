# 🔧 RARI ENTERPRISE UI INTEGRATION - MASTER PROMPT

## Final Assembly, Quality Assurance & Production Readiness

**Date:** January 8, 2026  
**Purpose:** Integrate all Rari enterprise components, add error handling, and ensure production-ready quality

---

## CONTEXT

You have built 6 new components/features for the Rari AI assistant:
1. RariInsightsPanel - Displays AI-generated proactive insights
2. Quick Command Shortcuts - Pre-built voice command buttons
3. RariSidebar - Persistent sidebar that stays open during navigation
4. Insights Badge in Header - Notification count for unread insights
5. RariActionItems - Action item tracking widget
6. useRariContext hook - Entity context awareness

### Backend Already Deployed (DO NOT MODIFY)

The Supabase backend is fully deployed with these tables:
- `vehicle_expenses` (P/L tracking)
- `rari_insights` (proactive AI insights) 
- `customer_tags` (customer segmentation)
- `lead_sources` (ROI tracking)
- `scheduled_alerts` (maintenance reminders)
- `rari_preferences` (user preferences)

Database Views:
- `vehicle_profit_loss` (real-time P/L per vehicle)
- `location_comparison` (Miaxmi vs Scottsdale metrics)
- `customer_rfm` (RFM segmentation)

Database Functions:
- `mark_insight_read(insight_id)`
- `dismiss_insight(insight_id)`
- `action_insight(insight_id)`
- `get_unread_insight_count()`

Realtime Enabled On:
- `rari_insights`
- `scheduled_alerts`

---

## ANSWERS TO YOUR QUESTIONS

### 1. RariActionItems widget location:
→ **INSIDE THE SIDEBAR**, as a collapsible section at the bottom.

The action items should be contextual to the conversation happening in the sidebar. Users can expand to see pending items, collapse to focus on the conversation.

### 2. Voice interface context:
→ **YES**, RariWidgetInterface should receive `contextSummary` and pass it to ElevenLabs when starting conversations. This enables Rari to know "the user is currently viewing Booking #123" and respond accordingly.

Modify the elevenlabs-session edge function call to include:
```typescript
{
  userId: user.id,
  context: {
    currentEntity: contextSummary,
    recentEntities: recentEntities.slice(0, 3)
  }
}
```

### 3. Recent entities display:
→ **YES**, add a small "Recent" section in the sidebar header (below the context chip). Show the last 3 viewed entities as small clickable pills/chips. This helps users quickly reference things they were just looking at.

Example UI:
```
[📋 Bugatti Booking] [👤 John Smith] [🚗 Ferrari SF90]
```

Clicking navigates to that entity while keeping sidebar open.

---

## CLEANUP ACTIONS (Confirmed)

| Action | File | Notes |
|--------|------|-------|
| DELETE | `src/hooks/useRariActionItems.ts` | Replaced by insight-based action items |
| REMOVE | Unused supabase import in RariActionItems.tsx | Clean up |
| NOTE | elevenlabs-session context | Will be used - backend team handles edge function update |

---

## STEP 1: INTEGRATION CHECKLIST

### 1.1 Dashboard Integration
- [ ] Replace the Rari Dialog in `src/pages/Dashboard.tsx` with RariSidebar
- [ ] Remove the old Dialog/DialogContent wrapper for Rari
- [ ] Keep the FAB trigger but have it toggle RariSidebar instead
- [ ] Add RariInsightsPanel to DashboardOverview.tsx (below AIInsightWidget or as a new section)
- [ ] Add insights badge to the main header navigation

### 1.2 Sidebar Integration
- [ ] RariSidebar should contain:
  - Quick Command Shortcuts at the top
  - Recent Entities pills (last 3 viewed)
  - RariWidgetInterface (existing) as main content
  - RariActionItems at the bottom (collapsible)
- [ ] Sidebar should use useRariContext to track current entity
- [ ] When user navigates via EntityLink, sidebar stays open

### 1.3 Context Flow
- [ ] useRariContext watches URL params: bookingId, customerId, vehicleId
- [ ] When detected, fetch entity data and store in context
- [ ] Pass context to RariSidebar for display
- [ ] Pass contextSummary to RariWidgetInterface for ElevenLabs

---

## STEP 2: ERROR BOUNDARIES & FALLBACKS

### 2.1 Create Error Boundary Wrapper

Create `src/components/rari/RariErrorBoundary.tsx`:

```tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class RariErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Rari Error]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6 text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h3 className="font-semibold mb-2">
            {this.props.fallbackMessage || 'Rari encountered an issue'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Don't worry, your conversation history is saved.
          </p>
          <Button onClick={this.handleReset} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </Card>
      );
    }

    return this.props.children;
  }
}
```

### 2.2 Wrap All Rari Components
- Wrap RariSidebar content with RariErrorBoundary
- Wrap RariInsightsPanel with RariErrorBoundary
- Wrap RariActionItems with RariErrorBoundary

### 2.3 Add Loading States
Ensure all async operations have:
- Loading skeleton/spinner
- Error state with retry button
- Empty state with helpful message

---

## STEP 3: SAFETY NETS FOR VOICE CONNECTION

### 3.1 Connection Recovery

In RariSidebar or RariWidgetInterface, add auto-reconnect with exponential backoff:

```tsx
const [reconnectAttempts, setReconnectAttempts] = useState(0);
const MAX_RECONNECT_ATTEMPTS = 3;

useEffect(() => {
  if (status.isActive === false && reconnectAttempts < MAX_RECONNECT_ATTEMPTS && wasConnected) {
    const timeout = Math.pow(2, reconnectAttempts) * 1000; // 1s, 2s, 4s
    const timer = setTimeout(() => {
      console.log(`[Rari] Attempting reconnect ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`);
      handleReconnect();
      setReconnectAttempts(prev => prev + 1);
    }, timeout);
    return () => clearTimeout(timer);
  }
}, [status.isActive, reconnectAttempts]);
```

### 3.2 Graceful Degradation

If voice fails, show text input fallback:

```tsx
{voiceError && (
  <div className="p-4 border-t">
    <p className="text-sm text-muted-foreground mb-2">
      Voice unavailable. You can type your question:
    </p>
    <div className="flex gap-2">
      <Input 
        placeholder="Ask Rari anything..."
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
      />
      <Button onClick={handleTextSubmit}>Send</Button>
    </div>
  </div>
)}
```

---

## STEP 4: REALTIME SUBSCRIPTION SETUP

### 4.1 Insights Realtime

In useRariInsightsCount or RariInsightsPanel:

```tsx
useEffect(() => {
  const channel = supabase
    .channel('rari-insights-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'rari_insights',
        filter: `user_id=eq.${user?.id}`,
      },
      (payload) => {
        console.log('[Rari Insights] Realtime update:', payload);
        if (payload.eventType === 'INSERT') {
          setInsights(prev => [payload.new as RariInsight, ...prev]);
          if (payload.new.priority === 'urgent' || payload.new.priority === 'high') {
            toast.info(`New insight: ${payload.new.title}`);
          }
        } else if (payload.eventType === 'UPDATE') {
          setInsights(prev => 
            prev.map(i => i.id === payload.new.id ? payload.new as RariInsight : i)
          );
        } else if (payload.eventType === 'DELETE') {
          setInsights(prev => prev.filter(i => i.id !== payload.old.id));
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.id]);
```

---

## STEP 5: NAVIGATION PRESERVATION

### 5.1 Prevent Sidebar Close on Navigation

In EntityLink.tsx, ensure navigation uses search params (already implemented) and sidebar state persists.

### 5.2 Persist Sidebar State

In RariSidebar:

```tsx
// Persist open state
useEffect(() => {
  localStorage.setItem('rari-sidebar-open', isOpen.toString());
}, [isOpen]);

// Restore on mount
useEffect(() => {
  const wasOpen = localStorage.getItem('rari-sidebar-open') === 'true';
  if (wasOpen) {
    setIsOpen(true);
  }
}, []);
```

---

## STEP 6: ACCESSIBILITY AUDIT

### 6.1 Keyboard Navigation
- [ ] RariSidebar can be opened/closed with keyboard shortcut (Cmd/Ctrl + R)
- [ ] Quick Commands navigable with arrow keys
- [ ] Focus trap when sidebar is open
- [ ] Escape key closes sidebar (but keeps voice active)

### 6.2 ARIA Labels
- [ ] All buttons have aria-label
- [ ] Live regions for voice status changes
- [ ] Screen reader announcements for new insights

Add to RariSidebar:
```tsx
<div 
  role="complementary" 
  aria-label="Rari AI Assistant"
  aria-live="polite"
>
  {/* Sidebar content */}
</div>
```

---

## STEP 7: PERFORMANCE OPTIMIZATION

### 7.1 Lazy Load Components

```tsx
const RariInsightsPanel = lazy(() => import('./RariInsightsPanel'));
const RariActionItems = lazy(() => import('./RariActionItems'));

// In render:
<Suspense fallback={<Skeleton className="h-40" />}>
  <RariInsightsPanel />
</Suspense>
```

### 7.2 Debounce Context Updates

```tsx
const debouncedContext = useDebounce(currentContext, 300);

useEffect(() => {
  if (debouncedContext.id) {
    // Fetch entity data
  }
}, [debouncedContext]);
```

### 7.3 Memoize Expensive Computations

```tsx
const filteredInsights = useMemo(() => 
  insights.filter(i => !i.is_dismissed && !i.is_read),
  [insights]
);
```

---

## STEP 8: FINAL INTEGRATION IN DASHBOARD

Update `src/pages/Dashboard.tsx`:

```tsx
// At the top, add imports
import { RariSidebar } from '@/components/rari/RariSidebar';
import { RariErrorBoundary } from '@/components/rari/RariErrorBoundary';
import { useRariContext } from '@/hooks/useRariContext';

// In the component
const Dashboard = () => {
  const [rariOpen, setRariOpen] = useState(false);
  const rariContext = useRariContext();
  
  // ... existing code ...

  return (
    <div className="min-h-screen">
      {/* ... existing layout ... */}
      
      {/* Replace old Rari Dialog with Sidebar */}
      <RariErrorBoundary fallbackMessage="Rari is temporarily unavailable">
        <RariSidebar 
          isOpen={rariOpen}
          onOpenChange={setRariOpen}
          context={rariContext}
        />
      </RariErrorBoundary>
      
      {/* Keep FAB but update onClick */}
      <FloatingActionMenu 
        actions={[
          ...fabActions,
          {
            icon: Sparkles,
            label: 'Ask Rari',
            onClick: () => setRariOpen(true),
          }
        ]} 
      />
    </div>
  );
};
```

---

## STEP 9: TYPE DEFINITIONS

Create/update `src/types/rari.ts`:

```typescript
export interface RariInsight {
  id: string;
  user_id: string;
  team_id?: string;
  insight_type: 'pricing' | 'utilization' | 'maintenance' | 'revenue' | 'customer' | 'demand' | 'compliance' | 'opportunity';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  action_items: ActionItem[];
  related_entity_type?: 'vehicle' | 'booking' | 'customer' | 'location' | 'fleet';
  related_entity_id?: string;
  metric_value?: number;
  metric_change?: number;
  is_read: boolean;
  is_dismissed: boolean;
  is_actioned: boolean;
  actioned_at?: string;
  created_at: string;
  expires_at?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  source?: string;
}

export interface RariContext {
  currentEntity: {
    type: 'booking' | 'customer' | 'vehicle' | null;
    id: string | null;
    data: any;
    loadedAt: Date | null;
  };
  recentEntities: Array<{
    type: string;
    id: string;
    name: string;
    viewedAt: Date;
  }>;
}

export interface RariPreferences {
  id: string;
  user_id: string;
  default_location?: string;
  preferred_metrics: string[];
  notification_frequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'never';
  voice_personality: 'professional' | 'casual' | 'concise' | 'detailed';
  auto_insights: boolean;
  insight_types: string[];
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  timezone: string;
}

export type RariSidebarState = 'closed' | 'minimized' | 'open';
```

---

## STEP 10: TESTING CHECKLIST

Run through these scenarios after implementation:

### Voice Connection
- [ ] Start voice conversation
- [ ] Speak a query, verify response
- [ ] Click entity link in transcript
- [ ] Verify navigation happens WITHOUT disconnecting voice
- [ ] Continue conversation with context ("extend this booking")
- [ ] End conversation, verify cleanup

### Insights
- [ ] Insights panel loads with data
- [ ] Clicking insight shows details
- [ ] Dismiss insight removes it
- [ ] Mark as read updates badge count
- [ ] Realtime: Insert new insight in Supabase, verify it appears

### Quick Commands
- [ ] Click quick command when disconnected → starts conversation + sends command
- [ ] Click quick command when connected → sends command immediately
- [ ] Visual feedback on click

### Sidebar
- [ ] Open/close animation smooth
- [ ] Minimize to floating orb
- [ ] Expand from orb
- [ ] State persists on page navigation
- [ ] Mobile: swipe to open/close

### Context
- [ ] Navigate to booking → context shows "Viewing: Booking #123"
- [ ] Navigate to customer → context updates
- [ ] Recent entities display and are clickable
- [ ] Clear context button works

### Error Handling
- [ ] Disconnect WiFi → graceful degradation message
- [ ] Supabase error → error boundary catches
- [ ] Voice permission denied → helpful error message

---

## FINAL NOTES

1. **Backend is deployed** - DO NOT modify Edge Functions
2. **All database tables exist** with RLS policies
3. **Realtime is enabled** on rari_insights and scheduled_alerts
4. **Use existing hooks**: useAuth, useToast, useModuleNavigation
5. **Match design system**: glass-card, gulf-blue accent, dark mode support
6. **Test both viewports**: desktop and mobile
7. **Export all new components** from their index files

After completing integration, run:
```bash
npm run build   # Check for TypeScript errors
npm run lint    # Check for linting issues
```

Manual testing of all scenarios above.

---

## SUCCESS CRITERIA

When complete, a user should be able to:
1. Open Rari sidebar from FAB
2. See their current context (if viewing a booking/customer/vehicle)
3. Use quick commands or speak naturally
4. Click entity links in Rari's responses
5. Navigate to those entities WITHOUT disconnecting
6. Continue the conversation with context awareness
7. See proactive insights in the sidebar and dashboard
8. Track and complete action items

**This transforms Rari from a modal chatbot into a persistent AI copilot that accompanies the user throughout their workflow.**

---

*Generated by Cursor AI - Ready for Loveable Integration*
