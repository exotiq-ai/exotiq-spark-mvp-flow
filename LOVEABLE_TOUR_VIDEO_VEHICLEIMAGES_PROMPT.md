# 🎯 LOVEABLE MASTER PROMPT: Tour, Onboarding Video & Vehicle Thumbnails

**Priority**: HIGH  
**Estimated Effort**: Medium  
**Files Affected**: Multiple components  

---

## 📋 EXECUTIVE SUMMARY

This prompt covers three interconnected UX enhancements to elevate Exotiq Command Center to world-class status:

1. **Interactive Module Tour** - Transform the existing tooltip-based tour into an immersive, navigational experience that takes users INTO each module
2. **Onboarding Video Popup** - Add a welcome video modal (ElevenLabs-style) for new users
3. **Adaptive Vehicle Thumbnails** - Create compact, pill-sized vehicle images for use across the app (Airbnb-style)

---

## 🎬 FEATURE 1: Interactive Module Tour (2-Minute Core Features)

### Current State
The existing `DashboardOnboarding.tsx` shows tooltip cards that describe modules but **doesn't navigate users to them**. Users see descriptions but don't experience the actual UI.

**File**: `src/components/onboarding/DashboardOnboarding.tsx`

### Desired Behavior
Each tour step should:
1. **Navigate** the user to the actual module
2. **Highlight** 2-3 key features within that module
3. **Show contextual tooltips** pointing at real UI elements
4. Use **spotlight/focus overlays** to draw attention to specific areas
5. Allow **"Try it"** micro-interactions where appropriate

### Design Inspiration
- **Notion** - Progressive disclosure with interactive elements
- **Figma** - Contextual tooltips that follow the cursor
- **Linear** - Clean, minimal tour with actual UI interaction
- **Stripe Dashboard** - Feature callouts with subtle animations

### Implementation Specification

#### New Component: `InteractiveModuleTour.tsx`

```typescript
interface TourStep {
  id: string;
  module: string; // 'motoriq' | 'book' | 'pulse' | 'vault' | 'core' | 'dashboard'
  title: string;
  description: string;
  icon: LucideIcon;
  spotlights: SpotlightTarget[]; // Elements to highlight
  microInteraction?: MicroInteraction; // Optional "try it" action
  duration?: number; // Auto-advance after X seconds (optional)
}

interface SpotlightTarget {
  selector: string; // CSS selector for element
  tooltip: string; // What to say about this element
  position: 'top' | 'bottom' | 'left' | 'right';
  pulse?: boolean; // Add attention pulse animation
}

interface MicroInteraction {
  type: 'click' | 'hover' | 'input';
  target: string; // CSS selector
  prompt: string; // "Click here to see pricing recommendations"
  onComplete: () => void;
}
```

#### Tour Flow (7 Steps, ~2 Minutes)

