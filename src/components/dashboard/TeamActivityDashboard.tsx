import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamActivity, activityConfig } from '@/hooks/useTeamActivity';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Calendar,
  DollarSign,
  Users,
  Shield,
  LogIn,
  LogOut,
  Car,
  UserPlus,
  Settings,
  MessageSquare,
  MessageCircle,
  CalendarPlus,
  CalendarX,
  RefreshCw,
  User,
  Clock,
  TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LogIn,
  LogOut,
  CalendarPlus,
  Calendar,
  CalendarX,
  DollarSign,
  Car,
  UserPlus,
  User,
  Shield,
  Settings,
  MessageSquare,
  MessageCircle,
};

interface ActivityItemProps {
  activity: {
    id: string;
    user_id: string;
    activity_type: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata: Record<string, unknown>;
    created_at: string;
    user_name?: string;
    user_email?: string;
    user_avatar?: string;
  };
  index: number;
}

const ActivityItem = ({ activity, index }: ActivityItemProps) => {
  const config = activityConfig[activity.activity_type] || {
    label: activity.activity_type.replace(/_/g, ' '),
    color: 'text-muted-foreground',
    icon: 'Activity',
  };
  
  const IconComponent = iconMap[config.icon] || Activity;
  const initials = activity.user_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  
  // Build description from metadata
  let description = '';
  if (activity.metadata) {
    if (activity.metadata.customer_name) {
      description = `for ${activity.metadata.customer_name}`;
    }
    if (activity.metadata.vehicle_name) {
      description = activity.metadata.vehicle_name as string;
    }
    if (activity.metadata.amount) {
      description = `$${Number(activity.metadata.amount).toLocaleString()}`;
    }
    if (activity.metadata.new_role) {
      description = `→ ${activity.metadata.new_role}`;
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-3 py-3 px-2 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <Avatar className="h-8 w-8 flex-shrink-0">
        <AvatarImage src={activity.user_avatar || undefined} />
        <AvatarFallback className="text-xs bg-primary/10">
          {initials}
        </AvatarFallback>
      </Avatar>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{activity.user_name}</span>
          <Badge variant="outline" className={cn("text-xs px-1.5 py-0", config.color)}>
            <IconComponent className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          {description && (
            <span className="text-sm text-muted-foreground">{description}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

const ActivitySkeleton = () => (
  <div className="flex items-start gap-3 py-3 px-2">
    <Skeleton className="h-8 w-8 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-3 w-24" />
    </div>
  </div>
);

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const StatCard = ({ label, value, icon: Icon, color }: StatCardProps) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className="p-4 rounded-xl bg-muted/50 border border-border/50"
  >
    <div className="flex items-center gap-3">
      <div className={cn("p-2 rounded-lg", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  </motion.div>
);

export const TeamActivityDashboard = () => {
  const [activeTab, setActiveTab] = useState('all');
  const { activities, loading, refresh } = useTeamActivity({ limit: 100 });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Filter activities by type
  const filterActivities = (types?: string[]) => {
    if (!types) return activities;
    return activities.filter(a => types.includes(a.activity_type));
  };

  const tabConfig = {
    all: { types: undefined, label: 'All Activity' },
    logins: { types: ['login', 'logout'], label: 'Logins' },
    bookings: { types: ['booking_created', 'booking_updated', 'booking_cancelled'], label: 'Bookings' },
    payments: { types: ['payment_recorded'], label: 'Payments' },
    team: { types: ['role_changed', 'settings_updated'], label: 'Team' },
  };

  // Calculate stats
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayActivities = activities.filter(a => new Date(a.created_at) >= today);
  const todayLogins = todayActivities.filter(a => a.activity_type === 'login').length;
  const todayBookings = todayActivities.filter(a => a.activity_type.includes('booking')).length;
  const todayPayments = todayActivities.filter(a => a.activity_type === 'payment_recorded').length;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Team Activity
            </CardTitle>
            <CardDescription>Real-time feed of all team actions</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Logins Today"
            value={todayLogins}
            icon={LogIn}
            color="bg-success/10 text-success"
          />
          <StatCard
            label="Bookings Today"
            value={todayBookings}
            icon={Calendar}
            color="bg-primary/10 text-primary"
          />
          <StatCard
            label="Payments Today"
            value={todayPayments}
            icon={DollarSign}
            color="bg-warning/10 text-warning"
          />
          <StatCard
            label="Active Users"
            value={new Set(todayActivities.map(a => a.user_id)).size}
            icon={Users}
            color="bg-accent/10 text-accent"
          />
        </div>

        {/* Activity Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="all" className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              All
            </TabsTrigger>
            <TabsTrigger value="logins" className="flex items-center gap-1.5">
              <LogIn className="h-3.5 w-3.5" />
              Logins
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Bookings
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Team
            </TabsTrigger>
          </TabsList>

          {Object.entries(tabConfig).map(([key, config]) => (
            <TabsContent key={key} value={key} className="mt-4">
              <ScrollArea className="h-[400px]">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <ActivitySkeleton key={i} />
                    ))}
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filterActivities(config.types).length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center h-[200px] text-muted-foreground"
                      >
                        <Activity className="h-10 w-10 mb-3 opacity-50" />
                        <p>No {config.label.toLowerCase()} to show</p>
                        <p className="text-sm">Activity will appear here in real-time</p>
                      </motion.div>
                    ) : (
                      <div className="divide-y divide-border/30">
                        {filterActivities(config.types).map((activity, index) => (
                          <ActivityItem key={activity.id} activity={activity} index={index} />
                        ))}
                      </div>
                    )}
                  </AnimatePresence>
                )}
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
