import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { Star, AlertTriangle } from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/utils";

type Customer = Database['public']['Tables']['customers']['Row'];

interface CustomerListRowProps {
  customer: Customer;
  lastBooking?: string;
  onClick: () => void;
}

export const CustomerListRow = ({
  customer,
  lastBooking,
  onClick,
}: CustomerListRowProps) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'vip':
        return (
          <Badge className="bg-primary/10 text-primary border-primary/30 shrink-0">
            <Star className="w-3 h-3 mr-1" />
            VIP
          </Badge>
        );
      case 'blacklisted':
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/30 shrink-0">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Blacklisted
          </Badge>
        );
      default:
        return (
          <Badge className="bg-success/10 text-success border-success/30 shrink-0">
            Active
          </Badge>
        );
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open ${customer.full_name} profile`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="group relative rounded-lg bg-muted/30 border border-primary/10 hover-scale cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {/* Desktop layout */}
      <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 items-center text-sm">
        <div className="col-span-4 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium truncate">{customer.full_name}</span>
            {getStatusBadge(customer.customer_status)}
          </div>
        </div>
        <div className="col-span-4 text-muted-foreground truncate">
          {customer.email}
        </div>
        <div className="col-span-2 font-medium text-success">
          {formatCurrency(customer.lifetime_value || 0)}
        </div>
        <div className="col-span-2 text-muted-foreground text-xs">
          {lastBooking
            ? formatDistanceToNow(new Date(lastBooking), { addSuffix: true })
            : 'Never'}
        </div>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden px-4 py-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium truncate">{customer.full_name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {customer.email}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {getStatusBadge(customer.customer_status)}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            <span className="text-xs">LTV</span>{' '}
            <span className="font-medium text-success">
              {formatCurrency(customer.lifetime_value || 0)}
            </span>
          </span>
          <span>
            <span className="text-xs">Last</span>{' '}
            <span className="font-medium">
              {lastBooking
                ? formatDistanceToNow(new Date(lastBooking), { addSuffix: true })
                : 'Never'}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};