```typescript
const INTERACTIVE_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    module: 'dashboard',
    title: 'Welcome to Your Command Center! 🎉',
    description: 'Let\'s take a quick 2-minute tour of the key features that will help you run your fleet like a pro.',
    icon: Sparkles,
    spotlights: [],
    duration: 5000, // 5 seconds, then auto-advance
  },
  {
    id: 'motoriq-pricing',
    module: 'motoriq',
    title: 'MotorIQ - AI-Powered Pricing',
    description: 'Get instant pricing recommendations based on demand, events, and market trends.',
    icon: TrendingUp,
    spotlights: [
      {
        selector: '[data-tour="pricing-card"]',
        tooltip: 'AI analyzes 50+ factors to suggest optimal rates',
        position: 'right',
        pulse: true,
      },
      {
        selector: '[data-tour="demand-forecast"]',
        tooltip: 'See upcoming demand spikes from events',
        position: 'bottom',
      },
    ],
    microInteraction: {
      type: 'hover',
      target: '[data-tour="vehicle-row"]',
      prompt: 'Hover over a vehicle to see its recommendation',
      onComplete: () => {},
    },
  },
  {
    id: 'book-calendar',
    module: 'book',
    title: 'Book - Your Reservation Hub',
    description: 'Manage all bookings, view your calendar, and handle pickups/returns.',
    icon: Calendar,
    spotlights: [
      {
        selector: '[data-tour="calendar-view"]',
        tooltip: 'Drag bookings to reschedule instantly',
        position: 'top',
        pulse: true,
      },
      {
        selector: '[data-tour="upcoming-pickups"]',
        tooltip: 'Today\'s pickups at a glance',
        position: 'left',
      },
    ],
  },
  {
    id: 'pulse-analytics',
    module: 'pulse',
    title: 'Pulse - Real-Time Analytics',
    description: 'Monitor fleet performance with live dashboards and trend analysis.',
    icon: BarChart3,
    spotlights: [
      {
        selector: '[data-tour="revenue-chart"]',
        tooltip: 'Track revenue trends over any time period',
        position: 'bottom',
        pulse: true,
      },
      {
        selector: '[data-tour="utilization-gauge"]',
        tooltip: 'Fleet utilization at a glance',
        position: 'right',
      },
    ],
  },
  {
    id: 'vault-compliance',
    module: 'vault',
    title: 'Vault - Compliance & Documents',
    description: 'Never miss a renewal. Track insurance, registrations, and inspections.',
    icon: Shield,
    spotlights: [
      {
        selector: '[data-tour="expiring-docs"]',
        tooltip: 'Alerts for upcoming expirations',
        position: 'top',
        pulse: true,
      },
    ],
  },
  {
    id: 'rari-assistant',
    module: 'dashboard',
    title: 'Meet Rari - Your AI Assistant',
    description: 'Ask anything about your fleet using voice or text. Rari knows your data.',
    icon: Brain,
    spotlights: [
      {
        selector: '[data-tour="rari-fab"]',
        tooltip: 'Click anytime to ask Rari a question',
        position: 'left',
        pulse: true,
      },
    ],
    microInteraction: {
      type: 'click',
      target: '[data-tour="rari-fab"]',
      prompt: 'Try clicking to open Rari!',
      onComplete: () => {},
    },
  },
  {
    id: 'complete',
    module: 'dashboard',
    title: 'You\'re Ready to Roll! 🚀',
    description: 'Explore your dashboard. Need help? Just ask Rari anytime.',
    icon: Trophy,
    spotlights: [],
  },
];
```

#### Visual Design Requirements

1. **Spotlight Overlay**
   - Dark backdrop (`bg-black/70`) with a "cutout" around highlighted elements
   - Use CSS `clip-path` or SVG mask to create spotlight effect
   - Subtle glow/pulse animation on highlighted elements

2. **Tooltip Cards**
   - Floating card connected to spotlight with a tail/arrow
   - Glassmorphism style: `bg-background/80 backdrop-blur-lg`
   - Smooth entrance animation (scale + fade)

3. **Progress Indicator**
   - Horizontal progress bar at top of overlay
   - Step dots with current step highlighted
   - Time estimate: "Step 2 of 7 • ~1:30 remaining"

4. **Navigation Controls**
   - Back / Next buttons
   - Skip Tour link
   - Keyboard navigation (← → keys, Escape to skip)

5. **Module Transitions**
   - When navigating to a new module, use existing `handleModuleChange` 
   - Wait for module to render before showing spotlights (use `MutationObserver` or timeout)
   - Smooth scroll to spotlighted elements

#### Data Attributes to Add

Add these `data-tour` attributes to existing components:

```tsx
// MotorIQEnhanced.tsx
<DynamicPricingCard data-tour="pricing-card" ... />
<DemandForecastCard data-tour="demand-forecast" ... />
<div data-tour="vehicle-row" ... />

// BookEnhanced.tsx  
<BookingCalendar data-tour="calendar-view" ... />
<UpcomingPickupsCard data-tour="upcoming-pickups" ... />

// PulseEnhanced.tsx
<RevenueChart data-tour="revenue-chart" ... />
<UtilizationGauge data-tour="utilization-gauge" ... />

// VaultEnhanced.tsx
<ExpiringDocuments data-tour="expiring-docs" ... />

// Dashboard.tsx (Rari FAB)
<motion.button data-tour="rari-fab" ... />
```

