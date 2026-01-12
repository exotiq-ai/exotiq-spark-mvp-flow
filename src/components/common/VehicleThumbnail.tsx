import { useState } from 'react';
import { getVehicleImage } from '@/lib/vehicleImageMapping';
import { cn } from '@/lib/utils';
import { Car } from 'lucide-react';

type ThumbnailSize = 'icon' | 'pill' | 'avatar' | 'sm' | 'md' | 'lg' | 'full';

interface SizeConfig {
  width: string;
  height: string;
  iconSize: string;
  rounded: string;
}

interface VehicleThumbnailProps {
  vehicleName: string;
  size?: ThumbnailSize;
  className?: string;
  showFallback?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
  loading?: 'lazy' | 'eager';
}

const sizeConfig: Record<ThumbnailSize, SizeConfig> = {
  icon: { 
    width: 'w-8', 
    height: 'h-8', 
    iconSize: 'h-4 w-4',
    rounded: 'rounded-lg',
  },
  pill: { 
    width: 'w-12', 
    height: 'h-8', 
    iconSize: 'h-4 w-4',
    rounded: 'rounded-full',
  },
  avatar: { 
    width: 'w-11', 
    height: 'h-11', 
    iconSize: 'h-5 w-5',
    rounded: 'rounded-full',
  },
  sm: {
    width: 'w-16', 
    height: 'h-12', 
    iconSize: 'h-5 w-5',
    rounded: 'rounded-xl',
  },
  md: { 
    width: 'w-24', 
    height: 'h-16', 
    iconSize: 'h-6 w-6',
    rounded: 'rounded-xl',
  },
  lg: { 
    width: 'w-32', 
    height: 'h-24', 
    iconSize: 'h-8 w-8',
    rounded: 'rounded-2xl',
  },
  full: { 
    width: 'w-full', 
    height: 'aspect-[16/10]', 
    iconSize: 'h-12 w-12',
    rounded: 'rounded-2xl',
  },
};

export const VehicleThumbnail = ({
  vehicleName,
  size = 'md',
  className,
  showFallback = true,
  onClick,
  badge,
  loading = 'lazy',
}: VehicleThumbnailProps) => {
  const imageUrl = getVehicleImage(vehicleName);
  const config = sizeConfig[size];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerClasses = cn(
    'relative overflow-hidden bg-muted flex-shrink-0',
    config.width,
    config.height,
    config.rounded,
    onClick && 'cursor-pointer group',
    className
  );

  // No image or error - show fallback
  if (!imageUrl || imageError) {
    if (!showFallback) return null;
    
    return (
      <div 
        className={cn(containerClasses, 'flex items-center justify-center')}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      >
        <Car className={cn(config.iconSize, 'text-muted-foreground')} />
        {badge && (
          <div className="absolute -top-1 -right-1">
            {badge}
          </div>
        )}
      </div>
    );
  }

  return (
    <div 
      className={containerClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      {/* Loading skeleton */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Image */}
      <img
        src={imageUrl}
        alt={vehicleName}
        loading={loading}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageError(true)}
        className={cn(
          'w-full h-full object-cover transition-all duration-300',
          !imageLoaded && 'opacity-0',
          imageLoaded && 'opacity-100',
          onClick && 'group-hover:scale-110'
        )}
      />

      {/* Hover overlay */}
      {onClick && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
      )}

      {/* Badge */}
      {badge && (
        <div className="absolute -top-1 -right-1 z-10">
          {badge}
        </div>
      )}
    </div>
  );
};

export default VehicleThumbnail;
