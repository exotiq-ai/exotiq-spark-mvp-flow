import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "./CollapsibleSection";
import { useLocationFilteredFleet } from "@/hooks/useLocationFilteredFleet";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  Clock, 
  CreditCard,
  FileWarning,
  Wrench,
  Phone,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { isPast, isToday, isTomorrow, addDays, isWithinInterval } from "date-fns";

interface AlertCategory {
  id: string;
  label: string;
  icon: typeof AlertTriangle;
  count: number;
  color: string;
  bgColor: string;
  action: () => void;
}

export const AttentionRequired = () => {
  const { bookings, vehicles, payments, maintenance, customers } = useLocationFilteredFleet();
  const navigate = useNavigate();

  // Calculate alert counts
  const lateReturnsCount = bookings.filter(b => 
    b.status === 'active' && isPast(new Date(b.end_date))
  ).length;

  const pendingPickupsCount = bookings.filter(b => {
    const startDate = new Date(b.start_date);
    return b.status === 'confirmed' && (isToday(startDate) || isPast(startDate));
  }).length;

  const overduePaymentsCount = payments.filter(p => 
    p.payment_status === 'pending' || p.payment_status === 'overdue'
  ).length;

  const expiringDocsCount = customers.filter(c => {
    const licenseExpiry = c.license_expiry ? new Date(c.license_expiry) : null;
    const insuranceExpiry = c.insurance_expiry ? new Date(c.insurance_expiry) : null;
    const soon = addDays(new Date(), 7);
    return (licenseExpiry && isWithinInterval(licenseExpiry, { start: new Date(), end: soon })) ||
           (insuranceExpiry && isWithinInterval(insuranceExpiry, { start: new Date(), end: soon }));
  }).length;

  const maintenanceDueCount = maintenance.filter(m => {
    const scheduledDate = new Date(m.scheduled_date);
    return m.status !== 'completed' && (isToday(scheduledDate) || isTomorrow(scheduledDate) || isPast(scheduledDate));
  }).length;

  const categories: AlertCategory[] = [
    { 
      id: 'late', 
      label: 'Late Returns', 
      icon: Clock, 
      count: lateReturnsCount, 
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      action: () => navigate('/dashboard?module=book')
    },
    { 
      id: 'pickups', 
      label: 'Pending Pickups', 
      icon: AlertTriangle, 
      count: pendingPickupsCount, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      action: () => navigate('/dashboard?module=book')
    },
    { 
      id: 'payments', 
      label: 'Overdue Payments', 
      icon: CreditCard, 
      count: overduePaymentsCount, 
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      action: () => navigate('/dashboard?module=vault&tab=payments')
    },
    { 
      id: 'docs', 
      label: 'Expiring Docs', 
      icon: FileWarning, 
      count: expiringDocsCount, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      action: () => navigate('/dashboard?module=core')
    },
    { 
      id: 'maintenance', 
      label: 'Maintenance Due', 
      icon: Wrench, 
      count: maintenanceDueCount, 
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/50',
      action: () => navigate('/dashboard?module=motoriq')
    },
  ].filter(cat => cat.count > 0);

  const totalAlerts = categories.reduce((sum, cat) => sum + cat.count, 0);

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
      {/* Compact horizontal layout */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          
          return (
            <button
              key={category.id}
              onClick={category.action}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${category.bgColor} hover:opacity-80 transition-opacity`}
            >
              <Icon className={`h-4 w-4 ${category.color}`} />
              <span className="text-sm font-medium">{category.count}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{category.label}</span>
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </CollapsibleSection>
  );
};
