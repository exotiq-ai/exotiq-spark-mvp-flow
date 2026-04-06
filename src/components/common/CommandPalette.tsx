import { useState, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Calendar, 
  Car, 
  Users, 
  FileText, 
  Settings,
  TrendingUp,
  BarChart3,
  MessageSquare,
  Sparkles,
  Clock,
  ArrowRight,
  Download,
  Zap,
  History
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { moduleIdToPath } from '@/lib/moduleRoutes';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { supabase } from '@/integrations/supabase/client';
import { exportToCSV } from '@/lib/exportUtils';
import { useToast } from '@/hooks/use-toast';

interface CommandItem {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  keywords: string[];
  onSelect: () => void;
  category: 'actions' | 'navigation' | 'search' | 'recent';
  badge?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const [recentItems, setRecentItems] = useLocalStorage<string[]>('commandPaletteRecent', []);

  // Track item usage
  const trackItemUsage = useCallback((itemId: string) => {
    setRecentItems((prev) => {
      const filtered = prev.filter(id => id !== itemId);
      return [itemId, ...filtered].slice(0, 5); // Keep last 5
    });
  }, [setRecentItems]);

  // Quick Actions - Navigation with URL query params (reliable, no race conditions)
  const quickActions: CommandItem[] = [
    {
      id: 'motoriq',
      title: 'MotorIQ - Dynamic Pricing',
      description: 'AI-powered pricing optimization',
      icon: <TrendingUp className="h-4 w-4 text-gulf-blue" />,
      keywords: ['motoriq', 'pricing', 'dynamic', 'optimization', 'ai', 'revenue', 'predict'],
      onSelect: () => {
        trackItemUsage('motoriq');
        navigate(moduleIdToPath('motoriq'));
        onOpenChange(false);
      },
      category: 'actions',
      badge: '⌘M',
    },
    {
      id: 'pulse',
      title: 'Pulse - Analytics',
      description: 'Fleet performance analytics',
      icon: <BarChart3 className="h-4 w-4 text-performance-orange" />,
      keywords: ['pulse', 'analytics', 'performance', 'metrics', 'reports'],
      onSelect: () => {
        trackItemUsage('pulse');
        navigate(moduleIdToPath('pulse'));
        onOpenChange(false);
      },
      category: 'actions',
      badge: '⌘P',
    },
    {
      id: 'book',
      title: 'Book - Reservations',
      description: 'Manage bookings and calendar',
      icon: <Calendar className="h-4 w-4 text-accent" />,
      keywords: ['book', 'bookings', 'reservations', 'calendar', 'schedule'],
      onSelect: () => {
        trackItemUsage('book');
        navigate(moduleIdToPath('book'));
        onOpenChange(false);
      },
      category: 'actions',
      badge: '⌘K',
    },
  ];

  // Navigation Items - All use URL query params for reliable navigation
  const navigationItems: CommandItem[] = [
    {
      id: 'dashboard',
      title: 'Dashboard',
      description: 'Command Center overview',
      icon: <BarChart3 className="h-4 w-4" />,
      keywords: ['dashboard', 'home', 'overview', 'command center'],
      onSelect: () => {
        navigate(moduleIdToPath('dashboard'));
        onOpenChange(false);
      },
      category: 'navigation',
    },
    {
      id: 'motoriq',
      title: 'MotorIQ',
      description: 'Fleet profitability engine',
      icon: <TrendingUp className="h-4 w-4" />,
      keywords: ['motoriq', 'optimization', 'pricing', 'revenue', 'analytics'],
      onSelect: () => {
        navigate(moduleIdToPath('motoriq'));
        onOpenChange(false);
      },
      category: 'navigation',
    },
    {
      id: 'bookings',
      title: 'Bookings',
      description: 'Manage reservations',
      icon: <Calendar className="h-4 w-4" />,
      keywords: ['bookings', 'reservations', 'calendar', 'schedule'],
      onSelect: () => {
        navigate(moduleIdToPath('book'));
        onOpenChange(false);
      },
      category: 'navigation',
    },
    {
      id: 'fleet',
      title: 'Fleet',
      description: 'Manage your vehicles',
      icon: <Car className="h-4 w-4" />,
      keywords: ['fleet', 'vehicles', 'cars'],
      onSelect: () => {
        navigate('/dashboard?module=motoriq');
        onOpenChange(false);
      },
      category: 'navigation',
    },
    {
      id: 'customers',
      title: 'Customers',
      description: 'Customer management',
      icon: <Users className="h-4 w-4" />,
      keywords: ['customers', 'clients', 'users', 'people'],
      onSelect: () => {
        navigate('/dashboard?module=core');
        onOpenChange(false);
      },
      category: 'navigation',
    },
    {
      id: 'documents',
      title: 'Documents',
      description: 'Compliance hub',
      icon: <FileText className="h-4 w-4" />,
      keywords: ['documents', 'compliance', 'vault', 'files'],
      onSelect: () => {
        navigate('/dashboard?module=vault');
        onOpenChange(false);
      },
      category: 'navigation',
    },
    {
      id: 'messages',
      title: 'Team Messages',
      description: 'Internal communications',
      icon: <MessageSquare className="h-4 w-4" />,
      keywords: ['messages', 'chat', 'team', 'communication'],
      onSelect: () => {
        navigate('/dashboard?module=messages');
        onOpenChange(false);
      },
      category: 'navigation',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'Account and preferences',
      icon: <Settings className="h-4 w-4" />,
      keywords: ['settings', 'preferences', 'account', 'configuration'],
      onSelect: () => {
        navigate('/dashboard?module=settings');
        onOpenChange(false);
      },
      category: 'navigation',
      badge: '⌘,',
    },
  ];

  const { toast } = useToast();

  // Global Actions - Quick tasks and exports with real implementation
  const globalActions: CommandItem[] = [
    {
      id: 'export-fleet',
      title: 'Export Fleet Data',
      description: 'Download CSV of all vehicles',
      icon: <Download className="h-4 w-4 text-success" />,
      keywords: ['export', 'download', 'csv', 'fleet', 'vehicles', 'data'],
      onSelect: async () => {
        trackItemUsage('export-fleet');
        try {
          const { data, error } = await supabase.from('vehicles').select('*');
          if (error) throw error;
          if (data && data.length > 0) {
            exportToCSV(data, 'fleet-data');
            toast({ title: 'Export complete', description: `${data.length} vehicles exported` });
          } else {
            toast({ title: 'No data', description: 'No vehicles to export', variant: 'destructive' });
          }
        } catch (error) {
          toast({ title: 'Export failed', description: 'Could not export fleet data', variant: 'destructive' });
        }
        onOpenChange(false);
      },
      category: 'actions',
      badge: '⇧⌘E',
    },
    {
      id: 'export-bookings',
      title: 'Export Bookings',
      description: 'Download booking history',
      icon: <Download className="h-4 w-4 text-primary" />,
      keywords: ['export', 'download', 'bookings', 'reservations', 'history'],
      onSelect: async () => {
        trackItemUsage('export-bookings');
        try {
          const { data, error } = await supabase.from('bookings').select('*');
          if (error) throw error;
          if (data && data.length > 0) {
            exportToCSV(data, 'bookings-export');
            toast({ title: 'Export complete', description: `${data.length} bookings exported` });
          } else {
            toast({ title: 'No data', description: 'No bookings to export', variant: 'destructive' });
          }
        } catch (error) {
          toast({ title: 'Export failed', description: 'Could not export bookings', variant: 'destructive' });
        }
        onOpenChange(false);
      },
      category: 'actions',
    },
  ];

  // Combine all items
  const allItems = [...quickActions, ...navigationItems, ...globalActions];

  // Get recent items (convert IDs to full items)
  const recentItemsList = useMemo(() => {
    return recentItems
      .map(id => allItems.find(item => item.id === id))
      .filter(Boolean) as CommandItem[];
  }, [recentItems, allItems]);

  // Fuzzy search function
  const fuzzyMatch = useCallback((str: string, pattern: string) => {
    const patternLower = pattern.toLowerCase();
    const strLower = str.toLowerCase();
    
    // Exact match gets highest priority
    if (strLower.includes(patternLower)) return true;
    
    // Fuzzy match
    let patternIdx = 0;
    for (let i = 0; i < strLower.length && patternIdx < patternLower.length; i++) {
      if (strLower[i] === patternLower[patternIdx]) {
        patternIdx++;
      }
    }
    return patternIdx === patternLower.length;
  }, []);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search.trim()) return allItems;

    return allItems.filter(item => {
      const searchLower = search.toLowerCase();
      return (
        fuzzyMatch(item.title, searchLower) ||
        fuzzyMatch(item.description || '', searchLower) ||
        item.keywords.some(keyword => fuzzyMatch(keyword, searchLower))
      );
    });
  }, [search, allItems, fuzzyMatch]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {
      actions: [],
      navigation: [],
      search: [],
      recent: [],
    };

    filteredItems.forEach(item => {
      groups[item.category].push(item);
    });

    return groups;
  }, [filteredItems]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          item.onSelect();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, selectedIndex, filteredItems]);

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-2xl gap-0 overflow-hidden">
        {/* Search Input */}
        <div className="flex items-center border-b px-4 py-3 gap-3">
          <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Search or type a command..."
            className="border-0 shadow-none focus-visible:ring-0 text-base h-auto p-0"
            autoFocus
          />
          <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted rounded">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No results found</p>
              <p className="text-xs mt-1">Try different keywords</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Recent Items - Only show when no search */}
              {!search.trim() && recentItemsList.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <History className="h-3 w-3" />
                    Recent
                  </div>
                  <div className="space-y-1">
                    {recentItemsList.map((item, index) => (
                      <CommandPaletteItem
                        key={item.id}
                        item={item}
                        selected={filteredItems.indexOf(item) === selectedIndex}
                        onClick={() => item.onSelect()}
                        isRecent
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              {groupedItems.actions.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Zap className="h-3 w-3" />
                    Quick Actions
                  </div>
                  <div className="space-y-1">
                    {groupedItems.actions.map((item, index) => (
                      <CommandPaletteItem
                        key={item.id}
                        item={item}
                        selected={filteredItems.indexOf(item) === selectedIndex}
                        onClick={() => item.onSelect()}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Navigation */}
              {groupedItems.navigation.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="h-3 w-3" />
                    Navigation
                  </div>
                  <div className="space-y-1">
                    {groupedItems.navigation.map((item, index) => (
                      <CommandPaletteItem
                        key={item.id}
                        item={item}
                        selected={filteredItems.indexOf(item) === selectedIndex}
                        onClick={() => item.onSelect()}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↓</kbd>
              <span className="ml-1">Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-background border rounded text-[10px]">↵</kbd>
              <span className="ml-1">Select</span>
            </div>
          </div>
          <div className="text-[10px]">
            Press <kbd className="px-1 py-0.5 bg-background border rounded">⌘K</kbd> anytime
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Command Palette Item Component
const CommandPaletteItem = ({ 
  item, 
  selected, 
  onClick,
  isRecent = false
}: { 
  item: CommandItem; 
  selected: boolean; 
  onClick: () => void;
  isRecent?: boolean;
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
        "hover:bg-accent/50 active:scale-[0.98]",
        selected && "bg-accent/80 text-accent-foreground"
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center relative",
        selected ? "bg-background/50" : "bg-muted"
      )}>
        {item.icon}
        {isRecent && (
          <Clock className="h-3 w-3 absolute -top-0.5 -right-0.5 text-muted-foreground bg-background rounded-full p-0.5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{item.title}</div>
        {item.description && (
          <div className="text-xs text-muted-foreground truncate">
            {item.description}
          </div>
        )}
      </div>
      {item.badge && (
        <kbd className="hidden sm:inline-block px-2 py-1 text-[10px] font-semibold text-muted-foreground bg-muted rounded">
          {item.badge}
        </kbd>
      )}
      {selected && (
        <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
    </button>
  );
};

// Global keyboard shortcut hook
export const useCommandPalette = (onOpen: () => void) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onOpen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
};
