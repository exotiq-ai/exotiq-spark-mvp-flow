

# Calendar Improvements — Review & Pushback

## Concerns with the Prompt

### 1. Multi-view layouts are a major scope expansion, not an "enhancement"

The prompt asks for 3-day columns, 7-day columns, and 3-month mini-calendars. This is essentially building **three new calendar views** on top of the existing month grid — each with its own layout, booking rendering, day-click behavior, and mobile responsiveness. The current component is already 737 lines. Adding three layout variants would likely double it.

**Recommendation**: Start with just **search/filter** (high value, low risk) and a single new view: **"Week" (7-day list)**. Skip the 3-day and 3-month views for now — they can be added later once the week view pattern is proven. A week list view is the simplest to build (vertical list of day sections) and most useful for operators checking upcoming bookings.

### 2. "Dimming" non-matching bookings is worse UX than filtering

The prompt says to dim non-matching bookings when searching. On a month grid where pills are already 10px text, dimming creates visual noise — users would see a grid full of semi-transparent pills they can't read. Better to **hide** non-matching bookings entirely and show a "Showing X of Y bookings" indicator, with a clear button to reset.

### 3. The 3-month view adds complexity with unclear value

A compact 3-month mini-calendar can't show booking pills — cells would be too small. It becomes a heatmap at best. If the goal is "see the bigger picture," the existing month navigation (prev/next) plus the month summary stats already cover this. A quarter overview is a separate feature (closer to a reporting/analytics view).

### 4. Date range presets conflict with month navigation

The prompt keeps the prev/today/next month buttons but adds range presets. If a user clicks "7 Days," what happens to prev/next? Do they shift by 7 days? By month? The interaction model gets confusing. Better to treat the presets as a **view mode toggle** where prev/next adapt to the active mode (shift by 1 day in week view, by 1 month in month view).

## Revised Plan

### Phase 1 (this ticket): Search filter + Week view toggle

#### 1. Search bar
Add a search `Input` above the calendar (next to the vehicle `Select`). Live-filters bookings by `customer_name`, `vehicle.name`, `vehicle.make`, `vehicle.model`. Matching is case-insensitive substring. Non-matching bookings are **hidden** (not dimmed). A pill shows "Showing X of Y" when search is active.

#### 2. View mode toggle: Month | Week
Add a two-button `ToggleGroup` next to the month title. 
- **Month** (default): existing grid, unchanged
- **Week**: 7-day vertical list starting from the current date. Each day is a section header with booking cards below (reusing `DayDetailContent` layout). Prev/next shift by 7 days in week mode.

#### 3. Adapt navigation
- Month mode: prev/next shift by month (existing behavior)
- Week mode: prev/next shift by 7 days, "Today" resets to current week

### Files Changed

| File | Change |
|------|--------|
| `src/components/dashboard/BookingCalendar.tsx` | Add search state, view mode toggle, week view renderer, adapt nav buttons |

### What's deferred

| Feature | Why |
|---------|-----|
| 3-day view | Low value vs week view; can add later as a third toggle option |
| 3-month view | Different use case (planning/reporting); better as a separate component |
| Dimming behavior | Replaced with hide + count indicator (cleaner UX) |

