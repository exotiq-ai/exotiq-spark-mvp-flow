# ExotIQ Refinement - Implementation Guide
## Actionable Code Examples for Top 5 Improvements

This guide provides specific, copy-paste-ready code examples for implementing the top 5 highest-impact improvements identified in the expert product review.

---

## 1. Reduce Visual Density & Increase Whitespace

### Problem
Dashboard shows 7+ widgets with tight spacing. Cards use 2px borders creating visual noise.

### Solution: Update Design Tokens

**File:** `src/index.css`

```css
/* BEFORE - Current spacing */
.stat-card {
  @apply bg-card border-2 border-border rounded-xl p-6 shadow-sm hover:shadow-md transition-smooth;
}

/* AFTER - Refined spacing */
.stat-card {
  @apply bg-card border border-border rounded-xl p-8 shadow-sm hover:shadow-md transition-smooth;
}

/* Add new spacing utilities */
@layer utilities {
  .space-y-8 {
    margin-top: 2rem; /* 32px */
  }
  
  .space-y-12 {
    margin-top: 3rem; /* 48px */
  }
  
  .gap-8 {
    gap: 2rem; /* 32px */
  }
}
```

### Solution: Update Card Component

**File:** `src/components/ui/card.tsx`

```tsx
// BEFORE
const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground transition-all duration-300 ease-out",
  {
    variants: {
      variant: {
        default: "shadow-sm hover:shadow-md",
        // ...
      },
    },
  }
)

// AFTER - Reduce border weight
const cardVariants = cva(
  "rounded-xl border bg-card text-card-foreground transition-all duration-300 ease-out", // Changed border-2 to border
  {
    variants: {
      variant: {
        default: "shadow-sm hover:shadow-md",
        interactive: "shadow-sm hover:shadow-lg hover:scale-[1.005] hover:border-primary/20 cursor-pointer active:scale-[0.995]", // Reduced scale
        elevated: "shadow-md hover:shadow-xl hover:-translate-y-0.5", // Reduced translation
        // ...
      },
    },
  }
)
```

### Solution: Update Dashboard Layout

**File:** `src/components/dashboard/DashboardOverview.tsx`

```tsx
// BEFORE - All widgets shown immediately
export const DashboardOverview = ({ onModuleClick }: DashboardOverviewProps) => {
  return (
    <div className="space-y-4 md:space-y-6">
      <BannerWidget />
      <RevenueWidget />
      <MetricsWidget />
      <AIInsightWidget />
      <FleetStatusWidget />
      <ScheduleWidget />
      <QuickActionsWidget />
    </div>
  );
};

// AFTER - Progressive disclosure with generous spacing
export const DashboardOverview = ({ onModuleClick }: DashboardOverviewProps) => {
  const [showAllWidgets, setShowAllWidgets] = useLocalStorage('dashboardExpanded', false);
  
  return (
    <div className="space-y-8 md:space-y-12"> {/* Increased spacing */}
      {/* Hero Section - Always visible */}
      <BannerWidget />
      
      {/* Key Metrics - Always visible */}
      <div data-tour="revenue-widget">
        <RevenueWidget />
      </div>
      
      <MetricsWidget />
      
      {/* Additional Widgets - Progressive disclosure */}
      <AnimatePresence>
        {showAllWidgets && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="space-y-8 md:space-y-12"
          >
            <AIInsightWidget 
              onApplyOptimization={() => setShowOptimizationDialog(true)}
              onViewAnalysis={() => onModuleClick('motoriq')}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8"> {/* Increased gap */}
              <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
              <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />
            </div>
            
            <QuickActionsWidget onModuleClick={onModuleClick} />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Show More Button */}
      {!showAllWidgets && (
        <div className="flex justify-center pt-4">
          <Button 
            variant="outline" 
            size="lg"
            onClick={() => setShowAllWidgets(true)}
            className="gap-2"
          >
            <ChevronDown className="h-4 w-4" />
            Show More Insights
          </Button>
        </div>
      )}
      
      {/* Collapse Button */}
      {showAllWidgets && (
        <div className="flex justify-center pt-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowAllWidgets(false)}
            className="gap-2"
          >
            <ChevronUp className="h-4 w-4" />
            Show Less
          </Button>
        </div>
      )}
    </div>
  );
};
```

