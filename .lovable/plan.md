
# Migrate Onboarding Progress to Database with localStorage Fallback

## Overview

This migration replaces localStorage-only persistence with a database-first approach that falls back to localStorage when network requests fail. This gives users the best of both worlds: cross-device sync when online, and uninterrupted progress when offline.

---

## Implementation Strategy

### Architecture: Database-First with localStorage Fallback

```text
User makes a change
        |
        v
+------------------+
|  Save to Database |-----> Success? ---> Update localStorage cache
+------------------+           |
        |                      |
        v                      |
   Network Error?              |
        |                      |
        v                      |
+-------------------+          |
| Save to localStorage |        |
| (fallback mode)    |          |
+-------------------+          |
        |                      |
        +----------------------+
                   |
                   v
           On next load:
           Check for unsynced localStorage data
           and attempt to sync to database
```

---

## Step-by-Step Implementation

### Step 1: Enhance useOnboardingProgress Hook

Add localStorage fallback and sync detection:

**File: `src/hooks/useOnboardingProgress.ts`**

New capabilities:
- `isOffline` state to track network status
- `hasPendingSync` to indicate unsynced localStorage data
- `syncPendingChanges()` to push localStorage data to database when back online
- Fallback write to localStorage when database save fails
- On load: check localStorage for pending changes and attempt sync

```typescript
// New state
const [isOffline, setIsOffline] = useState(false);
const [hasPendingSync, setHasPendingSync] = useState(false);

// localStorage keys for fallback
const FALLBACK_KEY = `onboarding-fallback-${user?.id}`;
const PENDING_SYNC_KEY = `onboarding-pending-sync-${user?.id}`;
```

**Modified updateProgress function:**
```typescript
try {
  const { error } = await supabase
    .from('onboarding_progress')
    .update(dbUpdates)
    .eq('user_id', user.id);

  if (error) throw error;

  // Success - also update localStorage cache
  localStorage.setItem(FALLBACK_KEY, JSON.stringify({
    currentStep: updates.currentStep ?? progress?.currentStep,
    formData: dbUpdates.form_data ?? progress?.formData,
    stepsCompleted: updates.stepsCompleted ?? progress?.stepsCompleted,
  }));
  localStorage.removeItem(PENDING_SYNC_KEY);
  setIsOffline(false);

} catch (error) {
  // Network failure - fall back to localStorage
  devError('[OnboardingProgress] DB save failed, using localStorage fallback:', error);
  
  localStorage.setItem(FALLBACK_KEY, JSON.stringify({
    currentStep: updates.currentStep ?? progress?.currentStep,
    formData: updates.formData ? { ...progress?.formData, ...updates.formData } : progress?.formData,
    stepsCompleted: updates.stepsCompleted ?? progress?.stepsCompleted,
  }));
  localStorage.setItem(PENDING_SYNC_KEY, 'true');
  
  setIsOffline(true);
  setHasPendingSync(true);
}
```

**New sync function:**
```typescript
const syncPendingChanges = useCallback(async () => {
  if (!user?.id) return false;
  
  const pendingData = localStorage.getItem(FALLBACK_KEY);
  const hasPending = localStorage.getItem(PENDING_SYNC_KEY);
  
  if (!pendingData || !hasPending) return true;
  
  try {
    const parsed = JSON.parse(pendingData);
    const { error } = await supabase
      .from('onboarding_progress')
      .update({
        current_step: parsed.currentStep,
        form_data: parsed.formData,
        steps_completed: parsed.stepsCompleted,
      })
      .eq('user_id', user.id);
    
    if (error) throw error;
    
    localStorage.removeItem(PENDING_SYNC_KEY);
    setHasPendingSync(false);
    setIsOffline(false);
    return true;
  } catch {
    return false;
  }
}, [user?.id]);
```

**Auto-sync on mount and online event:**
```typescript
useEffect(() => {
  const handleOnline = () => syncPendingChanges();
  window.addEventListener('online', handleOnline);
  
  // Check for pending sync on mount
  if (localStorage.getItem(PENDING_SYNC_KEY)) {
    setHasPendingSync(true);
    syncPendingChanges();
  }
  
  return () => window.removeEventListener('online', handleOnline);
}, [syncPendingChanges]);
```

---

### Step 2: Update Onboarding.tsx

**Remove:**
- `useLocalStorage` import (line 18)
- localStorage hooks (lines 74-77)
- localStorage sync effects (lines 162-173)
- localStorage cleanup in handleComplete (lines 361-363)

**Add:**
- `useOnboardingProgress` import and hook usage
- Local UI state that syncs with database values
- Sync from database on load
- Step change handler that persists to database
- Offline indicator in UI

**Key changes:**