#### Restart Tour from Settings

Update `MyAccountSection.tsx` to use the new tour:

```tsx
<Button 
  variant="outline" 
  onClick={() => {
    // Clear tour completion state
    localStorage.removeItem(`interactive-tour-complete-${user?.id}`);
    // Navigate to dashboard and trigger tour
    navigate('/dashboard?startTour=true');
  }}
>
  <RotateCcw className="w-4 h-4 mr-2" />
  Restart Tour
</Button>
```

---

## 🎥 FEATURE 2: Onboarding Video Popup

### Inspiration
**ElevenLabs** has an excellent onboarding video that plays for new users - clean modal, autoplay, skip option, and direct CTA.

### Implementation

#### New Component: `WelcomeVideoModal.tsx`

```tsx
interface WelcomeVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  videoUrl: string;
  posterUrl?: string;
}

export const WelcomeVideoModal = ({
  open,
  onOpenChange,
  onComplete,
  videoUrl,
  posterUrl,
}: WelcomeVideoModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Auto-hide controls after 3 seconds of playback
  useEffect(() => {
    if (isPlaying) {
      const timer = setTimeout(() => setShowControls(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isPlaying]);

  const handleVideoEnd = () => {
    onComplete();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
        {/* Video Container */}
        <div 
          className="relative aspect-video"
          onMouseMove={() => setShowControls(true)}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl}
            className="w-full h-full object-cover"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleVideoEnd}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              setProgress((video.currentTime / video.duration) * 100);
            }}
            autoPlay
            playsInline
          />

          {/* Overlay Controls */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/40"
              >
                {/* Top Bar */}
                <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Logo size="sm" variant="white" />
                    <Badge variant="secondary" className="bg-white/20 text-white">
                      Welcome Tour
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/20"
                    onClick={() => onOpenChange(false)}
                  >
                    Skip <X className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                {/* Center Play/Pause */}
                <button
                  className="absolute inset-0 flex items-center justify-center"
                  onClick={() => {
                    if (videoRef.current?.paused) {
                      videoRef.current.play();
                    } else {
                      videoRef.current?.pause();
                    }
                  }}
                >
                  {!isPlaying && (
                    <div className="w-20 h-20 rounded-full bg-white/30 backdrop-blur flex items-center justify-center">
                      <Play className="h-10 w-10 text-white ml-1" />
                    </div>
                  )}
                </button>

                {/* Bottom Progress */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <Progress value={progress} className="h-1 bg-white/30" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA Footer */}
        <div className="p-6 bg-background">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Ready to explore?</h3>
              <p className="text-sm text-muted-foreground">
                Take the interactive tour or dive right in
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Skip for Now
              </Button>
              <Button 
                className="btn-premium"
                onClick={() => {
                  onOpenChange(false);
                  // Trigger interactive tour
                  localStorage.setItem('trigger-tour', 'true');
                  window.dispatchEvent(new CustomEvent('start-tour'));
                }}
              >
                Start Tour <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

#### Video Requirements

1. **Duration**: 30-60 seconds max
2. **Content**: 
   - Quick brand intro (5s)
   - Dashboard overview flythrough (15s)
   - Key features highlight (20s)
   - CTA to start tour (5s)
3. **Style**: 
   - Screen recording with motion graphics overlay
   - Voiceover (can use ElevenLabs to generate!)
   - Upbeat background music
4. **Hosting**: Upload to Supabase Storage or use a CDN

#### Integration in Dashboard

```tsx
// Dashboard.tsx
const [showWelcomeVideo, setShowWelcomeVideo] = useState(false);

