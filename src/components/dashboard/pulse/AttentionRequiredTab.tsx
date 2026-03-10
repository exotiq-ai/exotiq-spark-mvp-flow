import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useFleet } from "@/contexts/FleetContext";
import { useTeam } from "@/contexts/TeamContext";
import { useFleetTasks } from "@/hooks/useFleetTasks";
import { useWorkOrders } from "@/hooks/useWorkOrders";
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
  User,
  ClipboardList
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

export const AttentionRequiredTab = () => {
  const { bookings, vehicles, payments, maintenance, customers } = useLocationFilteredFleet();
  const { refreshMaintenance } = useFleet();
  const { currentTeam } = useTeam();
  const { tasks } = useFleetTasks();
  const { overdueOrders, blockedOrders } = useWorkOrders();

  useRealtimeTable('maintenance_schedules', {
    teamId: currentTeam?.id,
    onUpdate: refreshMaintenance,
  });

  const navigate = useNavigate();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Late returns with booking details
  const lateReturns = bookings.filter(b => 
    (b.status === 'active' || b.status === 'confirmed') && 
    isPast(new Date(b.end_date)) &&
    new Date(b.start_date) <= new Date()
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

  // Overdue tasks
  const overdueTasks = tasks.filter(t => {
    if (t.status === 'completed') return false;
    if (!t.due_at) return false;
    return isPast(new Date(t.due_at));
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
      id: 'tasks', 
      label: 'Overdue Tasks', 
      icon: ClipboardList, 
      count: overdueTasks.length, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      action: () => navigate('/dashboard?module=motoriq&tab=tasks'),
      items: overdueTasks.slice(0, 5).map(t => {
        const vehicle = vehicles.find(v => v.id === t.vehicle_id);
        return {
          id: t.id,
          label: `${t.task_type}: ${vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown'}`,
          sublabel: t.due_at ? `Due ${format(new Date(t.due_at), 'MMM d')}` : 'No due date',
          onClick: () => navigate(`/dashboard?module=motoriq&tab=tasks&taskId=${t.id}`)
        };
      })
    },
    { 
      id: 'overdue_wo', 
      label: 'Overdue Work Orders', 
      icon: Wrench, 
      count: overdueOrders.length, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      action: () => navigate('/dashboard?module=fleet&tab=maintenance'),
      items: overdueOrders.slice(0, 5).map(wo => {
        const vehicle = vehicles.find(v => v.id === wo.vehicle_id);
        return {
          id: wo.id,
          label: wo.title,
          sublabel: `${vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown'} • Due ${wo.due_at ? format(new Date(wo.due_at), 'MMM d') : 'N/A'}`,
          onClick: () => navigate(`/dashboard?module=fleet&tab=maintenance&workOrderId=${wo.id}`)
        };
      })
    },
    { 
      id: 'blocked_wo', 
      label: 'Blocked Work Orders', 
      icon: AlertTriangle, 
      count: blockedOrders.length, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      action: () => navigate('/dashboard?module=fleet&tab=maintenance'),
      items: blockedOrders.slice(0, 5).map(wo => {
        const vehicle = vehicles.find(v => v.id === wo.vehicle_id);
        return {
          id: wo.id,
          label: wo.title,
          sublabel: `${vehicle ? `${vehicle.make} ${vehicle.model}` : 'Unknown'} • ${wo.status === 'blocked_parts' ? 'Waiting on parts' : 'Waiting on vendor'}`,
          onClick: () => navigate(`/dashboard?module=fleet&tab=maintenance&workOrderId=${wo.id}`)
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
      <Card className="p-8 text-center">
        <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">All Clear</h3>
        <p className="text-sm text-muted-foreground">No items require your attention right now.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <Card className="p-4 bg-card/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <h3 className="font-semibold">{totalAlerts} Items Need Attention</h3>
              <p className="text-sm text-muted-foreground">Review and resolve these issues</p>
            </div>
          </div>
          <Badge variant="destructive" className="text-lg px-3 py-1">
            {totalAlerts}
          </Badge>
        </div>
      </Card>

      {/* Category cards */}
      <div className="grid gap-3">
        {categories.map((category) => {
          const Icon = category.icon;
          const isExpanded = expandedCategory === category.id;
          
          return (
            <Card key={category.id} className="overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className={`w-full flex items-center justify-between gap-2 px-4 py-3 ${category.bgColor} hover:opacity-90 transition-opacity`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-5 w-5 ${category.color}`} />
                  <span className="font-medium">{category.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {category.count}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded items */}
              {isExpanded && category.items.length > 0 && (
                <div className="p-3 space-y-2 bg-background">
                  {category.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={item.onClick}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors text-left"
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
                      className="w-full"
                      onClick={category.action}
                    >
                      View all {category.count} {category.label.toLowerCase()}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
};
