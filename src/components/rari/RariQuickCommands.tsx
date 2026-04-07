import { useRef, useCallback, useMemo } from 'react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useUserRole } from '@/hooks/useUserRole';
import {
  LayoutDashboard,
  DollarSign,
  AlertTriangle,
  GitCompare,
  CreditCard,
  TrendingUp,
  LucideIcon,
} from 'lucide-react';

interface QuickCommand {
  id: string;
  label: string;
  shortLabel: string;
  command: string;
  icon: LucideIcon;
  color: 'gulf-blue' | 'emerald' | 'amber' | 'purple' | 'rose' | 'blue';
}

const QUICK_COMMANDS: QuickCommand[] = [
  { 
    id: 'summary',
    label: "Daily Summary", 
    shortLabel: "Summary",
    command: "Give me today's summary",
    icon: LayoutDashboard,
    color: "gulf-blue"
  },
  { 
    id: 'revenue',
    label: "Revenue Report", 
    shortLabel: "Revenue",
    command: "What's my revenue this week?",
    icon: DollarSign,
    color: "emerald"
  },
  { 
    id: 'idle',
    label: "Idle Vehicles", 
    shortLabel: "Idle",
    command: "Which vehicles are sitting idle?",
    icon: AlertTriangle,
    color: "amber"
  },
  { 
    id: 'compare',
    label: "Compare Locations", 
    shortLabel: "Compare",
    command: "Compare Miami and Scottsdale performance",
    icon: GitCompare,
    color: "purple"
  },
  { 
    id: 'payments',
    label: "Outstanding Payments", 
    shortLabel: "Payments",
    command: "Who owes me money?",
    icon: CreditCard,
    color: "rose"
  },
  { 
    id: 'forecast',
    label: "Demand Forecast", 
    shortLabel: "Forecast",
    command: "What's the demand forecast for next week?",
    icon: TrendingUp,
    color: "blue"
  },
];

const colorClasses: Record<QuickCommand['color'], string> = {
  'gulf-blue': 'bg-gulf-blue/10 text-gulf-blue border-gulf-blue/20 hover:bg-gulf-blue/20 hover:border-gulf-blue/40',
  'emerald': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20 hover:border-emerald-500/40',
  'amber': 'bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40',
  'purple': 'bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40',
  'rose': 'bg-rose-500/10 text-rose-500 border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/40',
  'blue': 'bg-blue-500/10 text-blue-500 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40',
};

interface RariQuickCommandsProps {
  isConnected: boolean;
  activeCommandId: string | null;
  onCommand: (command: string) => void;
  className?: string;
}

export const RariQuickCommands = ({
  isConnected,
  activeCommandId,
  onCommand,
  className,
}: RariQuickCommandsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { role: userRole } = useUserRole();

  // Filter out revenue/pricing commands for operators and viewers
  const RESTRICTED_COMMANDS = ['revenue', 'payments', 'forecast'];
  const isRestrictedRole = userRole === 'operator' || userRole === 'viewer';
  const visibleCommands = useMemo(() => {
    if (!isRestrictedRole) return QUICK_COMMANDS;
    return QUICK_COMMANDS.filter(cmd => !RESTRICTED_COMMANDS.includes(cmd.id));
  }, [isRestrictedRole]);

  const handleClick = useCallback((cmd: QuickCommand) => {
    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }

    toast.info(`Asking Rari: ${cmd.command}`, {
      duration: 2000,
      icon: '🎤',
    });

    onCommand(cmd.command);
  }, [onCommand]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number, cmd: QuickCommand) => {
    const buttons = scrollRef.current?.querySelectorAll('button');
    if (!buttons) return;

    if (e.key === 'ArrowRight' && index < buttons.length - 1) {
      e.preventDefault();
      (buttons[index + 1] as HTMLButtonElement).focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      (buttons[index - 1] as HTMLButtonElement).focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(cmd);
    }
  }, [handleClick]);

  return (
    <div className={cn("w-full", className)}>
      <ScrollArea className="w-full whitespace-nowrap">
        <div 
          ref={scrollRef}
          className="flex gap-2 md:gap-3 pb-2"
          role="group"
          aria-label="Quick commands"
        >
          {QUICK_COMMANDS.map((cmd, index) => {
            const Icon = cmd.icon;
            const isActive = activeCommandId === cmd.id;
            
            return (
              <motion.div
                key={cmd.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClick(cmd)}
                  onKeyDown={(e) => handleKeyDown(e, index, cmd)}
                  aria-label={`${cmd.label}: ${cmd.command}`}
                  className={cn(
                    "rounded-full border px-3 py-2 md:px-4 text-xs md:text-sm font-medium",
                    "transition-all duration-200 ease-out",
                    "hover:scale-105 hover:shadow-md",
                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "active:scale-95",
                    colorClasses[cmd.color],
                    isActive && "ring-2 ring-offset-2 ring-offset-background animate-pulse"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 mr-1.5 md:mr-2 flex-shrink-0" />
                  <span className="md:hidden">{cmd.shortLabel}</span>
                  <span className="hidden md:inline">{cmd.label}</span>
                </Button>
              </motion.div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" className="opacity-0" />
      </ScrollArea>
    </div>
  );
};
