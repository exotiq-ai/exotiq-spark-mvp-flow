import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  CalendarPlus,
  Calendar,
  CalendarX,
  DollarSign,
  Car,
  UserPlus,
  User,
  MessageCircle,
  LogIn,
  Settings,
  Activity as ActivityIcon,
} from "lucide-react";
import { useTeamActivity } from "@/hooks/useTeamActivity";

/**
 * LiveActivityStrip — last 6 team events as a quiet vertical timeline.
 * Reuses useTeamActivity; no new queries. Fills the lower dashboard void
 * with a sense of "this place is alive".
 */

const iconMap: Record<string, typeof ActivityIcon> = {
  booking_created: CalendarPlus,
  booking_updated: Calendar,
  booking_cancelled: CalendarX,
  payment_recorded: DollarSign,
  vehicle_added: Car,
  vehicle_updated: Car,
  customer_added: UserPlus,
  customer_updated: User,
  comment_added: MessageCircle,
  message_sent: MessageCircle,
  login: LogIn,
  settings_updated: Settings,
};

const labelMap: Record<string, string> = {
  booking_created: "created a booking",
  booking_updated: "updated a booking",
  booking_cancelled: "cancelled a booking",
  payment_recorded: "recorded a payment",
  vehicle_added: "added a vehicle",
  vehicle_updated: "updated a vehicle",
  customer_added: "added a customer",
  customer_updated: "updated a customer",
  comment_added: "left a comment",
  message_sent: "sent a message",
  login: "signed in",
  settings_updated: "updated settings",
};

const toneMap: Record<string, string> = {
  booking_created: "text-primary",
  payment_recorded: "text-success",
  booking_cancelled: "text-destructive",
  vehicle_added: "text-primary",
  customer_added: "text-primary",
  comment_added: "text-foreground/70",
};

export const LiveActivityStrip = () => {
  const { activities, loading } = useTeamActivity({ limit: 6 });

  const items = useMemo(() => activities.slice(0, 6), [activities]);

  return (
    <section className="space-y-3" aria-label="Recent team activity">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recent activity
          {items.length > 0 && (
            <span className="ml-2 text-foreground/80 tracking-normal normal-case font-medium">
              {items.length}
            </span>
          )}
        </h2>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/40 px-4 sm:px-5 py-3">
        {loading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="h-7 w-7 rounded-full bg-muted/70" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-2/3 bg-muted/70 rounded" />
                  <div className="h-2 w-1/3 bg-muted/50 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <ActivityIcon className="h-4 w-4" />
            No team activity yet today.
          </div>
        ) : (
          <ol className="relative space-y-3 py-1">
            {/* hairline rail */}
            <span
              aria-hidden
              className="absolute left-[13px] top-2 bottom-2 w-px bg-border/60"
            />
            {items.map((a, i) => {
              const Icon = iconMap[a.activity_type] || ActivityIcon;
              const tone = toneMap[a.activity_type] || "text-muted-foreground";
              const label = labelMap[a.activity_type] || a.activity_type.replace(/_/g, " ");
              const when = a.created_at
                ? formatDistanceToNow(new Date(a.created_at), { addSuffix: true })
                : "";
              return (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  className="relative flex items-center gap-3 pl-0"
                >
                  <span
                    className={cn(
                      "relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
                      "bg-background border border-border/60",
                      tone,
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0 flex items-baseline gap-2">
                    <p className="text-sm text-foreground truncate">
                      <span className="font-medium">{a.user_name || "Teammate"}</span>{" "}
                      <span className="text-muted-foreground">{label}</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground/70 tabular-nums whitespace-nowrap ml-auto">
                      {when}
                    </span>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
};

export default LiveActivityStrip;
