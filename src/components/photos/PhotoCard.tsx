import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Star,
  Trash2,
  MoreVertical,
  AlertTriangle,
  ZoomIn,
  ImageOff,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { VehiclePhoto, PhotoType, PHOTO_TYPE_LABELS, ANGLE_LABELS } from './types';

interface PhotoCardProps {
  photo: VehiclePhoto;
  onSetHero?: (photoId: string) => void;
  onDelete?: (photoId: string) => void;
  onView?: (photo: VehiclePhoto) => void;
  isLoading?: boolean;
  showVehicleName?: boolean;
  vehicleName?: string;
  className?: string;
}

const TYPE_COLORS: Record<PhotoType, string> = {
  hero: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  exterior: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  interior: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  detail: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  document: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
};

const TYPE_LABELS: Record<PhotoType, string> = {
  hero: 'Hero',
  exterior: 'Exterior',
  interior: 'Interior',
  detail: 'Detail',
  document: 'Document',
};

export const PhotoCard = ({
  photo,
  onSetHero,
  onDelete,
  onView,
  isLoading = false,
  showVehicleName = false,
  vehicleName,
  className,
}: PhotoCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const hasQualityIssues = photo.quality_issues && photo.quality_issues.length > 0;
  const isHero = photo.photo_type === 'hero';
  const qualityColor = photo.quality_score >= 80 
    ? 'text-success' 
    : photo.quality_score >= 50 
      ? 'text-amber-500' 
      : 'text-destructive';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={className}
    >
      <Card className={cn(
        'overflow-hidden group relative',
        isHero && 'ring-2 ring-amber-500/50',
        isLoading && 'opacity-50 pointer-events-none'
      )}>
        {/* Image Container */}
        <div 
          className="aspect-[4/3] bg-muted relative cursor-pointer"
          onClick={() => onView?.(photo)}
        >
          {!imageLoaded && !imageError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {imageError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
              <ImageOff className="h-8 w-8 mb-2" />
              <span className="text-xs">Failed to load</span>
            </div>
          ) : (
            <img
              src={photo.thumbnail_url || photo.url}
              alt={photo.original_filename || 'Vehicle photo'}
              className={cn(
                'w-full h-full object-cover transition-opacity duration-200',
                imageLoaded ? 'opacity-100' : 'opacity-0'
              )}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          )}

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <ZoomIn className="h-8 w-8 text-white" />
          </div>

          {/* Hero star badge */}
          {isHero && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-amber-500 text-white border-0 gap-1">
                <Star className="h-3 w-3 fill-current" />
                Hero
              </Badge>
            </div>
          )}

          {/* Quality warning */}
          {hasQualityIssues && (
            <div className="absolute top-2 right-2">
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Quality
              </Badge>
            </div>
          )}
        </div>

        {/* Info Footer */}
        <div className="p-3 space-y-2">
          {/* Type and Angle */}
          <div className="flex items-center justify-between gap-2">
            <Badge 
              variant="outline" 
              className={cn('text-xs', TYPE_COLORS[photo.photo_type])}
            >
              {TYPE_LABELS[photo.photo_type]}
            </Badge>
            
            {photo.detected_angle && photo.detected_angle !== 'unknown' && (
              <span className="text-xs text-muted-foreground capitalize">
                {photo.detected_angle.replace('_', ' ')}
              </span>
            )}
          </div>

          {/* Vehicle name (when showing all photos) */}
          {showVehicleName && vehicleName && (
            <p className="text-sm font-medium truncate">{vehicleName}</p>
          )}

          {/* Quality score and actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn('text-xs font-medium', qualityColor)}>
                {photo.quality_score}% quality
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!isHero && onSetHero && (
                  <DropdownMenuItem onClick={() => onSetHero(photo.id)}>
                    <Star className="h-4 w-4 mr-2" />
                    Set as Hero
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onView?.(photo)}>
                  <ZoomIn className="h-4 w-4 mr-2" />
                  View Full Size
                </DropdownMenuItem>
                {onDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => onDelete(photo.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </Card>
    </motion.div>
  );
};
