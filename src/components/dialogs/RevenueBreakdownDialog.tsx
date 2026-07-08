import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import { DollarSign, Car, Users, Calendar } from "lucide-react";
import { useMoney } from "@/hooks/useMoney";

type Booking = Tables<'bookings'>;

interface RevenueBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  revenue: number;
  bookings: Booking[];
  vehicles: Tables<'vehicles'>[];
}

export const RevenueBreakdownDialog = ({
  open,
  onOpenChange,
  date,
  revenue,
  bookings,
  vehicles
}: RevenueBreakdownDialogProps) => {
  const { money } = useMoney();
  // Calculate breakdown by vehicle
  const vehicleBreakdown = bookings.reduce((acc, booking) => {
    const vehicle = vehicles.find(v => v.id === booking.vehicle_id);
    const vehicleName = vehicle?.name || 'Unknown Vehicle';
    
    if (!acc[vehicleName]) {
      acc[vehicleName] = {
        count: 0,
        revenue: 0
      };
    }
    
    acc[vehicleName].count += 1;
    acc[vehicleName].revenue += Number(booking.total_value);
    
    return acc;
  }, {} as Record<string, { count: number; revenue: number }>);

  const sortedVehicles = Object.entries(vehicleBreakdown)
    .sort((a, b) => b[1].revenue - a[1].revenue);

  // Get top customers
  const customerBreakdown = bookings.reduce((acc, booking) => {
    if (!acc[booking.customer_name]) {
      acc[booking.customer_name] = 0;
    }
    acc[booking.customer_name] += Number(booking.total_value);
    return acc;
  }, {} as Record<string, number>);

  const topCustomers = Object.entries(customerBreakdown)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Revenue Breakdown - {date}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Total Revenue Card */}
          <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
                <h3 className="text-4xl font-bold">{money(revenue)}</h3>
              </div>
              <div className="p-4 bg-primary/20 rounded-2xl">
                <DollarSign className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-sm">
              <Badge variant="outline">{bookings.length} bookings</Badge>
              <Badge variant="outline">{sortedVehicles.length} vehicles</Badge>
            </div>
          </Card>

          {/* Breakdown by Vehicle */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Car className="h-4 w-4 text-primary" />
              By Vehicle
            </h4>
            <div className="space-y-2">
              {sortedVehicles.map(([vehicleName, data]) => (
                <div 
                  key={vehicleName}
                  className="p-3 rounded-lg bg-muted/30 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium">{vehicleName}</p>
                    <p className="text-xs text-muted-foreground">{data.count} booking{data.count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">${data.revenue.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      {((data.revenue / revenue) * 100).toFixed(0)}% of total
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Customers */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Top Customers
            </h4>
            <div className="space-y-2">
              {topCustomers.map(([customerName, amount], index) => (
                <div 
                  key={customerName}
                  className="p-3 rounded-lg bg-muted/30 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="h-6 w-6 flex items-center justify-center p-0">
                      {index + 1}
                    </Badge>
                    <p className="font-medium">{customerName}</p>
                  </div>
                  <p className="font-bold text-primary">${amount.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
