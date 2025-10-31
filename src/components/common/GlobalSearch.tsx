import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Car,
  Users,
  Calendar,
  FileText,
  DollarSign,
  Settings,
  AlertTriangle,
  Search
} from "lucide-react";
import { useFleet } from "@/contexts/FleetContext";

export const GlobalSearch = () => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { vehicles, customers, bookings } = useFleet();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (callback: () => void) => {
    setOpen(false);
    setSearchQuery("");
    callback();
  };

  const filteredVehicles = vehicles.filter(
    (v) =>
      v.make.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.license_plate?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const filteredCustomers = customers.filter(
    (c) =>
      c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const filteredBookings = bookings.filter(
    (b) =>
      b.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.status.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 5);

  const quickActions = [
    {
      title: "Go to MotorIQ",
      icon: DollarSign,
      action: () => navigate("/dashboard?module=motoriq")
    },
    {
      title: "Go to Pulse",
      icon: AlertTriangle,
      action: () => navigate("/dashboard?module=pulse")
    },
    {
      title: "Go to Book",
      icon: Calendar,
      action: () => navigate("/dashboard?module=book")
    },
    {
      title: "Go to Vault",
      icon: FileText,
      action: () => navigate("/dashboard?module=vault")
    },
    {
      title: "Go to Core",
      icon: Settings,
      action: () => navigate("/dashboard?module=core")
    }
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-smooth text-sm text-muted-foreground w-full md:w-64"
      >
        <Search className="w-4 h-4" />
        <span>Search...</span>
        <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search vehicles, customers, bookings..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>

          {quickActions.length > 0 && !searchQuery && (
            <CommandGroup heading="Quick Actions">
              {quickActions.map((action) => (
                <CommandItem
                  key={action.title}
                  onSelect={() => handleSelect(action.action)}
                >
                  <action.icon className="mr-2 h-4 w-4" />
                  <span>{action.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredVehicles.length > 0 && (
            <CommandGroup heading="Vehicles">
              {filteredVehicles.map((vehicle) => (
                <CommandItem
                  key={vehicle.id}
                  onSelect={() => handleSelect(() => navigate("/dashboard?module=motoriq"))}
                >
                  <Car className="mr-2 h-4 w-4" />
                  <span>{vehicle.make} {vehicle.model}</span>
                  {vehicle.license_plate && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {vehicle.license_plate}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredCustomers.length > 0 && (
            <CommandGroup heading="Customers">
              {filteredCustomers.map((customer) => (
                <CommandItem
                  key={customer.id}
                  onSelect={() => handleSelect(() => navigate("/dashboard?module=core"))}
                >
                  <Users className="mr-2 h-4 w-4" />
                  <span>{customer.full_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {customer.email}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {filteredBookings.length > 0 && (
            <CommandGroup heading="Bookings">
              {filteredBookings.map((booking) => (
                <CommandItem
                  key={booking.id}
                  onSelect={() => handleSelect(() => navigate("/dashboard?module=book"))}
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  <span>{booking.customer_name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {booking.status}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
};
