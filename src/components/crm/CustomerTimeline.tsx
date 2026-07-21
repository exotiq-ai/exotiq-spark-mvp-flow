import { useMemo } from "react";
import { Database } from "@/integrations/supabase/types";
import { Car, FileText, Clock, Shield, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

type Booking = Database['public']['Tables']['bookings']['Row'];
type CustomerNote = Database['public']['Tables']['customer_notes']['Row'];

export interface IdentityEvent {
  id: string;
  status: string;
  created_at: string;
  verified_at?: string | null;
  verified_name?: string | null;
  document_expiry?: string | null;
  last_error_reason?: string | null;
  attempt_count?: number | null;
}

interface TimelineEvent {
  id: string;
  date: string;
  type: 'booking' | 'note' | 'payment' | 'status' | 'identity';
  title: string;
  description?: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}

interface CustomerTimelineProps {
  bookings: Booking[];
  notes: CustomerNote[];
  identityEvents?: IdentityEvent[];
}

export const CustomerTimeline = ({ bookings, notes, identityEvents = [] }: CustomerTimelineProps) => {
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

    identityEvents.forEach(ev => {
      const attempts = ev.attempt_count ?? 0;
      switch (ev.status) {
        case 'verified': {
          const parts: string[] = [];
          if (ev.verified_name) parts.push(`Verified: ${ev.verified_name}`);
          if (ev.document_expiry) parts.push(`Doc expires ${new Date(ev.document_expiry).toLocaleDateString()}`);
          items.push({
            id: `idv-${ev.id}-verified`,
            date: ev.verified_at || ev.created_at,
            type: 'identity',
            title: 'ID verified',
            description: parts.join(' · ') || 'Stripe Identity check passed',
            icon: <CheckCircle2 className="w-3.5 h-3.5 text-success" />,
            badge: <Badge className="bg-success/10 text-success border-success/30">Verified</Badge>,
          });
          break;
        }
        case 'requires_input':
          items.push({
            id: `idv-${ev.id}-retry`,
            date: ev.created_at,
            type: 'identity',
            title: 'ID verification retry needed',
            description: ev.last_error_reason || `Attempt ${attempts} failed — awaiting retry`,
            icon: <AlertTriangle className="w-3.5 h-3.5 text-warning" />,
            badge: <Badge className="bg-warning/10 text-warning border-warning/30">Retry</Badge>,
          });
          break;
        case 'manual_review':
          items.push({
            id: `idv-${ev.id}-review`,
            date: ev.created_at,
            type: 'identity',
            title: 'ID flagged for manual review',
            description: ev.last_error_reason || `Reached self-serve attempt limit (${attempts})`,
            icon: <AlertTriangle className="w-3.5 h-3.5 text-destructive" />,
            badge: <Badge className="bg-destructive/10 text-destructive border-destructive/30">Manual review</Badge>,
          });
          break;
        case 'created':
        case 'processing':
          items.push({
            id: `idv-${ev.id}-sent`,
            date: ev.created_at,
            type: 'identity',
            title: ev.status === 'processing' ? 'ID check processing' : 'ID verification link sent',
            description: 'Powered by Stripe Identity',
            icon: <Shield className="w-3.5 h-3.5 text-primary" />,
            badge: <Badge className="bg-primary/10 text-primary border-primary/30">{ev.status === 'processing' ? 'Processing' : 'Link sent'}</Badge>,
          });
          break;
        case 'canceled':
        case 'redacted':
          items.push({
            id: `idv-${ev.id}-${ev.status}`,
            date: ev.created_at,
            type: 'identity',
            title: ev.status === 'redacted' ? 'ID data redacted' : 'ID verification canceled',
            icon: <XCircle className="w-3.5 h-3.5 text-muted-foreground" />,
            badge: <Badge variant="outline" className="bg-muted text-muted-foreground border-border">{ev.status}</Badge>,
          });
          break;
        default:
          break;
      }
    });

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [bookings, notes, identityEvents]);

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
