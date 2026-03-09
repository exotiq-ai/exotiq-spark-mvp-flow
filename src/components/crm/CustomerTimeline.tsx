import { useMemo } from "react";
import { Database } from "@/integrations/supabase/types";
import { Car, DollarSign, FileText, Star, AlertTriangle, Calendar, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type Booking = Database['public']['Tables']['bookings']['Row'];
type CustomerNote = Database['public']['Tables']['customer_notes']['Row'];

interface TimelineEvent {
  id: string;
  date: string;
  type: 'booking' | 'note' | 'payment' | 'status';
  title: string;
  description?: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

interface CustomerTimelineProps {
  bookings: Booking[];
  notes: CustomerNote[];
}

export const CustomerTimeline = ({ bookings, notes }: CustomerTimelineProps) => {
  const events = useMemo(() => {
    const items: TimelineEvent[] = [];

    bookings.forEach(b => {
      items.push({
        id: `booking-${b.id}`,
        date: b.created_at || b.start_date,
        type: 'booking',
        title: `Booking ${b.status === 'completed' ? 'completed' : b.status === 'cancelled' ? 'cancelled' : 'created'}`,
        description: `${b.vehicle_name || 'Vehicle'} · ${new Date(b.start_date).toLocaleDateString()} – ${new Date(b.end_date).toLocaleDateString()}`,
        icon: <Car className="w-3.5 h-3.5" />,
        badge: (
          <Badge className={
            b.status === 'completed' ? 'bg-success/10 text-success border-success/30' :
            b.status === 'cancelled' ? 'bg-destructive/10 text-destructive border-destructive/30' :
            'bg-primary/10 text-primary border-primary/30'
          }>
            {formatCurrency(b.total_value)}
          </Badge>
        ),
      });
    });

    notes.forEach(n => {
      items.push({
        id: `note-${n.id}`,
        date: n.created_at || new Date().toISOString(),
        type: 'note',
        title: 'Note added',
        description: n.note,
        icon: <FileText className="w-3.5 h-3.5" />,
      });
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bookings, notes]);

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors">
          <div className="flex flex-col items-center">
            <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
              {event.icon}
            </div>
            {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{event.title}</span>
              {event.badge}
            </div>
            {event.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{event.description}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};