---

## 2. Implement Command Palette (Cmd+K)

### Installation

```bash
npm install cmdk
```

### Create Command Palette Component

**File:** `src/components/common/CommandPalette.tsx`

```tsx
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import { 
  Search, 
  Calendar, 
  Car, 
  BarChart3, 
  Brain, 
  Shield,
  MessageSquare,
  Settings,
  Clock
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useFleet } from '@/contexts/FleetContext';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { vehicles } = useFleet();
  const [search, setSearch] = useState('');
  const [recentItems, setRecentItems] = useState<string[]>([]);

  // Load recent items from localStorage
  useEffect(() => {
    const recent = localStorage.getItem('recentItems');
    if (recent) {
      setRecentItems(JSON.parse(recent));
    }
  }, []);

  // Add item to recent
  const addToRecent = useCallback((item: string) => {
    const updated = [item, ...recentItems.filter(i => i !== item)].slice(0, 10);
    setRecentItems(updated);
    localStorage.setItem('recentItems', JSON.stringify(updated));
  }, [recentItems]);

  // Handle selection
  const handleSelect = useCallback((callback: () => void, label: string) => {
    callback();
    addToRecent(label);
    onOpenChange(false);
    setSearch('');
  }, [addToRecent, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl">
        <Command className="rounded-lg border-0 shadow-none">
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Command.Input
              placeholder="Search or jump to..."
              value={search}
              onValueChange={setSearch}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>
          
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </Command.Empty>

            {/* Quick Actions */}
            <Command.Group heading="Quick Actions" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              <CommandItem
                icon={<Calendar className="h-4 w-4" />}
                label="New Booking"
                shortcut="⌘B"
                onSelect={() => handleSelect(() => navigate('/dashboard?module=book'), 'New Booking')}
              />
              <CommandItem
                icon={<Brain className="h-4 w-4" />}
                label="Ask Rari AI"
                shortcut="⌘R"
                onSelect={() => handleSelect(() => {
                  // Trigger Rari dialog
                  window.dispatchEvent(new CustomEvent('openRari'));
                }, 'Ask Rari AI')}
              />
              <CommandItem
                icon={<BarChart3 className="h-4 w-4" />}
                label="View Analytics"
                shortcut="⌘A"
                onSelect={() => handleSelect(() => navigate('/dashboard?module=pulse'), 'View Analytics')}
              />
            </Command.Group>

            {/* Navigation */}
            <Command.Group heading="Navigation" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              <CommandItem
                icon={<Car className="h-4 w-4" />}
                label="Fleet Overview"
                onSelect={() => handleSelect(() => navigate('/dashboard?module=motoriq'), 'Fleet Overview')}
              />
              <CommandItem
                icon={<Shield className="h-4 w-4" />}
                label="Compliance Vault"
                onSelect={() => handleSelect(() => navigate('/dashboard?module=vault'), 'Compliance Vault')}
              />
              <CommandItem
                icon={<MessageSquare className="h-4 w-4" />}
                label="Team Messages"
                onSelect={() => handleSelect(() => {
                  window.dispatchEvent(new CustomEvent('openChat'));
                }, 'Team Messages')}
              />
              <CommandItem
                icon={<Settings className="h-4 w-4" />}
                label="Settings"
                onSelect={() => handleSelect(() => navigate('/dashboard?module=settings'), 'Settings')}
              />
            </Command.Group>

            {/* Recent Items */}
            {recentItems.length > 0 && (
              <Command.Group heading="Recent" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                {recentItems.slice(0, 5).map((item) => (
                  <CommandItem
                    key={item}
                    icon={<Clock className="h-4 w-4" />}
                    label={item}
                    onSelect={() => handleSelect(() => {}, item)}
                  />
                ))}
              </Command.Group>
            )}

            {/* Vehicles - Search Results */}
            {search && vehicles.length > 0 && (
              <Command.Group heading="Vehicles" className="text-xs font-medium text-muted-foreground px-2 py-1.5">
                {vehicles
                  .filter(v => 
                    v.make.toLowerCase().includes(search.toLowerCase()) ||
                    v.model.toLowerCase().includes(search.toLowerCase())
                  )
                  .slice(0, 5)
                  .map((vehicle) => (
                    <CommandItem
                      key={vehicle.id}
                      icon={<Car className="h-4 w-4" />}
                      label={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
                      description={vehicle.status}
                      onSelect={() => handleSelect(
                        () => navigate(`/dashboard?module=motoriq&vehicle=${vehicle.id}`),
                        `${vehicle.make} ${vehicle.model}`
                      )}
                    />
                  ))}
              </Command.Group>
            )}
          </Command.List>

          {/* Footer */}
          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ↑↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                  ↵
                </kbd>
                Select
              </span>
            </div>
            <span>Press <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">ESC</kbd> to close</span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

// Command Item Component
interface CommandItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  shortcut?: string;
  onSelect: () => void;
}

const CommandItem = ({ icon, label, description, shortcut, onSelect }: CommandItemProps) => {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm cursor-pointer",
        "hover:bg-accent hover:text-accent-foreground",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        "transition-colors"
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{label}</div>
        {description && (
          <div className="text-xs text-muted-foreground truncate">{description}</div>
        )}
      </div>
      {shortcut && (
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
          {shortcut}
        </kbd>
      )}
    </Command.Item>
  );
};
```

