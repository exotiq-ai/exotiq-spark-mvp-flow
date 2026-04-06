import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  CalendarPlus,
  CreditCard,
  UserPlus,
  FileText,
  Wrench,
  Mic,
  Search,
  Car,
  Users,
  Calendar,
  TrendingUp,
  BarChart3,
  Brain,
  Shield,
  Settings,
  Sparkles,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { moduleIdToPath } from "@/lib/moduleRoutes";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";

interface ActionItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
}

interface DashboardBottomActionBarProps {
  onNewBooking: () => void;
  onRecordPayment: () => void;
  onAddCustomer: () => void;
  onGenerateReport: () => void;
  onScheduleMaintenance: () => void;
  onAskRari: () => void;
  rariUnreadCount?: number;
}

export const DashboardBottomActionBar = ({
  onNewBooking,
  onRecordPayment,
  onAddCustomer,
  onGenerateReport,
  onScheduleMaintenance,
  onAskRari,
  rariUnreadCount = 0,
}: DashboardBottomActionBarProps) => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { vehicles, customers, bookings } = useLocationFilteredFleet();

  const actions: ActionItem[] = [
    {
      id: "booking",
      label: "New Booking",
      icon: CalendarPlus,
      onClick: onNewBooking,
    },
    {
      id: "payment",
      label: "Record Payment",
      icon: CreditCard,
      onClick: onRecordPayment,
    },
    {
      id: "customer",
      label: "Add Customer",
      icon: UserPlus,
      onClick: onAddCustomer,
    },
    {
      id: "report",
      label: "Generate Report",
      icon: FileText,
      onClick: onGenerateReport,
    },
    {
      id: "service",
      label: "Schedule Service",
      icon: Wrench,
      onClick: onScheduleMaintenance,
    },
  ];

  // Quick actions for when no query
  const quickActions = [
    { id: "new-booking", label: "New Booking", icon: CalendarPlus, action: onNewBooking },
    { id: "add-customer", label: "Add Customer", icon: UserPlus, action: onAddCustomer },
    { id: "record-payment", label: "Record Payment", icon: CreditCard, action: onRecordPayment },
  ];

  // Module navigation
  const modules = [
    { id: "motoriq", label: "MotorIQ", icon: TrendingUp, path: "/dashboard?module=motoriq" },
    { id: "pulse", label: "Pulse", icon: BarChart3, path: "/dashboard?module=pulse" },
    { id: "book", label: "Bookings", icon: Calendar, path: "/dashboard?module=book" },
    { id: "core", label: "FleetCopilot™", icon: Brain, path: "/dashboard?module=core" },
    { id: "vault", label: "Vault", icon: Shield, path: "/dashboard?module=vault" },
    { id: "settings", label: "Settings", icon: Settings, path: "/dashboard?module=settings" },
  ];

  // Filter results based on search query - increased limits and better matching
  const filteredVehicles = useMemo(() => 
    vehicles
      .filter(v => {
        const query = searchQuery.toLowerCase();
        return (
          v.make?.toLowerCase().includes(query) ||
          v.model?.toLowerCase().includes(query) ||
          v.license_plate?.toLowerCase().includes(query) ||
          `${v.make} ${v.model}`.toLowerCase().includes(query)
        );
      })
      .slice(0, 5),
    [vehicles, searchQuery]
  );

  const filteredCustomers = useMemo(() =>
    customers
      .filter(c => 
        c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5),
    [customers, searchQuery]
  );

  const filteredBookings = useMemo(() =>
    bookings
      .filter(b => 
        b.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.status?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 5),
    [bookings, searchQuery]
  );

  // Status badge colors
  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('confirmed') || statusLower.includes('active')) return 'bg-success/10 text-success';
    if (statusLower.includes('pending')) return 'bg-warning/10 text-warning';
    if (statusLower.includes('cancelled') || statusLower.includes('overdue')) return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  const handleSelect = (callback: () => void) => {
    setSearchOpen(false);
    setSearchQuery("");
    callback();
  };

  const hasQuery = searchQuery.trim().length > 0;
  const hasResults = filteredVehicles.length > 0 || filteredCustomers.length > 0 || filteredBookings.length > 0;

  return (
    <>
      {/* Search Command Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
        <CommandInput 
          placeholder="Search vehicles, customers, bookings..." 
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          
          {/* Quick Actions - Show when no query */}
          {!hasQuery && (
            <>
              <CommandGroup heading="Quick Actions">
                {quickActions.map(action => (
                  <CommandItem
                    key={action.id}
                    onSelect={() => handleSelect(action.action)}
                  >
                    <action.icon className="mr-2 h-4 w-4 text-primary" />
                    <span>{action.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              
              <CommandGroup heading="Navigate To">
                {modules.map(module => (
                  <CommandItem
                    key={module.id}
                    onSelect={() => handleSelect(() => navigate(module.path))}
                  >
                    <module.icon className="mr-2 h-4 w-4" />
                    <span>{module.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
          
          {/* Vehicles - Navigate to specific vehicle in MotorIQ */}
          {filteredVehicles.length > 0 && (
            <CommandGroup heading="Vehicles">
              {filteredVehicles.map(vehicle => (
                <CommandItem
                  key={vehicle.id}
                  onSelect={() => handleSelect(() => navigate(moduleIdToPath("motoriq", { vehicleId: vehicle.id })))}
                >
                  <Car className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{vehicle.make} {vehicle.model}</span>
                  {vehicle.license_plate && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {vehicle.license_plate}
                    </Badge>
                  )}
                  {vehicle.status && (
                    <Badge className={cn("ml-auto text-xs", getStatusColor(vehicle.status))}>
                      {vehicle.status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {/* Customers - Navigate to specific customer in Core */}
          {filteredCustomers.length > 0 && (
            <CommandGroup heading="Customers">
              {filteredCustomers.map(customer => (
                <CommandItem
                  key={customer.id}
                  onSelect={() => handleSelect(() => navigate(moduleIdToPath("core", { customerId: customer.id })))}
                >
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{customer.full_name}</span>
                  <span className="ml-2 text-muted-foreground text-xs truncate max-w-[150px]">
                    {customer.email}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {/* Bookings - Navigate to specific booking */}
          {filteredBookings.length > 0 && (
            <CommandGroup heading="Bookings">
              {filteredBookings.map(booking => (
                <CommandItem
                  key={booking.id}
                  onSelect={() => handleSelect(() => navigate(moduleIdToPath("book", { bookingId: booking.id })))}
                >
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{booking.customer_name}</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {new Date(booking.start_date).toLocaleDateString()}
                  </span>
                  {booking.status && (
                    <Badge className={cn("ml-auto text-xs", getStatusColor(booking.status))}>
                      {booking.status}
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* AI Suggestion when query exists */}
          {hasQuery && (
            <CommandGroup heading="AI Assistant">
              <CommandItem
                onSelect={() => handleSelect(() => {
                  onAskRari();
                })}
                className="bg-gradient-to-r from-rari-teal/10 to-transparent"
              >
                <Sparkles className="mr-2 h-4 w-4 text-rari-teal" />
                <span>Ask FleetCopilot™ about "{searchQuery}"</span>
              </CommandItem>
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>

      {/* Floating Action Dock */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, delay: 0.1 }}
        className={cn(
          "sticky bottom-4 z-30 mx-auto w-fit",
          "hidden md:flex items-center gap-2",
          "px-3 py-2.5",
          "bg-background/95 backdrop-blur-xl",
          "border border-border rounded-2xl",
          "shadow-xl shadow-black/10"
        )}
      >
        {/* Quick Action Buttons */}
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-1">
            {actions.map((action, index) => (
              <Tooltip key={action.id}>
                <TooltipTrigger asChild>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={action.onClick}
                    className={cn(
                      "p-2.5 rounded-xl",
                      "text-muted-foreground hover:text-foreground",
                      "hover:bg-muted/80 active:bg-muted",
                      "transition-all duration-200",
                      "hover:scale-105 active:scale-95"
                    )}
                  >
                    <action.icon className="h-[18px] w-[18px]" />
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {action.label}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>

        {/* Divider */}
        <div className="w-px h-7 bg-border mx-1" />

        {/* Search Input */}
        <button
          onClick={() => setSearchOpen(true)}
          className={cn(
            "flex items-center gap-2 px-3 py-2",
            "bg-muted/50 hover:bg-muted/80",
            "rounded-xl transition-colors",
            "min-w-[160px]"
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Search...</span>
          <kbd className="ml-auto text-[10px] text-muted-foreground/60 bg-background px-1.5 py-0.5 rounded border border-border/50">
            ⌘K
          </kbd>
        </button>

        {/* Divider */}
        <div className="w-px h-7 bg-border mx-1" />

        {/* Rari Voice AI Button */}
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onAskRari}
          className={cn(
            "relative p-3 rounded-full",
            "bg-gradient-to-br from-rari-teal to-success",
            "text-white shadow-lg",
            "transition-shadow duration-200",
            "hover:shadow-rari-teal/30 hover:shadow-xl"
          )}
        >
          <Mic className="h-5 w-5" />
          
          {/* Pulse animation when insights available */}
          {rariUnreadCount > 0 && (
            <>
              <span className="absolute inset-0 rounded-full bg-rari-teal/30 animate-ping" />
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 shadow">
                {rariUnreadCount > 9 ? "9+" : rariUnreadCount}
              </span>
            </>
          )}
        </motion.button>
      </motion.div>
    </>
  );
};
