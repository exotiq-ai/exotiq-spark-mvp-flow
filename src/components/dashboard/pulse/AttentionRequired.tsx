import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  Clock, 
  CreditCard,
  FileWarning,
  Wrench,
  ChevronDown,
  ChevronRight,
  Phone,
  Mail,
  ArrowRight
} from "lucide-react";
import { isPast, isToday, isTomorrow, addDays, isWithinInterval } from "date-fns";

interface AlertItem {
  id: string;
  title: string;
  subtitle: string;
  severity: 'high' | 'medium' | 'low';
  action?: () => void;
  phone?: string;
  email?: string;
}

interface AlertCategory {
  id: string;
  label: string;
  icon: typeof AlertTriangle;
  items: AlertItem[];
  color: string;
}

export const AttentionRequired = () => {
  const { bookings, vehicles, payments, maintenance, customers } = useLocationFilteredFleet();
  const navigate = useNavigate();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Calculate alerts
  const lateReturns: AlertItem[] = bookings
    .filter(b => b.status === 'active' && isPast(new Date(b.end_date)))
    .map(b => {
      const vehicle = vehicles.find(v => v.id === b.vehicle_id);
      return {
        id: b.id,
        title: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle',
        subtitle: b.customer_name,
        severity: 'high' as const,
        phone: b.customer_phone || undefined,
        email: b.customer_email || undefined,
        action: () => navigate('/dashboard?module=book')
      };
    });

  const pendingPickups: AlertItem[] = bookings
    .filter(b => {
      const startDate = new Date(b.start_date);
      return b.status === 'confirmed' && (isToday(startDate) || (isPast(startDate) && !isToday(startDate)));
    })
    .map(b => {
      const vehicle = vehicles.find(v => v.id === b.vehicle_id);
      return {
        id: b.id,
        title: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle',
        subtitle: `${b.customer_name} - Pickup pending`,
        severity: isToday(new Date(b.start_date)) ? 'medium' as const : 'high' as const,
        phone: b.customer_phone || undefined,
        email: b.customer_email || undefined,
        action: () => navigate('/dashboard?module=book')
      };
    });

  const overduePayments: AlertItem[] = payments
    .filter(p => p.payment_status === 'pending' || p.payment_status === 'overdue')
    .slice(0, 5)
    .map(p => {
      const booking = bookings.find(b => b.id === p.booking_id);
      return {
        id: p.id,
        title: `$${p.amount.toLocaleString()}`,
        subtitle: booking?.customer_name || 'Unknown customer',
        severity: 'medium' as const,
        action: () => navigate('/dashboard?module=vault&tab=payments')
      };
    });

  const expiringDocs: AlertItem[] = customers
    .filter(c => {
      const licenseExpiry = c.license_expiry ? new Date(c.license_expiry) : null;
      const insuranceExpiry = c.insurance_expiry ? new Date(c.insurance_expiry) : null;
      const soon = addDays(new Date(), 7);
      return (licenseExpiry && isWithinInterval(licenseExpiry, { start: new Date(), end: soon })) ||
             (insuranceExpiry && isWithinInterval(insuranceExpiry, { start: new Date(), end: soon }));
    })
    .slice(0, 5)
    .map(c => ({
      id: c.id,
      title: c.full_name,
      subtitle: 'Document expiring soon',
      severity: 'low' as const,
      phone: c.phone || undefined,
      email: c.email,
      action: () => navigate('/dashboard?module=core')
    }));

  const maintenanceDue: AlertItem[] = maintenance
    .filter(m => {
      const scheduledDate = new Date(m.scheduled_date);
      return m.status !== 'completed' && (isToday(scheduledDate) || isTomorrow(scheduledDate) || isPast(scheduledDate));
    })
    .slice(0, 5)
    .map(m => {
      const vehicle = vehicles.find(v => v.id === m.vehicle_id);
      return {
        id: m.id,
        title: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Vehicle',
        subtitle: m.maintenance_type,
        severity: isPast(new Date(m.scheduled_date)) ? 'high' as const : 'medium' as const,
        action: () => navigate('/dashboard?module=motoriq')
      };
    });

  const categories: AlertCategory[] = [
    { id: 'late', label: 'Late Returns', icon: Clock, items: lateReturns, color: 'text-destructive' },
    { id: 'pickups', label: 'Pending Pickups', icon: AlertTriangle, items: pendingPickups, color: 'text-warning' },
    { id: 'payments', label: 'Overdue Payments', icon: CreditCard, items: overduePayments, color: 'text-warning' },
    { id: 'docs', label: 'Expiring Documents', icon: FileWarning, items: expiringDocs, color: 'text-muted-foreground' },
    { id: 'maintenance', label: 'Maintenance Due', icon: Wrench, items: maintenanceDue, color: 'text-muted-foreground' },
  ].filter(cat => cat.items.length > 0);

  const totalAlerts = categories.reduce((sum, cat) => sum + cat.items.length, 0);

  if (totalAlerts === 0) {
    return (
      <Card className="p-6 border-success/20 bg-success/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-success/20 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-success" />
          </div>
          <div>
            <h3 className="font-semibold text-success">All Clear</h3>
            <p className="text-sm text-muted-foreground">No items require immediate attention</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          <h3 className="text-lg font-semibold">Attention Required</h3>
          <Badge variant="destructive" className="ml-2">
            {totalAlerts}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedCategory === category.id;
          
          return (
            <Collapsible
              key={category.id}
              open={isExpanded}
              onOpenChange={() => setExpandedCategory(isExpanded ? null : category.id)}
            >
              <CollapsibleTrigger className="w-full">
                <div className={`flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors ${isExpanded ? 'bg-muted/30' : ''}`}>
                  <div className="flex items-center gap-3">
                    <Icon className={`h-4 w-4 ${category.color}`} />
                    <span className="font-medium">{category.label}</span>
                    <Badge variant="secondary" className="text-xs">
                      {category.items.length}
                    </Badge>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="pl-7 pr-3 pb-2 space-y-2">
                  {category.items.map((item) => (
                    <div 
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.title}</div>
                        <div className="text-sm text-muted-foreground truncate">{item.subtitle}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {item.phone && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `tel:${item.phone}`;
                            }}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                        )}
                        {item.email && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `mailto:${item.email}`;
                            }}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        {item.action && (
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              item.action?.();
                            }}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </Card>
  );
};
