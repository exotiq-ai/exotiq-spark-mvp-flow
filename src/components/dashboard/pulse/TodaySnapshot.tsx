import { Card } from "@/components/ui/card";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { 
  Car, 
  ArrowUpRight, 
  ArrowDownLeft,
  DollarSign
} from "lucide-react";
import { format, isToday } from "date-fns";

export const TodaySnapshot = () => {
  const { vehicles, bookings, payments } = useLocationFilteredFleet();
  
  // Calculate today's metrics
  const vehiclesOut = bookings.filter(b => 
    b.status === 'active' || b.status === 'confirmed'
  ).length;
  
  const totalVehicles = vehicles.length;
  
  const pickupsToday = bookings.filter(b => 
    isToday(new Date(b.start_date))
  );
  const pickupsCompleted = pickupsToday.filter(b => b.status === 'active').length;
  
  const returnsToday = bookings.filter(b => 
    isToday(new Date(b.end_date))
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
      color: "text-primary"
    },
    { 
      label: "Pickups Today", 
      value: pickupsToday.length.toString(),
      subtext: `${pickupsCompleted} completed`,
      icon: ArrowUpRight,
      color: "text-success"
    },
    { 
      label: "Returns Today", 
      value: returnsToday.length.toString(),
      subtext: `${returnsCompleted} completed`,
      icon: ArrowDownLeft,
      color: "text-warning"
    },
    { 
      label: "Revenue Today", 
      value: `$${todayRevenue.toLocaleString()}`,
      subtext: format(new Date(), 'MMM d'),
      icon: DollarSign,
      color: "text-success"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {metrics.map((metric, index) => (
        <Card 
          key={index} 
          className="p-4 bg-card/50 backdrop-blur-sm border-border/50"
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