### Integrate into Dashboard

**File:** `src/pages/Dashboard.tsx`

```tsx
import { CommandPalette } from '@/components/common/CommandPalette';

const Dashboard = () => {
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // Keyboard shortcut listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Listen for custom events
  useEffect(() => {
    const handleOpenRari = () => setShowRari(true);
    const handleOpenChat = () => setChatOpen(true);

    window.addEventListener('openRari', handleOpenRari);
    window.addEventListener('openChat', handleOpenChat);

    return () => {
      window.removeEventListener('openRari', handleOpenRari);
      window.removeEventListener('openChat', handleOpenChat);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background mobile-friendly flex">
      {/* ... existing code ... */}
      
      {/* Command Palette */}
      <CommandPalette 
        open={commandPaletteOpen} 
        onOpenChange={setCommandPaletteOpen} 
      />
      
      {/* ... rest of dashboard ... */}
    </div>
  );
};
```

---

## 3. Develop Automotive Design Language

### Add Automotive Textures

**File:** `src/index.css`

```css
@layer components {
  /* Carbon Fiber Texture */
  .carbon-fiber {
    background-image: 
      linear-gradient(45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
      linear-gradient(-45deg, rgba(0,0,0,0.03) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, rgba(0,0,0,0.03) 75%),
      linear-gradient(-45deg, transparent 75%, rgba(0,0,0,0.03) 75%);
    background-size: 4px 4px;
    background-position: 0 0, 0 2px, 2px -2px, -2px 0px;
  }

  /* Brushed Metal Texture */
  .brushed-metal {
    background-image: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0) 0%,
      rgba(255, 255, 255, 0.02) 50%,
      rgba(255, 255, 255, 0) 100%
    );
    background-size: 2px 100%;
  }

  /* Speed Line Divider */
  .speed-divider {
    height: 2px;
    background: linear-gradient(
      90deg,
      transparent 0%,
      hsl(var(--primary)) 30%,
      hsl(var(--primary)) 70%,
      transparent 100%
    );
    position: relative;
    margin: 3rem 0;
  }

  .speed-divider::after {
    content: '';
    position: absolute;
    right: 0;
    top: -3px;
    width: 0;
    height: 0;
    border-left: 12px solid hsl(var(--primary));
    border-top: 4px solid transparent;
    border-bottom: 4px solid transparent;
  }

  /* Dashboard Gauge Style Metric */
  .gauge-metric {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .gauge-metric::before {
    content: '';
    position: absolute;
    inset: -8px;
    border-radius: 50%;
    border: 2px solid hsl(var(--border));
    border-top-color: hsl(var(--primary));
    border-right-color: hsl(var(--primary));
    opacity: 0.3;
  }

  /* Racing Stripe Accent */
  .racing-stripe {
    position: relative;
  }

  .racing-stripe::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: linear-gradient(
      180deg,
      hsl(var(--primary)),
      hsl(var(--accent))
    );
    border-radius: 0 4px 4px 0;
  }

  /* Premium Card with Automotive Feel */
  .card-automotive {
    @apply card-premium carbon-fiber;
    border-left: 4px solid hsl(var(--primary));
    box-shadow: 
      0 1px 3px rgba(0, 0, 0, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
}
```