useEffect(() => {
  const hasSeenVideo = localStorage.getItem(`welcome-video-seen-${user?.id}`);
  if (!hasSeenVideo && user?.id) {
    // Small delay to let dashboard load
    setTimeout(() => setShowWelcomeVideo(true), 1500);
  }
}, [user?.id]);

// In render:
<WelcomeVideoModal
  open={showWelcomeVideo}
  onOpenChange={setShowWelcomeVideo}
  onComplete={() => {
    localStorage.setItem(`welcome-video-seen-${user?.id}`, 'true');
  }}
  videoUrl="/videos/welcome-tour.mp4"
  posterUrl="/videos/welcome-poster.jpg"
/>
```

---

## 🚗 FEATURE 3: Adaptive Vehicle Thumbnails (Airbnb-Style)

### Current State
Vehicle images are only used in:
- `VehicleImageDialog` (full-size modal)
- `BookEnhanced` (96x96 square thumbnails)

Images are stored in `src/assets/vehicles/` and mapped via `vehicleImageMapping.ts`.

### Desired Behavior
Create a **reusable vehicle thumbnail component** that:
1. Scales to any size (icon, pill, card, full)
2. Has consistent styling across the app
3. Supports loading states and fallbacks
4. Optimizes image loading (lazy load, srcset)

### Design Inspiration
- **Airbnb** - Rounded listing thumbnails with subtle shadows
- **Turo** - Car thumbnails with status badges
- **Uber** - Compact vehicle icons in ride selection

### Implementation

#### New Component: `VehicleThumbnail.tsx`

```tsx
import { getVehicleImage } from '@/lib/vehicleImageMapping';
import { cn } from '@/lib/utils';
import { Car } from 'lucide-react';

type ThumbnailSize = 'icon' | 'pill' | 'sm' | 'md' | 'lg' | 'full';

interface VehicleThumbnailProps {
  vehicleName: string;
  size?: ThumbnailSize;
  className?: string;
  showFallback?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode; // Status badge overlay
  loading?: 'lazy' | 'eager';
}

const sizeConfig: Record<ThumbnailSize, { 
  width: string; 
  height: string; 
  iconSize: string;
  rounded: string;
}> = {
  icon: { 
    width: 'w-8', 
    height: 'h-8', 
    iconSize: 'h-4 w-4',
    rounded: 'rounded-lg',
  },
  pill: { 
    width: 'w-12', 
    height: 'h-8', 
    iconSize: 'h-4 w-4',
    rounded: 'rounded-full',
  },
  sm: { 
    width: 'w-16', 
    height: 'h-12', 
    iconSize: 'h-5 w-5',
    rounded: 'rounded-xl',
  },
  md: { 
    width: 'w-24', 
    height: 'h-16', 
    iconSize: 'h-6 w-6',
    rounded: 'rounded-xl',
  },
  lg: { 
    width: 'w-32', 
    height: 'h-24', 
    iconSize: 'h-8 w-8',
    rounded: 'rounded-2xl',
  },
  full: { 
    width: 'w-full', 
    height: 'aspect-[16/10]', 
    iconSize: 'h-12 w-12',
    rounded: 'rounded-2xl',
  },
};

