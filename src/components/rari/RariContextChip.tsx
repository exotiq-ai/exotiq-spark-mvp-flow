import { X, Car, User, Calendar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

interface RariContextChipProps {
  type: 'booking' | 'customer' | 'vehicle' | null;
  label: string | null;
  onClear: () => void;
}

const typeConfig = {
  booking: {
    icon: Calendar,
    color: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    label: 'Booking',
  },
  customer: {
    icon: User,
    color: 'bg-green-500/10 text-green-600 border-green-500/20',
    label: 'Customer',
  },
  vehicle: {
    icon: Car,
    color: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    label: 'Vehicle',
  },
};

export function RariContextChip({ type, label, onClear }: RariContextChipProps) {
  if (!type || !label) return null;

  const config = typeConfig[type];
  const Icon = config.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <Badge
          variant="outline"
          className={`${config.color} pl-2 pr-1 py-1 flex items-center gap-1.5 text-xs font-medium`}
        >
          <Icon className="h-3 w-3" />
          <span className="max-w-[150px] truncate">
            {config.label}: {label}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 rounded-full hover:bg-current/10 ml-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            <X className="h-2.5 w-2.5" />
          </Button>
        </Badge>
      </motion.div>
    </AnimatePresence>
  );
}