### Update Color Palette

**File:** `tailwind.config.ts`

```ts
export default {
  theme: {
    extend: {
      colors: {
        // ... existing colors ...
        
        // Automotive-inspired colors
        'racing-red': {
          DEFAULT: 'hsl(0, 100%, 50%)',
          light: 'hsl(0, 100%, 60%)',
          dark: 'hsl(0, 100%, 40%)',
        },
        'carbon-black': {
          DEFAULT: 'hsl(0, 0%, 10%)',
          light: 'hsl(0, 0%, 15%)',
          dark: 'hsl(0, 0%, 5%)',
        },
        'chrome-silver': {
          DEFAULT: 'hsl(0, 0%, 75%)',
          light: 'hsl(0, 0%, 85%)',
          dark: 'hsl(0, 0%, 65%)',
        },
        'racing-green': {
          DEFAULT: 'hsl(152, 100%, 25%)',
          light: 'hsl(152, 100%, 35%)',
          dark: 'hsl(152, 100%, 15%)',
        },
      },
    },
  },
};
```

### Create Automotive Hero Section

**File:** `src/components/dashboard/widgets/BannerWidget.tsx`

```tsx
export const BannerWidget = () => {
  return (
    <Card className="relative overflow-hidden border-0 shadow-xl">
      {/* Carbon Fiber Background */}
      <div className="absolute inset-0 carbon-fiber opacity-30" />
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/70 to-accent/90" />
      
      {/* Speed Lines */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-white"
            style={{ top: `${20 + i * 15}%`, width: '100%' }}
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              duration: 2,
              delay: i * 0.2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        ))}
      </div>
      
      {/* Content */}
      <CardContent className="relative z-10 p-8 md:p-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <Badge className="bg-white/20 text-white border-white/30">
            Premium Fleet Management
          </Badge>
        </div>
        
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-tight">
          Welcome back, Operator
        </h2>
        
        <p className="text-white/90 text-lg mb-6 max-w-2xl">
          Your fleet is performing exceptionally. Revenue up 12% this month.
        </p>
        
        {/* Racing Stripe Accent */}
        <div className="flex items-center gap-4">
          <div className="h-12 w-1 bg-white/40 rounded-full" />
          <div className="space-y-1">
            <div className="text-white/70 text-sm">Today's Performance</div>
            <div className="text-white text-2xl font-bold tabular-nums">
              98.5%
            </div>
          </div>
        </div>
      </CardContent>
      
      {/* Bottom Racing Stripe */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/50 to-transparent" />
    </Card>
  );
};
```

---

## 4. Complete Core Features (Remove "Coming Soon")

### Audit "Coming Soon" Features

**Search for all instances:**

```bash
grep -r "coming soon" src/ --include="*.tsx" --include="*.ts"
```

### Replace with Feature Flags

**File:** `src/lib/featureFlags.ts`