```typescript
// Replace imports
import { useOnboardingProgress } from '@/hooks/useOnboardingProgress';
// Remove: import { useLocalStorage } from '@/hooks/useLocalStorage';

// Replace state management (lines 74-82)
const {
  currentStep: dbCurrentStep,
  formData: dbFormData,
  isLoading: progressLoading,
  isSaving,
  isOffline,
  hasPendingSync,
  updateProgress,
  updateFormDataDebounced,
  goToStep,
  completeStep,
  markComplete,
  syncPendingChanges,
} = useOnboardingProgress();

// Local state for immediate UI response
const [step, setStep] = useState<number>(1);
const [formData, setFormData] = useState<OnboardingFormData>(initialFormData);

// Sync from database on load
useEffect(() => {
  if (!progressLoading && !isEditMode) {
    setStep(dbCurrentStep);
    if (dbFormData && Object.keys(dbFormData).length > 0) {
      setFormData(prev => ({ ...prev, ...dbFormData }));
    }
  }
}, [progressLoading, dbCurrentStep, dbFormData, isEditMode]);
```

**Wrap step transitions:**
```typescript
// New handler for step changes
const handleStepChange = async (newStep: number, markPreviousComplete = true) => {
  setStep(newStep); // Immediate UI update
  
  if (!isEditMode) {
    await goToStep(newStep);
    if (markPreviousComplete && newStep > 1) {
      await completeStep(newStep - 1);
    }
  }
};

// Update all setStep(X) calls to use handleStepChange:
// Line 201: handleStepChange(2)
// Line 290: handleStepChange(3)
// Line 323: handleStepChange(4)
// Line 337: handleStepChange(4, false) // skip case
// Line 967: handleStepChange(4) // import complete
// Line 985: handleStepChange(4) // photo wizard complete
```

**Update form data handler:**
```typescript
const updateFormData = <K extends keyof OnboardingFormData>(field: K, value: OnboardingFormData[K]) => {
  const updated = { ...formData, [field]: value };
  setFormData(updated);
  
  // Auto-save to database (debounced) - fallback handled in hook
  if (!isEditMode) {
    updateFormDataDebounced({ [field]: value });
  }
};
```

**Update handleComplete:**
```typescript
const handleComplete = async () => {
  if (!user) return;
  setLoading(true);

  try {
    // Mark profile as completed
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    if (error) throw error;

    // Mark onboarding progress as complete
    await markComplete();
    await completeStep(4);

    // Fire confetti... (unchanged)
  }
};
```

**Add loading state and offline indicator:**
```typescript
// Update loading check
if (initialLoading || (progressLoading && !isEditMode)) {
  return (
    <div className="min-h-screen bg-gradient-to-br...">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

// Add sync indicator after the progress bar (around line 439)
{(isSaving || hasPendingSync) && (
  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-4">
    {isOffline ? (
      <>
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        Saved locally — will sync when online
      </>
    ) : isSaving ? (
      <>
        <Loader2 className="w-3 h-3 animate-spin" />
        Saving...
      </>
    ) : null}
  </div>
)}
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useOnboardingProgress.ts` | Add localStorage fallback, sync detection, online/offline handling |
| `src/pages/Onboarding.tsx` | Replace localStorage with database hook, add offline indicator |

---

## New Hook Return Values

```typescript
return {
  // Existing
  progress,
  isLoading,
  error,
  isSaving,
  lastSavedAt,
  currentStep,
  stepsCompleted,
  formData,
  onboardingType,
  initializeProgress,
  updateProgress,
  updateFormDataDebounced,
  completeStep,
  goToStep,
  markComplete,
  refetch,
  
  // New for fallback
  isOffline,          // true if last save failed
  hasPendingSync,     // true if localStorage has unsynced data
  syncPendingChanges, // manual sync trigger
};
```

---

## User Experience

| Scenario | Behavior |
|----------|----------|
| **Normal flow** | Saves to database, updates localStorage cache |
| **Network fails** | Shows amber indicator, saves to localStorage |
| **Comes back online** | Auto-syncs localStorage data to database |
| **Switch devices (was offline)** | Loads from database (localStorage data is device-specific) |
| **Close tab while saving** | Data preserved in localStorage, syncs on return |

---

## Edge Cases Handled

1. **Tab closed during debounce** - localStorage fallback ensures data survives
2. **Network timeout** - Caught as error, falls back to localStorage
3. **Database unreachable on load** - Uses localStorage cache if available
4. **Concurrent edits on multiple devices** - Last write wins (database is source of truth when online)

---

## Testing Checklist

- [ ] New user: progress saved to database
- [ ] Existing user: resumes from database step
- [ ] Network offline: saves to localStorage, shows indicator
- [ ] Network restored: auto-syncs pending changes
- [ ] Form changes auto-save after 2s debounce
- [ ] Step transitions immediately persist
- [ ] Edit mode still works (skips database persistence)
- [ ] Cross-device: progress synced via database
