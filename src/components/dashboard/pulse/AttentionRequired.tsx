import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "./CollapsibleSection";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useFleet } from "@/contexts/FleetContext";
import { useTeam } from "@/contexts/TeamContext";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  Clock, 
  CreditCard,
  FileWarning,
  Wrench,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  User
} from "lucide-react";
import { isPast, isToday, isTomorrow, addDays, isWithinInterval, format } from "date-fns";

interface AlertItem {
  id: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
}

interface AlertCategory {
  id: string;
  label: string;
  icon: typeof AlertTriangle;
  count: number;
  color: string;
  bgColor: string;
  action: () => void;
  items: AlertItem[];
}

export const AttentionRequired = () => {
  const { bookings, vehicles, payments, maintenance, customers } = useLocationFilteredFleet();
  const { refreshMaintenance } = useFleet();
  const { currentTeam } = useTeam();
  const navigate = useNavigate();

  useRealtimeTable('maintenance_schedules', {
    teamId: currentTeam?.id,
    onUpdate: refreshMaintenance,
  });

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Late returns with booking details
  const lateReturns = bookings.filter(b => 
    (b.status === 'active' || b.status === 'confirmed') && 
    isPast(new Date(b.end_date)) &&
    new Date(b.start_date) <= new Date() // Has started
  );

  // Pending pickups with booking details
  const pendingPickups = bookings.filter(b => {
    const startDate = new Date(b.start_date);
    return b.status === 'confirmed' && (isToday(startDate) || isPast(startDate));
  });

  // Overdue payments
  const overduePayments = payments.filter(p => 
    p.payment_status === 'pending' || p.payment_status === 'overdue'
  );

  // Expiring documents
  const expiringDocs = customers.filter(c => {
    const licenseExpiry = c.license_expiry ? new Date(c.license_expiry) : null;
    const insuranceExpiry = c.insurance_expiry ? new Date(c.insurance_expiry) : null;
    const soon = addDays(new Date(), 7);
    return (licenseExpiry && isWithinInterval(licenseExpiry, { start: new Date(), end: soon })) ||
           (insuranceExpiry && isWithinInterval(insuranceExpiry, { start: new Date(), end: soon }));
  });

  // Maintenance due
  const maintenanceDue = maintenance.filter(m => {
    const scheduledDate = new Date(m.scheduled_date);
    return m.status !== 'completed' && (isToday(scheduledDate) || isTomorrow(scheduledDate) || isPast(scheduledDate));
  });

  const categories: AlertCategory[] = [
    { 
      id: 'late', 
      label: 'Late Returns', 
      icon: Clock, 
      count: lateReturns.length, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      action: () => navigate('/dashboard?module=book&filter=overdue'),
      items: lateReturns.slice(0, 5).map(b => {
        const vehicle = vehicles.find(v => v.id === b.vehicle_id);
        return {
          id: b.id,
          label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle',
          sublabel: `${b.customer_name} • Due ${format(new Date(b.end_date), 'MMM d')}`,
          onClick: () => navigate(`/dashboard?module=book&bookingId=${b.id}`)
        };
      })
    },
    { 
      id: 'pickups', 
      label: 'Pending Pickups', 
      icon: AlertTriangle, 
      count: pendingPickups.length, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      action: () => navigate('/dashboard?module=book&filter=pending-pickup'),
      items: pendingPickups.slice(0, 5).map(b => {
        const vehicle = vehicles.find(v => v.id === b.vehicle_id);
        return {
          id: b.id,
          label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle',
          sublabel: `${b.customer_name} • ${format(new Date(b.start_date), 'h:mm a')}`,
          onClick: () => navigate(`/dashboard?module=book&bookingId=${b.id}`)
        };
      })
    },
    { 
      id: 'payments', 
      label: 'Overdue Payments', 
      icon: CreditCard, 
      count: overduePayments.length, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      action: () => navigate('/dashboard?module=vault&tab=payments&filter=overdue'),
      items: overduePayments.slice(0, 5).map(p => {
        const booking = bookings.find(b => b.id === p.booking_id);
        return {
          id: p.id,
          label: `$${p.amount?.toLocaleString() || 0}`,
          sublabel: booking?.customer_name || 'Unknown Customer',
          onClick: () => navigate(`/dashboard?module=vault&tab=payments&paymentId=${p.id}`)
        };
      })
    },
    { 
      id: 'docs', 
      label: 'Expiring Docs', 
      icon: FileWarning, 
      count: expiringDocs.length, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      action: () => navigate('/dashboard?module=book&tab=customers&filter=expiring'),
      items: expiringDocs.slice(0, 5).map(c => ({
        id: c.id,
        label: c.full_name,
        sublabel: c.license_expiry ? `License expires ${format(new Date(c.license_expiry), 'MMM d')}` : 'Insurance expiring',
        onClick: () => navigate(`/dashboard?module=book&tab=customers&customerId=${c.id}`)
      }))
    },
    { 
      id: 'maintenance', 
      label: 'Maintenance Due', 
      icon: Wrench, 
      count: maintenanceDue.length, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      action: () => navigate('/dashboard?module=motoriq&filter=due'),
      items: maintenanceDue.slice(0, 5).map(m => {
        const vehicle = vehicles.find(v => v.id === m.vehicle_id);
        return {
          id: m.id,
          label: vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown Vehicle',
          sublabel: `${m.maintenance_type} • ${format(new Date(m.scheduled_date), 'MMM d')}`,
          onClick: () => navigate(`/dashboard?module=motoriq&maintenanceId=${m.id}`)
        };
      })
    },
  ].filter(cat => cat.count > 0);

  const totalAlerts = categories.reduce((sum, cat) => sum + cat.count, 0);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  if (totalAlerts === 0) {
    return (
      <CollapsibleSection
        id="attention"
        title="Attention Required"
        icon={<CheckCircle2 className="h-4 w-4 text-success" />}
        badge={0}
        badgeVariant="secondary"
      >
        <div className="flex items-center gap-3 py-2">
          <CheckCircle2 className="h-5 w-5 text-success" />
          <span className="text-sm text-muted-foreground">All clear — no items require attention</span>
        </div>
      </CollapsibleSection>
    );
  }

  return (
    <CollapsibleSection
      id="attention"
      title="Attention Required"
      icon={<AlertTriangle className="h-4 w-4 text-warning" />}
      badge={totalAlerts}
      badgeVariant="destructive"
    >
      <div className="space-y-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedCategory === category.id;
          
          return (
            <div key={category.id} className="space-y-1">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${category.bgColor} hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${category.color}`} />
                  <span className="text-sm font-medium">{category.count}</span>
                  <span className="text-xs text-muted-foreground">{category.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded items */}
              {isExpanded && category.items.length > 0 && (
                <div className="ml-4 space-y-1">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={item.onClick}
                      className="w-full flex items-center justify-between p-2 rounded-md bg-card/50 hover:bg-card transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        {item.sublabel && (
                          <p className="text-xs text-muted-foreground truncate">{item.sublabel}</p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                    </button>
                  ))}
                  {category.count > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full text-xs"
                      onClick={category.action}
                    >
                      View all {category.count} {category.label.toLowerCase()}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
};