```ts
export const featureFlags = {
  // Completed features
  rariAI: true,
  teamMessaging: true,
  dashboard: true,
  
  // In development - hide in production
  exportTranscript: process.env.NODE_ENV === 'development',
  conversationHistory: process.env.NODE_ENV === 'development',
  bulkActions: process.env.NODE_ENV === 'development',
  savedViews: process.env.NODE_ENV === 'development',
  
  // Planned features - completely hidden
  advancedReporting: false,
  apiIntegrations: false,
} as const;

export type FeatureFlag = keyof typeof featureFlags;

export const useFeatureFlag = (flag: FeatureFlag): boolean => {
  return featureFlags[flag];
};
```

### Update Components to Use Feature Flags

**File:** `src/components/rari/RariWidgetInterface.tsx`

```tsx
import { useFeatureFlag } from '@/lib/featureFlags';

export const RariWidgetInterface = () => {
  const exportEnabled = useFeatureFlag('exportTranscript');
  const historyEnabled = useFeatureFlag('conversationHistory');

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full">
      {/* ... existing code ... */}
      
      <div className="space-y-2">
        {/* Only show if feature is enabled */}
        {historyEnabled && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={handleHistory}
          >
            <History className="w-4 h-4 mr-2" />
            View History
          </Button>
        )}
        
        {exportEnabled && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={handleExport}
          >
            <Download className="w-4 h-4 mr-2" />
            Export Transcript
          </Button>
        )}
      </div>
    </div>
  );
};
```

### Implement Export Feature (Example)

**File:** `src/utils/transcriptExport.ts`

