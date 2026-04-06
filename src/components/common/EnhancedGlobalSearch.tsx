import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { moduleIdToPath } from "@/lib/moduleRoutes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  Users,
  Calendar,
  FileText,
  DollarSign,
  Settings,
  Search,
  Clock,
  TrendingUp,
  BarChart3,
  Shield,
  Brain,
  Plus,
  ArrowRight,
  Sparkles,
  Download,
  MessageSquare,
} from "lucide-react";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { supabase } from "@/integrations/supabase/client";
import { exportToCSV } from "@/lib/exportUtils";
import { useToast } from "@/hooks/use-toast";

interface SearchResult {
  id: string;
  type: "vehicle" | "customer" | "booking" | "action" | "module" | "export";
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action: () => void;
  badge?: string;
}

interface EnhancedGlobalSearchProps {
  onOpenRari?: (query?: string) => void;
}

// Hook: ⌘K opens this search bar globally
export const useGlobalSearchShortcut = (onOpen: () => void) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpen]);
};

export const EnhancedGlobalSearch = ({ onOpenRari }: EnhancedGlobalSearchProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const navigate = useNavigate();
  const { vehicles, customers, bookings } = useLocationFilteredFleet();
  const { toast } = useToast();

  // ⌘K opens this search
  useGlobalSearchShortcut(() => setOpen(true));

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  const handleSelect = (callback: () => void, query?: string) => {
    setOpen(false);
    if (query) saveRecentSearch(query);
    setSearchQuery("");
    callback();
  };

  // Quick actions
  const quickActions: SearchResult[] = [
    {
      id: "new-booking",
      type: "action",
      title: "New Booking",
      subtitle: "Create a new rental booking",
      icon: Plus,
      action: () => navigate(moduleIdToPath("book", { action: "new" })),
      badge: "⌘N"
    },
    {
      id: "add-vehicle",
      type: "action",
      title: "Add Vehicle",
      subtitle: "Add a new vehicle to fleet",
      icon: Car,
      action: () => navigate(moduleIdToPath("core", { action: "add-vehicle" }))
    },
    {
      id: "add-customer",
      type: "action",
      title: "Add Customer",
      subtitle: "Register a new customer",
      icon: Users,
      action: () => navigate(moduleIdToPath("core", { action: "add-customer" }))
    },
    {
      id: "generate-report",
      type: "action",
      title: "Generate Report",
      subtitle: "Create analytics report",
      icon: FileText,
      action: () => navigate(moduleIdToPath("pulse", { action: "report" }))
    }
  ];

  // Export actions (merged from CommandPalette)
  const exportActions: SearchResult[] = [
    {
      id: "export-fleet",
      type: "export",
      title: "Export Fleet Data",
      subtitle: "Download CSV of all vehicles",
      icon: Download,
      action: async () => {
        try {
          const { data, error } = await supabase.from("vehicles").select("*");
          if (error) throw error;
          if (data && data.length > 0) {
            exportToCSV(data, "fleet-data");
            toast({ title: "Export complete", description: `${data.length} vehicles exported` });
          } else {
            toast({ title: "No data", description: "No vehicles to export", variant: "destructive" });
          }
        } catch {
          toast({ title: "Export failed", description: "Could not export fleet data", variant: "destructive" });
        }
      },
    },
    {
      id: "export-bookings",
      type: "export",
      title: "Export Bookings",
      subtitle: "Download booking history",
      icon: Download,
      action: async () => {
        try {
          const { data, error } = await supabase.from("bookings").select("*");
          if (error) throw error;
          if (data && data.length > 0) {
            exportToCSV(data, "bookings-export");
            toast({ title: "Export complete", description: `${data.length} bookings exported` });
          } else {
            toast({ title: "No data", description: "No bookings to export", variant: "destructive" });
          }
        } catch {
          toast({ title: "Export failed", description: "Could not export bookings", variant: "destructive" });
        }
      },
    },
  ];

  // Module navigation
  const modules: SearchResult[] = [
    {
      id: "motoriq",
      type: "module",
      title: "MotorIQ",
      subtitle: "AI Pricing Optimization",
      icon: TrendingUp,
      action: () => navigate(moduleIdToPath("motoriq"))
    },
    {
      id: "pulse",
      type: "module",
      title: "Pulse",
      subtitle: "Live Analytics & Telematics",
      icon: BarChart3,
      action: () => navigate(moduleIdToPath("pulse"))
    },
    {
      id: "book",
      type: "module",
      title: "Book",
      subtitle: "Booking Management",
      icon: Calendar,
      action: () => navigate(moduleIdToPath("book"))
    },
    {
      id: "vault",
      type: "module",
      title: "Vault",
      subtitle: "Compliance & Documents",
      icon: Shield,
      action: () => navigate(moduleIdToPath("vault"))
    },
    {
      id: "core",
      type: "module",
      title: "FleetCopilot™",
      subtitle: "AI Control Center",
      icon: Brain,
      action: () => navigate(moduleIdToPath("core"))
    },
    {
      id: "messages-nav",
      type: "module",
      title: "Team Messages",
      subtitle: "Internal communications",
      icon: MessageSquare,
      action: () => navigate(moduleIdToPath("messages"))
    },
    {
      id: "settings",
      type: "module",
      title: "Settings",
      subtitle: "System configuration",
      icon: Settings,
      action: () => navigate(moduleIdToPath("settings"))
    }
  ];

  // Helper: get booking summary for a customer
  const getCustomerBookingSummary = useCallback((customerId: string) => {
    const customerBookings = bookings.filter(b => b.customer_id === customerId);
    if (customerBookings.length === 0) return null;
    const active = customerBookings.filter(b => ['confirmed', 'active', 'rented'].includes(b.status?.toLowerCase() || '')).length;
    const pending = customerBookings.filter(b => b.status?.toLowerCase() === 'pending').length;
    const parts: string[] = [];
    if (active > 0) parts.push(`${active} active`);
    if (pending > 0) parts.push(`${pending} pending`);
    if (parts.length === 0) parts.push(`${customerBookings.length} total`);
    return parts.join(' · ');
  }, [bookings]);

  // Search results with fixed deep-linking
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search vehicles → deep-link to Vehicle Command Center
    vehicles
      .filter(v => 
        v.make.toLowerCase().includes(query) ||
        v.model.toLowerCase().includes(query) ||
        v.license_plate?.toLowerCase().includes(query) ||
        (v as any).name?.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .forEach(v => {
        const plate = v.license_plate ? `${v.license_plate} · ` : '';
        results.push({
          id: v.id,
          type: "vehicle",
          title: `${v.make} ${v.model}`,
          subtitle: `${plate}${v.status || 'Unknown'}`,
          icon: Car,
          action: () => navigate(moduleIdToPath("motoriq", { vehicleId: v.id })),
          badge: v.status
        });
      });

    // Search customers → deep-link to CRM card with booking context
    customers
      .filter(c =>
        c.full_name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .forEach(c => {
        const bookingSummary = getCustomerBookingSummary(c.id);
        const subtitle = bookingSummary 
          ? `${c.email} · ${bookingSummary}`
          : c.email;
        results.push({
          id: c.id,
          type: "customer",
          title: c.full_name,
          subtitle,
          icon: Users,
          action: () => navigate(moduleIdToPath("book", { tab: "crm", customerId: c.id }))
        });
      });

    // Search bookings — by customer name, vehicle, status, ref, OR UUID
    bookings
      .filter(b =>
        b.customer_name?.toLowerCase().includes(query) ||
        b.status?.toLowerCase().includes(query) ||
        b.vehicle_name?.toLowerCase().includes(query) ||
        (b as any).booking_ref?.toLowerCase().includes(query) ||
        b.id.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .forEach(b => {
        results.push({
          id: b.id,
          type: "booking",
          title: `${(b as any).booking_ref ? (b as any).booking_ref + ' — ' : ''}${b.customer_name || "Unknown Customer"}`,
          subtitle: `${new Date(b.start_date).toLocaleDateString()} · ${b.vehicle_name || 'No vehicle'} · ${b.status}`,
          icon: Calendar,
          action: () => navigate(moduleIdToPath("book", { bookingId: b.id })),
          badge: b.status
        });
      });

    // Also search export actions
    exportActions
      .filter(e => e.title.toLowerCase().includes(query) || e.subtitle?.toLowerCase().includes(query))
      .forEach(e => results.push(e));

    return results;
  }, [searchQuery, vehicles, customers, bookings, navigate, getCustomerBookingSummary]);

  // Group search results by type for categorized display
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    searchResults.forEach(r => {
      const label = r.type === "vehicle" ? "Vehicles" : r.type === "customer" ? "Customers" : r.type === "booking" ? "Bookings" : "Actions";
      if (!groups[label]) groups[label] = [];
      groups[label].push(r);
    });
    return groups;
  }, [searchResults]);

  const getStatusColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case "available": return "bg-success/10 text-success";
      case "rented": return "bg-primary/10 text-primary";
      case "maintenance": return "bg-warning/10 text-warning";
      case "confirmed": return "bg-success/10 text-success";
      case "pending": return "bg-warning/10 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-smooth text-sm text-muted-foreground w-full md:w-64 group"
      >
        <Search className="w-4 h-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-muted rounded">⌘K</kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search vehicles, customers, bookings, or type a command..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList className="max-h-[400px]">
          <CommandEmpty>
            <div className="flex flex-col items-center py-6 text-muted-foreground">
              <Search className="w-10 h-10 mb-2 opacity-20" />
              <p>No results found</p>
              <p className="text-xs mt-1">Try searching by license plate, booking ref (BK-01001),</p>
              <p className="text-xs">customer name, or vehicle make/model</p>
            </div>
          </CommandEmpty>

          {/* Categorized Search Results */}
          {Object.entries(groupedResults).map(([label, results]) => (
            <CommandGroup key={label} heading={`${label} (${results.length})`}>
              {results.map((result) => (
                <CommandItem
                  key={result.id}
                  onSelect={() => handleSelect(result.action, searchQuery)}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <result.icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{result.title}</p>
                      {result.subtitle && (
                        <p className="text-xs text-muted-foreground">{result.subtitle}</p>
                      )}
                    </div>
                  </div>
                  {result.badge && (
                    <Badge variant="secondary" className={`text-xs ${getStatusColor(result.badge)}`}>
                      {result.badge}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ))}

          {/* Quick Actions - Show when no search query */}
          {!searchQuery && (
            <>
              <CommandGroup heading="Quick Actions">
                {quickActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    onSelect={() => handleSelect(action.action)}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-md bg-primary/10">
                        <action.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{action.title}</p>
                        <p className="text-xs text-muted-foreground">{action.subtitle}</p>
                      </div>
                    </div>
                    {action.badge && (
                      <kbd className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                        {action.badge}
                      </kbd>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Exports">
                {exportActions.map((action) => (
                  <CommandItem
                    key={action.id}
                    onSelect={() => handleSelect(action.action)}
                    className="flex items-center gap-3"
                  >
                    <action.icon className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{action.title}</p>
                      <p className="text-xs text-muted-foreground">{action.subtitle}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>

              <CommandSeparator />

              <CommandGroup heading="Navigate To">
                {modules.map((module) => (
                  <CommandItem
                    key={module.id}
                    onSelect={() => handleSelect(module.action)}
                    className="flex items-center gap-3"
                  >
                    <module.icon className="w-4 h-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{module.title}</p>
                      <p className="text-xs text-muted-foreground">{module.subtitle}</p>
                    </div>
                    <ArrowRight className="w-3 h-3 text-muted-foreground" />
                  </CommandItem>
                ))}
              </CommandGroup>

              {recentSearches.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Recent Searches">
                    {recentSearches.map((search, i) => (
                      <CommandItem
                        key={i}
                        onSelect={() => setSearchQuery(search)}
                        className="flex items-center gap-3"
                      >
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        <span>{search}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </>
          )}

          {/* Ask Rari — replaces generic "Ask FleetCopilot" */}
          {searchQuery && (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => handleSelect(() => {
                    if (onOpenRari) {
                      onOpenRari(searchQuery);
                    } else {
                      navigate(moduleIdToPath("core"));
                    }
                  }, searchQuery)}
                  className="flex items-center gap-3 bg-primary/5"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium">Ask Rari</p>
                    <p className="text-xs text-muted-foreground">
                      "{searchQuery}" — Get AI-powered answers
                    </p>
                  </div>
                </CommandItem>
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
