import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Users, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecentEntity } from '@/types/rari';

interface RecentEntitiesPillsProps {
  entities: RecentEntity[];
  className?: string;
}

const ENTITY_ICONS = {
  booking: Calendar,
  customer: Users,
  vehicle: Car,
} as const;

const ENTITY_COLORS = {
  booking: 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400',
  customer: 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 dark:text-purple-400',
  vehicle: 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400',
} as const;

export const RecentEntitiesPills = ({ entities, className }: RecentEntitiesPillsProps) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  if (!entities || entities.length === 0) return null;

  const handleClick = (entity: RecentEntity) => {
    // Update URL params to set context - this keeps sidebar open
    const newParams = new URLSearchParams(searchParams);
    
    // Clear other entity params
    newParams.delete('bookingId');
    newParams.delete('customerId');
    newParams.delete('vehicleId');
    
    // Set the clicked entity param
    newParams.set(`${entity.type}Id`, entity.id);
    
    setSearchParams(newParams);
  };

  // Show max 3 recent entities
  const displayEntities = entities.slice(0, 3);

  return (
    <div className={cn("flex items-center gap-2 overflow-x-auto scrollbar-hide", className)}>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide shrink-0">
        Recent
      </span>
      {displayEntities.map((entity) => {
        const Icon = ENTITY_ICONS[entity.type];
        const colorClass = ENTITY_COLORS[entity.type];
        
        return (
          <button
            key={`${entity.type}-${entity.id}`}
            onClick={() => handleClick(entity)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors shrink-0",
              colorClass
            )}
            title={`View ${entity.name}`}
          >
            <Icon className="h-3 w-3" />
            <span className="max-w-[80px] truncate">{entity.name}</span>
          </button>
        );
      })}
    </div>
  );
};
