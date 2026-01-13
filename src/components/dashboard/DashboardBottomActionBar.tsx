import { useState } from "react";
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
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
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

  // Filter results based on search query
  const filteredVehicles = vehicles
    .filter(v => 
      v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.license_plate?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 3);

  const filteredCustomers = customers
    .filter(c => 
      c.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 3);

  const filteredBookings = bookings
    .filter(b => 
      b.customer_name?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .slice(0, 3);

  const handleSelect = (callback: () => void) => {
    setSearchOpen(false);
    setSearchQuery("");
    callback();
  };

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
          
          {filteredVehicles.length > 0 && (
            <CommandGroup heading="Vehicles">
              {filteredVehicles.map(vehicle => (
                <CommandItem
                  key={vehicle.id}
                  onSelect={() => handleSelect(() => navigate(`/fleet/${vehicle.id}`))}
                >
                  <span>{vehicle.name}</span>
                  {vehicle.license_plate && (
                    <span className="ml-2 text-muted-foreground text-xs">{vehicle.license_plate}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {filteredCustomers.length > 0 && (
            <CommandGroup heading="Customers">
              {filteredCustomers.map(customer => (
                <CommandItem
                  key={customer.id}
                  onSelect={() => handleSelect(() => navigate(`/customers/${customer.id}`))}
                >
                  <span>{customer.full_name}</span>
                  <span className="ml-2 text-muted-foreground text-xs">{customer.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          
          {filteredBookings.length > 0 && (
            <CommandGroup heading="Bookings">
              {filteredBookings.map(booking => (
                <CommandItem
                  key={booking.id}
                  onSelect={() => handleSelect(() => navigate(`/dashboard?module=book&bookingId=${booking.id}`))}
                >
                  <span>{booking.customer_name}</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    {new Date(booking.start_date).toLocaleDateString()}
                  </span>
                </CommandItem>
              ))}
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