export const VehicleThumbnail = ({
  vehicleName,
  size = 'md',
  className,
  showFallback = true,
  onClick,
  badge,
  loading = 'lazy',
}: VehicleThumbnailProps) => {
  const imageUrl = getVehicleImage(vehicleName);
  const config = sizeConfig[size];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerClasses = cn(
    'relative overflow-hidden bg-muted flex-shrink-0',
    config.width,
    config.height,
    config.rounded,
    onClick && 'cursor-pointer group',
    className
  );

  // No image or error - show fallback
  if (!imageUrl || imageError) {
    if (!showFallback) return null;
    
    return (
      <div className={cn(containerClasses, 'flex items-center justify-center')}>
        <Car className={cn(config.iconSize, 'text-muted-foreground')} />
        {badge && (
          <div className="absolute -top-1 -right-1">
            {badge}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={containerClasses}
      onClick={onClick}
    >
      {/* Loading skeleton */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Image */}
      <img
        src={imageUrl}
        alt={vehicleName}
        loading={loading}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        className={cn(
          'w-full h-full object-cover transition-all duration-300',
          !imageLoaded && 'opacity-0',
          imageLoaded && 'opacity-100',
          onClick && 'group-hover:scale-110'
        )}
      />

      {/* Hover overlay */}
      {onClick && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      )}

      {/* Badge */}
      {badge && (
        <div className="absolute -top-1 -right-1 z-10">
          {badge}
        </div>
      )}
    </div>
  );
};
```

#### Usage Examples

```tsx
// Icon size - for lists, pills, compact views
<VehicleThumbnail vehicleName="Ferrari SF90 Stradale" size="icon" />

// Pill size - for inline mentions, tags
<div className="flex items-center gap-2">
  <VehicleThumbnail vehicleName="Lamborghini Urus" size="pill" />
  <span>Lamborghini Urus</span>
</div>

// With status badge
<VehicleThumbnail 
  vehicleName="Porsche 911 Turbo S" 
  size="md"
  badge={<Badge className="bg-success text-white text-[10px]">Available</Badge>}
/>

// Clickable with hover effect
<VehicleThumbnail 
  vehicleName="McLaren 720S Spider" 
  size="lg"
  onClick={() => setShowVehicleDialog(true)}
/>

// Full width card image
<VehicleThumbnail vehicleName="Bugatti Chiron Sport" size="full" />
```

#### Update Existing Components

Replace current image implementations with `VehicleThumbnail`:

**1. BookEnhanced.tsx** - Upcoming pickup card
```tsx
// Before:
<img 
  src={vehicleImageUrl} 
  alt={vehicleName}
  className="h-24 w-24 rounded-xl object-cover..."
/>

// After:
<VehicleThumbnail 
  vehicleName={vehicleName}
  size="lg"
  onClick={() => handleVehicleClick(booking.vehicle_id)}
/>
```

**2. MotorIQEnhanced.tsx** - Vehicle performance rows
```tsx
// Add thumbnail to each vehicle row
<div className="flex items-center gap-3">
  <VehicleThumbnail vehicleName={vehicle.name} size="sm" />
  <div>
    <p className="font-medium">{vehicle.name}</p>
    <p className="text-sm text-muted-foreground">${vehicle.dailyRate}/day</p>
  </div>
</div>
```

**3. BookingCalendar.tsx** - Calendar event pills
```tsx
// Compact vehicle icon in calendar events
<div className="flex items-center gap-1.5">
  <VehicleThumbnail vehicleName={booking.vehicleName} size="icon" />
  <span className="truncate text-xs">{booking.customerName}</span>
</div>
```

**4. VehicleImageDialog.tsx** - Use full size
```tsx
<VehicleThumbnail 
  vehicleName={vehicleName}
  size="full"
  loading="eager"
  className="shadow-lg border"
/>
```

**5. Rari Transcript EntityLink** - Inline vehicle mentions
```tsx
// When Rari mentions a vehicle, show thumbnail
<span className="inline-flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
  <VehicleThumbnail vehicleName={entityValue} size="icon" />
  <span>{entityValue}</span>
</span>
```

#### Image Optimization (Optional Enhancement)

For production, consider adding:

```tsx
// Generate srcset for responsive images
const generateSrcSet = (baseUrl: string) => {
  return `${baseUrl}?w=100 100w, ${baseUrl}?w=200 200w, ${baseUrl}?w=400 400w`;
};

// Add to img element
<img
  src={imageUrl}
  srcSet={generateSrcSet(imageUrl)}
  sizes={`(max-width: 768px) ${mobileSizes[size]}, ${desktopSizes[size]}`}
  ...
/>
```

---

## 📁 FILES TO CREATE

```
src/components/onboarding/
├── InteractiveModuleTour.tsx      # New tour component
├── TourSpotlight.tsx              # Spotlight overlay component
├── TourTooltip.tsx                # Floating tooltip component
└── WelcomeVideoModal.tsx          # Video onboarding modal

src/components/common/
└── VehicleThumbnail.tsx           # Reusable vehicle image component

src/hooks/
└── useTourNavigation.ts           # Tour navigation state management
```

## 📁 FILES TO MODIFY

```
src/components/onboarding/DashboardOnboarding.tsx  # Replace with InteractiveModuleTour
src/components/dashboard/MotorIQEnhanced.tsx       # Add data-tour attributes + thumbnails
src/components/dashboard/BookEnhanced.tsx          # Add data-tour attributes + thumbnails
src/components/dashboard/PulseEnhanced.tsx         # Add data-tour attributes
src/components/dashboard/VaultEnhanced.tsx         # Add data-tour attributes
src/components/dashboard/settings/MyAccountSection.tsx  # Update restart tour button
src/pages/Dashboard.tsx                            # Add video modal + tour trigger
src/components/dialogs/VehicleImageDialog.tsx      # Use VehicleThumbnail
src/components/dashboard/BookingCalendar.tsx       # Use VehicleThumbnail
```

---

## ✅ ACCEPTANCE CRITERIA

### Tour
- [ ] Tour navigates user to each module (not just shows tooltips)
- [ ] Spotlights highlight actual UI elements with cutout effect
- [ ] Keyboard navigation works (← → Escape)
- [ ] Progress indicator shows current step and time remaining
- [ ] Tour completes in ~2 minutes
- [ ] Restart tour works from Settings
- [ ] Mobile-responsive (simplified flow on mobile)

### Video
- [ ] Video modal appears for first-time users
- [ ] Skip button works
- [ ] Autoplay with muted option
- [ ] CTA leads to interactive tour
- [ ] Video completion tracked in localStorage

### Thumbnails
- [ ] VehicleThumbnail renders at all sizes (icon, pill, sm, md, lg, full)
- [ ] Fallback icon shows when no image available
- [ ] Loading state shows skeleton
- [ ] Click handler works with hover effect
- [ ] Badge overlay positions correctly
- [ ] Lazy loading enabled by default
- [ ] Used in at least 3 existing components

---

## 🎨 DESIGN TOKENS

```css
/* Tour Overlay */
--tour-backdrop: rgba(0, 0, 0, 0.75);
--tour-spotlight-glow: 0 0 0 4px rgba(var(--primary), 0.3);
--tour-tooltip-bg: hsl(var(--background) / 0.95);

/* Video Modal */
--video-overlay-gradient: linear-gradient(to top, rgba(0,0,0,0.7), transparent, rgba(0,0,0,0.4));

/* Thumbnails */
--thumbnail-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
--thumbnail-hover-scale: 1.05;
```

---

## 🚀 IMPLEMENTATION ORDER

1. **VehicleThumbnail** (30 min) - Foundation component, no dependencies
2. **TourSpotlight + TourTooltip** (45 min) - Core tour UI primitives  
3. **InteractiveModuleTour** (1 hr) - Main tour logic
4. **WelcomeVideoModal** (30 min) - Video player component
5. **Integration** (45 min) - Wire everything into Dashboard
6. **Testing** (30 min) - Full flow verification

---

## 💡 BONUS ENHANCEMENTS (If Time Permits)

1. **Tour Analytics** - Track which steps users skip, completion rate
2. **Contextual Re-tours** - "New feature!" badges that trigger mini-tours
3. **Video Chapters** - Clickable chapter markers in video timeline
4. **Thumbnail Preloading** - Preload vehicle images on dashboard mount
5. **A/B Test** - Video-first vs Tour-first onboarding

---

**Questions? The existing codebase has all the patterns you need. Reference `DashboardOnboarding.tsx` for animation patterns and `useLocalStorage` for persistence. Good luck! 🎯**