```ts
import { Message } from '@/components/rari/RariWidgetInterface';

export const exportTranscriptAsText = (
  messages: Message[],
  conversationId: string
): void => {
  const content = messages
    .map(msg => `[${msg.timestamp.toLocaleString()}] ${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n\n');
  
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rari-conversation-${conversationId}.txt`;
  a.click();
  URL.revokeObjectURL(url);
};

export const exportTranscriptAsJSON = (
  messages: Message[],
  conversationId: string
): void => {
  const data = {
    conversationId,
    exportedAt: new Date().toISOString(),
    messages: messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp.toISOString(),
    })),
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rari-conversation-${conversationId}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

**Update Component:**

```tsx
const handleExport = () => {
  if (messages.length === 0) {
    toast.error('No messages to export');
    return;
  }
  
  exportTranscriptAsText(messages, sessionId);
  toast.success('Transcript exported!');
};
```

---

## 5. Add Progressive Disclosure to Dashboard

Already covered in Section 1, but here's the complete implementation:

**File:** `src/components/dashboard/DashboardOverviewEnhanced.tsx`

```tsx
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { BannerWidget } from './widgets/BannerWidget';
import { RevenueWidget } from './widgets/RevenueWidget';
import { MetricsWidget } from './widgets/MetricsWidget';
import { AIInsightWidget } from './widgets/AIInsightWidget';
import { FleetStatusWidget } from './widgets/FleetStatusWidget';
import { ScheduleWidget } from './widgets/ScheduleWidget';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';

interface DashboardOverviewEnhancedProps {
  onModuleClick: (moduleId: string) => void;
}

export const DashboardOverviewEnhanced = ({ 
  onModuleClick 
}: DashboardOverviewEnhancedProps) => {
  const [showAllWidgets, setShowAllWidgets] = useLocalStorage('dashboardExpanded', false);
  const [showOptimizationDialog, setShowOptimizationDialog] = useState(false);

  return (
    <>
      <div className="space-y-8 md:space-y-12">
        {/* Hero Banner - Always visible */}
        <BannerWidget />
        
        {/* Core Metrics - Always visible */}
        <section aria-label="Key Performance Metrics">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold tracking-tight mb-2">
              Performance Overview
            </h2>
            <p className="text-muted-foreground">
              Your fleet's key metrics at a glance
            </p>
          </div>
          
          <div data-tour="revenue-widget" className="mb-8">
            <RevenueWidget />
          </div>
          
          <MetricsWidget />
        </section>
        
        {/* Speed Divider */}
        <div className="speed-divider" />
        
        {/* Additional Insights - Progressive disclosure */}
        <AnimatePresence mode="wait">
          {showAllWidgets ? (
            <motion.div
              key="expanded"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
              <section aria-label="Detailed Insights" className="space-y-8 md:space-y-12">
                {/* AI Insights */}
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <h2 className="text-2xl font-semibold tracking-tight">
                      AI-Powered Insights
                    </h2>
                  </div>
                  <AIInsightWidget 
                    onApplyOptimization={() => setShowOptimizationDialog(true)}
                    onViewAnalysis={() => onModuleClick('motoriq')}
                  />
                </div>
                
                {/* Speed Divider */}
                <div className="speed-divider" />
                
                {/* Fleet & Schedule */}
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-6">
                    Operations
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
                    <FleetStatusWidget onViewAll={() => onModuleClick('motoriq')} />
                    <ScheduleWidget onViewCalendar={() => onModuleClick('book')} />
                  </div>
                </div>
                
                {/* Speed Divider */}
                <div className="speed-divider" />
                
                {/* Quick Actions */}
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight mb-6">
                    Quick Actions
                  </h2>
                  <QuickActionsWidget onModuleClick={onModuleClick} />
                </div>
              </section>
              
              {/* Collapse Button */}
              <div className="flex justify-center pt-8">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowAllWidgets(false)}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <ChevronUp className="h-4 w-4" />
                  Show Less
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col items-center py-8"
            >
              <p className="text-muted-foreground mb-4 text-center">
                View AI insights, fleet status, and more
              </p>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => setShowAllWidgets(true)}
                className="gap-2 group"
              >
                <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
                Show More Insights
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Dialogs */}
      <PriceOptimizationDialog
        open={showOptimizationDialog}
        onOpenChange={setShowOptimizationDialog}
        vehicles={vehicles}
        onApply={(vehicleId, newRate) => applyPriceOptimization(vehicleId, newRate)}
      />
    </>
  );
};
```

---

## Testing Checklist

After implementing these changes, test the following:

### Visual Refinement
- [ ] All cards use 1px borders (not 2px)
- [ ] Spacing increased to 8px/12px grid
- [ ] Dashboard feels less cramped
- [ ] Hover states are subtle (not aggressive)

### Command Palette
- [ ] Cmd+K opens command palette
- [ ] Search works across vehicles
- [ ] Quick actions navigate correctly
- [ ] Recent items persist
- [ ] Keyboard navigation works

### Automotive Design
- [ ] Carbon fiber texture visible
- [ ] Speed dividers render correctly
- [ ] Racing stripe accents appear
- [ ] Automotive colors applied
- [ ] Premium feel enhanced

### Feature Flags
- [ ] No "coming soon" toasts in production
- [ ] Feature flags work correctly
- [ ] Export feature functional
- [ ] Hidden features don't show

### Progressive Disclosure
- [ ] Dashboard shows 3 metrics initially
- [ ] "Show More" button works
- [ ] Expansion animates smoothly
- [ ] Preference persists
- [ ] "Show Less" collapses correctly

---

## Deployment Notes

1. **Environment Variables:** Ensure `NODE_ENV` is set correctly for production
2. **Feature Flags:** Review and update feature flags before deployment
3. **Performance:** Test animations on low-end devices
4. **Accessibility:** Verify keyboard navigation and screen reader support
5. **Analytics:** Track command palette usage and dashboard expansion rates

---

## Next Steps

After implementing these 5 improvements:

1. **User Testing:** Test with 5-10 real operators
2. **Metrics:** Measure impact on engagement and satisfaction
3. **Iteration:** Refine based on feedback
4. **Phase 2:** Move to next set of improvements (onboarding, empty states, etc.)

---

**Implementation Priority:**
1. Visual Refinement (1 week) - Immediate impact
2. Progressive Disclosure (2 days) - Quick win
3. Feature Flags (1 day) - Remove "coming soon"
4. Command Palette (1 week) - High value
5. Automotive Design (1 week) - Brand differentiation

**Total Time:** 3-4 weeks for all 5 improvements

---

*For questions or clarifications, refer to EXPERT_PRODUCT_REVIEW.md for detailed rationale.*
