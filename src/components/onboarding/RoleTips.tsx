import React from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Car, 
  BarChart3, 
  Users, 
  Shield, 
  Settings,
  Sparkles
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Role types that match the database enum
type AppRole = 'admin' | 'manager' | 'operator' | 'viewer';

interface RoleTip {
  icon: React.ReactNode;
  title: string;
  description: string;
}

interface RoleInfo {
  title: string;
  subtitle: string;
  color: string;
  tips: RoleTip[];
}

const ROLE_TIPS: Record<AppRole, RoleInfo> = {
  operator: {
    title: "You're an Operator",
    subtitle: "Focus on day-to-day booking management",
    color: 'text-blue-500 bg-blue-500/10',
    tips: [
      {
        icon: <Calendar className="h-5 w-5" />,
        title: 'Manage Bookings',
        description: 'Create and manage bookings in the Book module. Process vehicle pickups and returns.',
      },
      {
        icon: <Car className="h-5 w-5" />,
        title: 'Vehicle Status',
        description: 'Update vehicle availability and log inspections when vehicles are picked up or returned.',
      },
      {
        icon: <Users className="h-5 w-5" />,
        title: 'Customer Communication',
        description: 'Access customer profiles and communicate via the integrated messaging features.',
      },
    ],
  },
  manager: {
    title: "You're a Manager",
    subtitle: "Monitor performance and approve operations",
    color: 'text-purple-500 bg-purple-500/10',
    tips: [
      {
        icon: <BarChart3 className="h-5 w-5" />,
        title: 'Monitor Performance',
        description: 'Track fleet utilization, revenue, and key metrics in the Pulse dashboard.',
      },
      {
        icon: <Calendar className="h-5 w-5" />,
        title: 'Approve Bookings',
        description: 'Review and approve pending bookings. Manage pricing and availability.',
      },
      {
        icon: <Users className="h-5 w-5" />,
        title: 'Team Oversight',
        description: 'View team activity and support operators with complex situations.',
      },
    ],
  },
  admin: {
    title: "You're an Admin",
    subtitle: "Full access to configure and manage the team",
    color: 'text-amber-500 bg-amber-500/10',
    tips: [
      {
        icon: <Shield className="h-5 w-5" />,
        title: 'Team Management',
        description: 'Add team members, manage roles, and configure permissions.',
      },
      {
        icon: <Settings className="h-5 w-5" />,
        title: 'System Settings',
        description: 'Configure locations, pricing rules, and integrations.',
      },
      {
        icon: <BarChart3 className="h-5 w-5" />,
        title: 'Full Analytics',
        description: 'Access comprehensive reports and export data for accounting.',
      },
    ],
  },
  viewer: {
    title: "You're a Viewer",
    subtitle: "Read-only access to monitor operations",
    color: 'text-gray-500 bg-gray-500/10',
    tips: [
      {
        icon: <BarChart3 className="h-5 w-5" />,
        title: 'View Reports',
        description: 'Access dashboards and reports to monitor fleet performance.',
      },
      {
        icon: <Calendar className="h-5 w-5" />,
        title: 'Check Bookings',
        description: 'View booking schedules and availability calendars.',
      },
      {
        icon: <Car className="h-5 w-5" />,
        title: 'Fleet Overview',
        description: 'See vehicle statuses and fleet composition.',
      },
    ],
  },
};

interface RoleTipsProps {
  role: AppRole;
  className?: string;
}

export function RoleTips({ role, className }: RoleTipsProps) {
  const roleInfo = ROLE_TIPS[role] || ROLE_TIPS.operator;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Role Header */}
      <div className="text-center">
        <Badge className={cn('mb-3 px-3 py-1', roleInfo.color)}>
          <Sparkles className="h-3.5 w-3.5 mr-1" />
          {roleInfo.title}
        </Badge>
        <p className="text-muted-foreground">
          {roleInfo.subtitle}
        </p>
      </div>

      {/* Tips Grid */}
      <div className="grid gap-4">
        {roleInfo.tips.map((tip, index) => (
          <motion.div
            key={tip.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className={cn('p-2 rounded-lg flex-shrink-0', roleInfo.color)}>
                  {tip.icon}
                </div>
                <div>
                  <h4 className="font-medium mb-1">{tip.title}</h4>
                  <p className="text-sm text-muted-foreground">
                    {tip.description}
                  </p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick Start Note */}
      <div className="text-center text-sm text-muted-foreground pt-4 border-t">
        <p>
          Need help? Look for the <Sparkles className="h-3.5 w-3.5 inline mx-1" /> 
          icon for AI-powered assistance throughout the app.
        </p>
      </div>
    </div>
  );
}

export default RoleTips;
