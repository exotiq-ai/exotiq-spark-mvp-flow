import { Card } from "@/components/ui/card";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useNavigate } from "react-router-dom";
import { moduleIdToPath } from "@/lib/moduleRoutes";
import { 
  Car, 
  ArrowUpRight, 
  ArrowDownLeft,
  DollarSign
} from "lucide-react";
import { format, isToday } from "date-fns";

export const TodaySnapshot = () => {
  const { vehicles, bookings, payments } = useLocationFilteredFleet();
  const navigate = useNavigate();
  
  // Calculate today's metrics - get unique vehicles currently out
  const today = new Date();
  const vehicleIdsOut = new Set(
    bookings
      .filter(b => 
        b.status === 'confirmed' &&
        new Date(b.start_date) <= today &&
        new Date(b.end_date) >= today
      )
      .map(b => b.vehicle_id)
  );
  const vehiclesOut = vehicleIdsOut.size;
  
  const totalVehicles = vehicles.length;
  
  // Pickups today - confirmed bookings starting today
  const pickupsToday = bookings.filter(b => 
    isToday(new Date(b.start_date)) && b.status === 'confirmed'
  );
  const pickupsCompleted = pickupsToday.length;
  
  // Returns today - confirmed bookings ending today
  const returnsToday = bookings.filter(b => 
    isToday(new Date(b.end_date)) && (b.status === 'confirmed' || b.status === 'completed')
  );
  const returnsCompleted = returnsToday.filter(b => b.status === 'completed').length;
  
  const todayRevenue = payments
    .filter(p => p.transaction_date && isToday(new Date(p.transaction_date)))
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const metrics = [
    { 
      label: "Vehicles Out", 
      value: `${vehiclesOut}`,
      subtext: `of ${totalVehicles}`,
      icon: Car,
      color: "text-primary",
      onClick: () => navigate(moduleIdToPath("pulse"))
    },
    { 
      label: "Pickups Today", 
      value: pickupsToday.length.toString(),
      subtext: `${pickupsCompleted} scheduled`,
      icon: ArrowUpRight,
      color: "text-success",
      onClick: () => navigate(moduleIdToPath("book", { filter: "pickups-today" }))
    },
    { 
      label: "Returns Today", 
      value: returnsToday.length.toString(),
      subtext: `${returnsCompleted} completed`,
      icon: ArrowDownLeft,
      color: "text-warning",
      onClick: () => navigate(moduleIdToPath("book", { filter: "returns-today" }))
    },
    { 
      label: "Collected Today", 
      value: `$${todayRevenue.toLocaleString()}`,
      subtext: format(new Date(), 'MMM d'),
      icon: DollarSign,
      color: "text-success",
      onClick: () => navigate('/dashboard?module=vault&tab=payments')
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric, index) => (
        <Card 
          key={index} 
          className="p-4 bg-card/50 backdrop-blur-sm border-border/50 cursor-pointer hover:bg-card/80 hover:border-primary/30 transition-all"
          onClick={metric.onClick}
        >
          <div className="flex items-center gap-2 mb-2">
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
            <span className="text-xs text-muted-foreground">{metric.label}</span>
          </div>
          <div className="text-2xl font-bold">{metric.value}</div>
          <div className="text-xs text-muted-foreground">{metric.subtext}</div>
        </Card>
      ))}
    </div>
  );
};
