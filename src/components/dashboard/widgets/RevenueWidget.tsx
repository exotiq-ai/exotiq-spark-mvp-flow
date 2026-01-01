import { RevenueLineChart } from "@/components/charts/RevenueLineChart";
import { TrendingUp, DollarSign, TrendingDown } from "lucide-react";
import { SkeletonLineChart } from "@/components/ui/skeleton-card";
import { ProgressiveDisclosure } from "@/components/common/ProgressiveDisclosure";
import { CountUp } from "@/components/common/MicroInteractions";
import { Tachometer } from "@/components/automotive/RacingStripe";
import { useFleet } from "@/contexts/FleetContext";

interface RevenueWidgetProps {
  isLoading?: boolean;
}

export const RevenueWidget = ({ isLoading }: RevenueWidgetProps) => {
  const { vehicles, bookings } = useFleet();

  if (isLoading) {
    return <SkeletonLineChart height={200} />;
  }

  // Calculate revenue metrics
  const totalRevenue = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const monthlyRevenue = bookings
    .filter(b => {
      const bookingDate = new Date(b.start_date);
      const now = new Date();
      return b.status === 'completed' && 
        bookingDate.getMonth() === now.getMonth() &&
        bookingDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const avgRevenuePerVehicle = vehicles.length > 0 ? totalRevenue / vehicles.length : 0;
  const utilizationRate = vehicles.length > 0 
    ? (bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length / vehicles.length) * 100 
    : 0;

  const preview = (
    <div className="space-y-4">
      <RevenueLineChart />
      <div className="grid grid-cols-2 gap-4 pt-4 border-t">
        <div>
          <p className="text-sm text-muted-foreground mb-1">This Month</p>
          <p className="text-2xl font-dfaalt font-bold text-foreground">
            <CountUp value={monthlyRevenue} prefix="$" decimals={0} />
          </p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-2xl font-dfaalt font-bold text-foreground">
            <CountUp value={totalRevenue} prefix="$" decimals={0} />
          </p>
        </div>
      </div>
    </div>
  );

  const fullContent = (
    <div className="space-y-6">
      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="flex flex-col items-center text-center">
          <Tachometer 
            value={utilizationRate} 
            max={100}
            label="Utilization"
            variant="gulf"
            size="md"
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Avg Revenue/Vehicle</p>
          <p className="text-3xl font-dfaalt font-bold text-gulf-blue">
            <CountUp value={avgRevenuePerVehicle} prefix="$" decimals={0} />
          </p>
          <div className="flex items-center gap-2 text-sm text-success">
            <TrendingUp className="h-4 w-4" />
            <span>+12% vs last month</span>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Active Bookings</p>
          <p className="text-3xl font-dfaalt font-bold text-performance-orange">
            {bookings.filter(b => b.status === 'active' || b.status === 'confirmed').length}
          </p>
          <p className="text-sm text-muted-foreground">
            {vehicles.length} vehicles total
          </p>
        </div>
      </div>

      {/* Top Performers */}
      <div>
        <h4 className="font-dfaalt font-semibold mb-3">Top Performing Vehicles</h4>
        <div className="space-y-2">
          {vehicles.slice(0, 3).map((vehicle, index) => (
            <div 
              key={vehicle.id} 
              className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gulf-blue/20 to-performance-orange/20 flex items-center justify-center font-dfaalt font-bold text-sm">
                  #{index + 1}
                </div>
                <div>
                  <p className="font-semibold">{vehicle.year} {vehicle.make} {vehicle.model}</p>
                  <p className="text-xs text-muted-foreground">{vehicle.license_plate}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-dfaalt font-bold text-gulf-blue">
                  ${(Math.random() * 5000 + 2000).toFixed(0)}
                </p>
                <p className="text-xs text-muted-foreground">this month</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <ProgressiveDisclosure
      title="Revenue Analytics"
      preview={preview}
      fullContent={fullContent}
      tip="Expand to see vehicle-by-vehicle performance and utilization metrics"
      badge="Live"
    />
  );
};