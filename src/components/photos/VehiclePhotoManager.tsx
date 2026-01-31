import { useState, useMemo, forwardRef, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star,
  Trash2,
  Upload,
  ZoomIn,
  AlertTriangle,
  CheckCircle2,
  Camera,
  ImageOff,
  MoreVertical,
  Sparkles,
  RefreshCw,
  Wand2,
  RotateCcw,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useVehiclePhotos } from '@/hooks/useVehiclePhotos';
import { usePhotoAnalysis } from './usePhotoAnalysis';
import { HeroEnhancementPreview } from './HeroEnhancementPreview';
import { OriginalPhotoDialog } from './OriginalPhotoDialog';
import { RECOMMENDED_ANGLES, ANGLE_LABELS, PHOTO_TYPE_LABELS, VehiclePhoto, DetectedAngle } from './types';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface VehiclePhotoManagerProps {
  vehicleId: string;
  vehicleName: string;
  onPhotoClick?: (photo: VehiclePhoto) => void;
  onUploadClick?: () => void;
  compact?: boolean;
}

export const VehiclePhotoManager = ({
  vehicleId,
  vehicleName,
  onPhotoClick,
  onUploadClick,
  compact = false,
}: VehiclePhotoManagerProps) => {
  const { photos, loading, refetch } = useVehiclePhotos({ vehicleId, realtime: true });
  const { setAsHero, deletePhoto, uploadAndAnalyze } = usePhotoAnalysis();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [enhanceDialogOpen, setEnhanceDialogOpen] = useState(false);
  const [selectedHeroPhoto, setSelectedHeroPhoto] = useState<{ id: string; url: string } | null>(null);
  const [replacePhotoId, setReplacePhotoId] = useState<string | null>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [originalPhotoDialog, setOriginalPhotoDialog] = useState<{
    open: boolean;
    originalUrl: string;
    enhancedUrl: string;
    photoId: string;
  } | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);

  // Find hero photo
  const heroPhoto = useMemo(() => 
    photos.find(p => p.photo_type === 'hero'),
    [photos]
  );

  // Other photos (non-hero)
  const otherPhotos = useMemo(() => 
    photos.filter(p => p.photo_type !== 'hero'),
    [photos]
  );

  // Coverage calculation - show unique angles covered
  const coverage = useMemo(() => {
    const detectedAngles = new Set(photos.map(p => p.detected_angle).filter(Boolean));
    const uniqueAngleCount = detectedAngles.size;
    const totalAngles = RECOMMENDED_ANGLES.length;
    const recommendedRequired = RECOMMENDED_ANGLES.filter(a => a.required);
    const missing = RECOMMENDED_ANGLES.filter(a => !detectedAngles.has(a.angle));
    
    return {
      uniqueAngles: uniqueAngleCount,
      totalPhotos: photos.length,
      total: totalAngles,
      requiredCovered: recommendedRequired.filter(a => detectedAngles.has(a.angle)).length,
      requiredTotal: recommendedRequired.length,
      percentage: Math.round((uniqueAngleCount / totalAngles) * 100),
      missing: missing.map(a => a.label),
    };
  }, [photos]);

  // Suggest best hero photo (front_quarter with highest quality)
  const suggestedHero = useMemo(() => {
    if (heroPhoto) return null;
    
    // Priority: front_quarter > front > side angles, then by quality
    const priorityAngles = ['front_quarter', 'front', 'side_left', 'side_right'];
    const sorted = [...photos].sort((a, b) => {
      const aIndex = priorityAngles.indexOf(a.detected_angle || '');
      const bIndex = priorityAngles.indexOf(b.detected_angle || '');
      const aPriority = aIndex === -1 ? 100 : aIndex;
      const bPriority = bIndex === -1 ? 100 : bIndex;
      
      if (aPriority !== bPriority) return aPriority - bPriority;
      return (b.quality_score || 0) - (a.quality_score || 0);
    });
    
    return sorted[0] || null;
  }, [photos, heroPhoto]);

  const handleSetAsHero = async (photoId: string, photoUrl?: string) => {
    try {
      setActionLoading(photoId);
      await setAsHero(photoId);
      await refetch();
      toast.success('Hero photo updated');
      
      // After setting as hero, offer enhancement
      if (photoUrl) {
        setSelectedHeroPhoto({ id: photoId, url: photoUrl });
        setEnhanceDialogOpen(true);
      }
    } catch (error) {
      toast.error('Failed to set hero photo');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (photoId: string) => {
    try {
      setActionLoading(photoId);
      await deletePhoto(photoId);
      await refetch();
      toast.success('Photo deleted');
    } catch (error) {
      toast.error('Failed to delete photo');
    } finally {
      setActionLoading(null);
      setDeleteConfirm(null);
    }
  };

  const handleReplacePhoto = async (photoId: string, file: File) => {
    try {
      setActionLoading(photoId);
      
      // Upload and analyze the new photo
      const result = await uploadAndAnalyze(file, vehicleId);
      
      // Delete the old photo
      await deletePhoto(photoId);
      
      await refetch();
      toast.success('Photo replaced successfully');
    } catch (error) {
      toast.error('Failed to replace photo');
    } finally {
      setActionLoading(null);
      setReplacePhotoId(null);
    }
  };

  const handleEnhanceHero = () => {
    if (heroPhoto) {
      setSelectedHeroPhoto({ id: heroPhoto.id, url: heroPhoto.url });
      setEnhanceDialogOpen(true);
    }
  };

  const handleViewOriginal = (photo: { id: string; url: string; enhanced_url?: string | null }) => {
    if (photo.enhanced_url) {
      setOriginalPhotoDialog({
        open: true,
        originalUrl: photo.url,
        enhancedUrl: photo.enhanced_url,
        photoId: photo.id,
      });
    }
  };

  const handleRestoreOriginal = async (photoId: string) => {
    try {
      setIsRestoring(true);
      const { error } = await supabase
        .from('vehicle_photos')
        .update({
          is_enhanced: false,
          enhanced_url: null,
          enhanced_at: null,
          enhancement_settings: null,
        })
        .eq('id', photoId);

      if (error) throw error;

      await refetch();
      toast.success('Original photo restored');
      setOriginalPhotoDialog(null);
    } catch (error) {
      console.error('Failed to restore original:', error);
      toast.error('Failed to restore original photo');
    } finally {
      setIsRestoring(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="w-full aspect-video rounded-lg" />
        <div className="grid grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <ImageOff className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No photos for this vehicle</p>
          {onUploadClick && (
            <Button onClick={onUploadClick} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Photos
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {/* Hero Photo Section */}
      {heroPhoto ? (
        <div className="relative group">
          <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
            <img
              src={heroPhoto.enhanced_url || heroPhoto.url}
              alt={`${vehicleName} - Hero`}
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget;
                target.src = '';
                target.style.display = 'none';
                const parent = target.parentElement;
                if (parent && !parent.querySelector('.hero-error-fallback')) {
                  const fallback = document.createElement('div');
                  fallback.className = 'hero-error-fallback absolute inset-0 flex items-center justify-center bg-muted';
                  fallback.innerHTML = '<div class="text-center text-muted-foreground"><svg class="h-16 w-16 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg><p>Image unavailable</p></div>';
                  parent.appendChild(fallback);
                }
              }}
            />
            <div className="absolute top-2 left-2 flex items-center gap-2">
              <Badge className="bg-amber-500 text-white gap-1">
                <Star className="h-3 w-3 fill-current" />
                Hero Photo
              </Badge>
              {heroPhoto.is_enhanced && (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  Enhanced
                </Badge>
              )}
            </div>
            
            {/* Hover Actions */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
              {onPhotoClick && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onPhotoClick(heroPhoto as unknown as VehiclePhoto)}
                >
                  <ZoomIn className="h-4 w-4 mr-1" />
                  View
                </Button>
              )}
              {heroPhoto.is_enhanced && heroPhoto.enhanced_url && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleViewOriginal(heroPhoto)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Original
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                onClick={handleEnhanceHero}
              >
                <Wand2 className="h-4 w-4 mr-1" />
                {heroPhoto.is_enhanced ? 'Re-enhance' : 'Enhance'}
              </Button>
            </div>
          </div>
          
          {/* Quality indicator */}
          {heroPhoto.quality_score < 70 && (
            <div className="absolute bottom-2 right-2">
              <Badge variant="outline" className="bg-background/90 text-amber-600 border-amber-500/50 gap-1">
                <AlertTriangle className="h-3 w-3" />
                Quality: {heroPhoto.quality_score}%
              </Badge>
            </div>
          )}
        </div>
      ) : (
        <Card className="border-dashed border-amber-500/50 bg-amber-500/5">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Star className="h-8 w-8 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-amber-600">No hero photo selected</p>
                  {suggestedHero ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      AI suggests: {ANGLE_LABELS[suggestedHero.detected_angle as DetectedAngle] || 'Best available shot'}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click "Set as Hero" on any photo below
                    </p>
                  )}
                </div>
              </div>
              {suggestedHero && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleSetAsHero(suggestedHero.id, suggestedHero.url)}
                  className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
                >
                  <Star className="h-3 w-3 mr-1" />
                  Use Suggested
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coverage Indicator */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Photo Coverage</span>
          <span className={cn(
            'font-medium',
            coverage.percentage >= 70 ? 'text-success' :
            coverage.percentage >= 40 ? 'text-amber-600' :
            'text-muted-foreground'
          )}>
            {coverage.uniqueAngles}/{coverage.total} angles
            <span className="text-muted-foreground font-normal ml-1">
              ({coverage.totalPhotos} photos)
            </span>
          </span>
        </div>
        <Progress 
          value={coverage.percentage} 
          className={cn(
            'h-2',
            coverage.percentage >= 70 && '[&>div]:bg-success',
            coverage.percentage >= 40 && coverage.percentage < 70 && '[&>div]:bg-amber-500'
          )}
        />
        {coverage.missing.length > 0 && !compact && (
          <p className="text-xs text-muted-foreground">
            Missing: {coverage.missing.slice(0, 3).join(', ')}
            {coverage.missing.length > 3 && ` +${coverage.missing.length - 3} more`}
          </p>
        )}
      </div>

      {/* Photo Grid */}
      <div className={cn(
        'grid gap-2',
        compact ? 'grid-cols-4' : 'grid-cols-3 md:grid-cols-4'
      )}>
        <AnimatePresence mode="popLayout">
          {otherPhotos.map((photo) => (
            <PhotoThumbnail
              key={photo.id}
              photo={photo as unknown as VehiclePhoto}
              isLoading={actionLoading === photo.id}
              onView={onPhotoClick ? () => onPhotoClick(photo as unknown as VehiclePhoto) : undefined}
              onSetHero={() => handleSetAsHero(photo.id, photo.url)}
              onDelete={() => setDeleteConfirm(photo.id)}
              compact={compact}
            />
          ))}
        </AnimatePresence>

        {/* Add More Button */}
        {onUploadClick && (
          <motion.button
            layout
            onClick={onUploadClick}
            className={cn(
              'aspect-square rounded-lg border-2 border-dashed',
              'flex flex-col items-center justify-center gap-1',
              'text-muted-foreground hover:text-primary hover:border-primary/50',
              'transition-colors bg-muted/30'
            )}
          >
            <Upload className={cn('h-5 w-5', compact && 'h-4 w-4')} />
            {!compact && <span className="text-xs">Add More</span>}
          </motion.button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Photo</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this photo? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Hero Enhancement Dialog */}
      {selectedHeroPhoto && (
        <HeroEnhancementPreview
          open={enhanceDialogOpen}
          onOpenChange={(open) => {
            setEnhanceDialogOpen(open);
            if (!open) setSelectedHeroPhoto(null);
          }}
          photoId={selectedHeroPhoto.id}
          photoUrl={selectedHeroPhoto.url}
          vehicleName={vehicleName}
          onEnhanced={() => refetch()}
        />
      )}

      {/* Original Photo Comparison Dialog */}
      {originalPhotoDialog && (
        <OriginalPhotoDialog
          open={originalPhotoDialog.open}
          onOpenChange={(open) => !open && setOriginalPhotoDialog(null)}
          originalUrl={originalPhotoDialog.originalUrl}
          enhancedUrl={originalPhotoDialog.enhancedUrl}
          vehicleName={vehicleName}
          onRestoreOriginal={() => handleRestoreOriginal(originalPhotoDialog.photoId)}
          isRestoring={isRestoring}
        />
      )}
    </div>
  );
};

// Photo Thumbnail Component
interface PhotoThumbnailProps {
  photo: VehiclePhoto;
  isLoading?: boolean;
  onView?: () => void;
  onSetHero: () => void;
  onDelete: () => void;
  compact?: boolean;
}

const PhotoThumbnail = forwardRef<HTMLDivElement, PhotoThumbnailProps>(
  ({ photo, isLoading, onView, onSetHero, onDelete, compact }, ref) => {
  const hasQualityIssues = (photo.quality_issues?.length ?? 0) > 0 || (photo.quality_score ?? 100) < 70;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative aspect-square group"
    >
      <div className="w-full h-full rounded-lg overflow-hidden bg-muted border">
        <img
          src={photo.thumbnail_url || photo.url}
          alt={photo.detected_angle ? ANGLE_LABELS[photo.detected_angle as DetectedAngle] : 'Vehicle photo'}
          className={cn(
            'w-full h-full object-cover transition-transform',
            'group-hover:scale-105',
            isLoading && 'opacity-50'
          )}
          loading="lazy"
          onError={(e) => {
            const target = e.currentTarget;
            target.src = '';
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent && !parent.querySelector('.thumb-error-fallback')) {
              const fallback = document.createElement('div');
              fallback.className = 'thumb-error-fallback absolute inset-0 flex items-center justify-center bg-muted';
              fallback.innerHTML = '<svg class="h-6 w-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>';
              parent.appendChild(fallback);
            }
          }}
        />
        
        {/* Type Badge */}
        <Badge 
          variant="secondary" 
          className={cn(
            'absolute top-1 left-1 text-[10px] px-1.5 py-0',
            compact && 'hidden'
          )}
        >
          {PHOTO_TYPE_LABELS[photo.photo_type as keyof typeof PHOTO_TYPE_LABELS] || 'Photo'}
        </Badge>

        {/* Quality Warning */}
        {hasQualityIssues && (
          <div className={cn(
            'absolute top-1 right-1',
            compact && 'top-0.5 right-0.5'
          )}>
            <AlertTriangle className={cn(
              'h-4 w-4 text-amber-500',
              compact && 'h-3 w-3'
            )} />
          </div>
        )}

        {/* Hover Actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              {onView && (
                <DropdownMenuItem onClick={onView}>
                  <ZoomIn className="h-4 w-4 mr-2" />
                  View Full Size
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onSetHero}>
                <Star className="h-4 w-4 mr-2" />
                Set as Hero
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {/* Angle Label */}
      {photo.detected_angle && !compact && (
        <p className="text-[10px] text-muted-foreground text-center mt-1 truncate">
          {ANGLE_LABELS[photo.detected_angle as DetectedAngle]}
        </p>
      )}
    </motion.div>
  );
});

PhotoThumbnail.displayName = 'PhotoThumbnail';

