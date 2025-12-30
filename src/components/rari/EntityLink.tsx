import { Phone, Mail, Calendar, User, Car } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModuleNavigation } from '@/hooks/useModuleNavigation';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { EntityPreview } from './EntityPreview';
import type { DetectedEntity } from '@/hooks/useEntityDetection';
import type { EnrichedEntity } from '@/hooks/useEntityEnrichment';

interface EntityLinkProps {
  entity: DetectedEntity | EnrichedEntity;
  isOwnMessage?: boolean;
}

export const EntityLink = ({ entity, isOwnMessage = false }: EntityLinkProps) => {
  const navigation = useModuleNavigation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    
    switch (entity.type) {
      case 'phone':
        window.location.href = `tel:${entity.value}`;
        break;
      case 'email':
        window.location.href = `mailto:${entity.value}`;
        break;
      case 'booking':
        navigation.goToBookingDetails(entity.value);
        break;
      case 'customer':
        navigation.goToCustomerProfile(entity.value);
        break;
      case 'vehicle':
        navigation.goToVehicleDetails(entity.value);
        break;
    }
  };

  const getIcon = () => {
    switch (entity.type) {
      case 'phone':
        return <Phone className="h-3 w-3" />;
      case 'email':
        return <Mail className="h-3 w-3" />;
      case 'booking':
        return <Calendar className="h-3 w-3" />;
      case 'customer':
        return <User className="h-3 w-3" />;
      case 'vehicle':
        return <Car className="h-3 w-3" />;
    }
  };

  const getColorClasses = () => {
    const baseClasses = "inline-flex items-center gap-1 transition-all duration-200 hover:scale-105 active:scale-95 rounded px-1 -mx-1";
    
    switch (entity.type) {
      case 'phone':
        return cn(
          baseClasses,
          isOwnMessage 
            ? "text-purple-200 hover:bg-purple-400/20 underline decoration-purple-300/50" 
            : "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 underline decoration-purple-600/50"
        );
      case 'email':
        return cn(
          baseClasses,
          isOwnMessage
            ? "text-pink-200 hover:bg-pink-400/20 underline decoration-pink-300/50"
            : "text-pink-600 dark:text-pink-400 hover:bg-pink-50 dark:hover:bg-pink-950/30 underline decoration-pink-600/50"
        );
      case 'customer':
        return cn(
          baseClasses,
          isOwnMessage
            ? "text-blue-200 hover:bg-blue-400/20 underline decoration-blue-300/50"
            : "text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 underline decoration-blue-600/50"
        );
      case 'booking':
        return cn(
          baseClasses,
          isOwnMessage
            ? "text-emerald-200 hover:bg-emerald-400/20 underline decoration-emerald-300/50"
            : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 underline decoration-emerald-600/50"
        );
      case 'vehicle':
        return cn(
          baseClasses,
          isOwnMessage
            ? "text-orange-200 hover:bg-orange-400/20 underline decoration-orange-300/50"
            : "text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30 underline decoration-orange-600/50"
        );
      default:
        return baseClasses;
    }
  };

  // Check if entity has enrichment data
  const enrichedEntity = entity as EnrichedEntity;
  const hasEnrichment = enrichedEntity.enrichedData && 
    (entity.type === 'customer' || entity.type === 'booking' || entity.type === 'vehicle');

  const linkContent = (
    <button
      onClick={handleClick}
      className={cn(
        getColorClasses(),
        "cursor-pointer font-medium decoration-dotted underline-offset-2"
      )}
      title={`Click to ${entity.type === 'phone' ? 'call' : entity.type === 'email' ? 'email' : 'view'} ${entity.displayText}`}
    >
      {getIcon()}
      <span>{entity.displayText}</span>
    </button>
  );

  // Wrap with hover card if we have enrichment data
  if (hasEnrichment) {
    return (
      <HoverCard openDelay={200}>
        <HoverCardTrigger asChild>
          {linkContent}
        </HoverCardTrigger>
        <HoverCardContent 
          side="top" 
          align="start"
          className="w-auto p-0"
        >
          <EntityPreview
            type={entity.type as 'customer' | 'booking' | 'vehicle'}
            data={
              entity.type === 'customer' 
                ? enrichedEntity.enrichedData?.customer
                : entity.type === 'booking'
                ? enrichedEntity.enrichedData?.booking
                : enrichedEntity.enrichedData?.vehicle
            }
            isLoading={enrichedEntity.isLoading}
            error={enrichedEntity.error}
          />
        </HoverCardContent>
      </HoverCard>
    );
  }

  return linkContent;
};
