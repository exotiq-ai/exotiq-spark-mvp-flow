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
  /** Direct image URL - takes precedence over static mapping */
  imageUrl?: string | null;
  size?: ThumbnailSize;
  className?: string;
  showFallback?: boolean;
  onClick?: () => void;
  badge?: React.ReactNode;
  loading?: 'lazy' | 'eager';
}

/**
 * Validates if a URL is usable (not a filesystem path accidentally saved to DB)
 */
const isValidImageUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  // Filter out filesystem paths that were accidentally saved to DB
  if (url.startsWith('/src/')) return false;
  if (url.startsWith('/lovable-uploads/') && !url.startsWith('https://')) return false;
  // Accept valid URLs (https, data URIs, or relative paths that aren't filesystem)
  return true;
};

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
  imageUrl: providedImageUrl,
  size = 'md',
  className,
  showFallback = true,
  onClick,
  badge,
  loading = 'lazy',
}: VehicleThumbnailProps) => {
  const config = sizeConfig[size];
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);

  // Multi-stage image resolution:
  // 1. Validate provided URL (filter out filesystem paths)
  // 2. Try static mapping as fallback
  // 3. Show placeholder if both fail
  const staticUrl = getVehicleImage(vehicleName);
  const primaryUrl = isValidImageUrl(providedImageUrl) ? providedImageUrl : null;
  
  // Determine which URL to use based on fallback state
  const resolvedImageUrl = usingFallback 
    ? staticUrl 
    : (primaryUrl || staticUrl);

  // Handle image load error with fallback chain
  const handleImageError = () => {
    if (!usingFallback && staticUrl && primaryUrl) {
      // Primary URL failed, try static mapping
      setUsingFallback(true);
      setImageLoaded(false);
    } else {
      // Both failed, show placeholder
      setImageError(true);
    }
  };

  const containerClasses = cn(
    'relative overflow-hidden bg-muted flex-shrink-0',
    config.width,
    config.height,
    config.rounded,
    onClick && 'cursor-pointer group',
    className
  );

  // No image or error - show fallback
  if (!resolvedImageUrl || imageError) {
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
        src={resolvedImageUrl}
        alt={vehicleName}
        loading={loading}
        onLoad={() => setImageLoaded(true)}
        onError={handleImageError}
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
