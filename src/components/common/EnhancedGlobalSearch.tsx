import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
  Sparkles
} from "lucide-react";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";

interface SearchResult {
  id: string;
  type: "vehicle" | "customer" | "booking" | "action" | "module";
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action: () => void;
  badge?: string;
}

export const EnhancedGlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const navigate = useNavigate();
  const { vehicles, customers, bookings } = useLocationFilteredFleet();

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) {
      setRecentSearches(JSON.parse(saved));
    }
  }, []);

  // Save recent searches
  const addRecentSearch = (term: string) => {
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  // NOTE: ⌘K shortcut is now handled exclusively by CommandPalette in App.tsx
  // This search is opened via the button click only

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
      action: () => navigate("/dashboard?module=book&action=new"),
      badge: "⌘N"
    },
    {
      id: "add-vehicle",
      type: "action",
      title: "Add Vehicle",
      subtitle: "Add a new vehicle to fleet",
      icon: Car,
      action: () => navigate("/dashboard?module=core&action=add-vehicle")
    },
    {
      id: "add-customer",
      type: "action",
      title: "Add Customer",
      subtitle: "Register a new customer",
      icon: Users,
      action: () => navigate("/dashboard?module=core&action=add-customer")
    },
    {
      id: "generate-report",
      type: "action",
      title: "Generate Report",
      subtitle: "Create analytics report",
      icon: FileText,
      action: () => navigate("/dashboard?module=pulse&action=report")
    }
  ];

  // Module navigation
  const modules: SearchResult[] = [
    {
      id: "motoriq",
      type: "module",
      title: "MotorIQ",
      subtitle: "AI Pricing Optimization",
      icon: TrendingUp,
      action: () => navigate("/dashboard?module=motoriq")
    },
    {
      id: "pulse",
      type: "module",
      title: "Pulse",
      subtitle: "Live Analytics & Telematics",
      icon: BarChart3,
      action: () => navigate("/dashboard?module=pulse")
    },
    {
      id: "book",
      type: "module",
      title: "Book",
      subtitle: "Booking Management",
      icon: Calendar,
      action: () => navigate("/dashboard?module=book")
    },
    {
      id: "vault",
      type: "module",
      title: "Vault",
      subtitle: "Compliance & Documents",
      icon: Shield,
      action: () => navigate("/dashboard?module=vault")
    },
    {
      id: "core",
      type: "module",
      title: "FleetCopilot™",
      subtitle: "AI Control Center",
      icon: Brain,
      action: () => navigate("/dashboard?module=core")
    },
    {
      id: "settings",
      type: "module",
      title: "Settings",
      subtitle: "System configuration",
      icon: Settings,
      action: () => navigate("/dashboard?module=settings")
    }
  ];

  // Search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results: SearchResult[] = [];

    // Search vehicles
    vehicles
      .filter(v => 
        v.make.toLowerCase().includes(query) ||
        v.model.toLowerCase().includes(query) ||
        v.license_plate?.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .forEach(v => {
        results.push({
          id: v.id,
          type: "vehicle",
          title: `${v.make} ${v.model}`,
          subtitle: v.license_plate || v.status,
          icon: Car,
          action: () => navigate("/dashboard?module=motoriq"),
          badge: v.status
        });
      });

    // Search customers
    customers
      .filter(c =>
        c.full_name.toLowerCase().includes(query) ||
        c.email.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .forEach(c => {
        results.push({
          id: c.id,
          type: "customer",
          title: c.full_name,
          subtitle: c.email,
          icon: Users,
          action: () => navigate("/dashboard?module=core")
        });
      });

    // Search bookings (including booking_ref)
    bookings
      .filter(b =>
        b.customer_name?.toLowerCase().includes(query) ||
        b.status?.toLowerCase().includes(query) ||
        b.vehicle_name?.toLowerCase().includes(query) ||
        (b as any).booking_ref?.toLowerCase().includes(query)
      )
      .slice(0, 5)
      .forEach(b => {
        results.push({
          id: b.id,
          type: "booking",
          title: `${(b as any).booking_ref ? (b as any).booking_ref + ' — ' : ''}${b.customer_name || "Unknown Customer"}`,
          subtitle: `${new Date(b.start_date).toLocaleDateString()} - ${b.status}`,
          icon: Calendar,
          action: () => navigate(`/dashboard?module=book&bookingId=${b.id}`),
          badge: b.status
        });
      });

    return results;
  }, [searchQuery, vehicles, customers, bookings, navigate]);

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
              <p className="text-xs">Try a different search term</p>
            </div>
          </CommandEmpty>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <CommandGroup heading="Search Results">
              {searchResults.map((result) => (
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
          )}

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

          {/* AI Suggestion */}
          {searchQuery && (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => handleSelect(() => navigate("/dashboard?module=core"), searchQuery)}
                  className="flex items-center gap-3 bg-primary/5"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <div>
                    <p className="font-medium">Ask FleetCopilot™</p>
                    <p className="text-xs text-muted-foreground">
                      "{searchQuery}" - Get AI-powered answers
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
