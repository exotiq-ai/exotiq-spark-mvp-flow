import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Camera, 
  AlertCircle,
  Plus,
  X
} from 'lucide-react';
import { CameraViewfinder } from './CameraViewfinder';
import { DamageCaptureModal } from './DamageCaptureModal';
import {
  GuidedPhoto,
  DamageItem,
  GUIDED_PHOTO_CONFIG,
  PhotoRole,
} from './types';

interface GuidedCaptureWizardProps {
  photos: GuidedPhoto[];
  damageItems: DamageItem[];
  onPhotoCapture: (photoId: string, imageData: string) => void;
  onPhotoSkip: (photoId: string) => void;
  onDamageAdd: (damage: Omit<DamageItem, 'id'>) => void;
  onDamageRemove: (damageId: string) => void;
  onComplete: () => void;
  onBack?: () => void;
  vehicleName?: string;
  direction: 'check_in' | 'check_out';
}

export const GuidedCaptureWizard = ({
  photos,
  damageItems,
  onPhotoCapture,
  onPhotoSkip,
  onDamageAdd,
  onDamageRemove,
  onComplete,
  onBack,
  vehicleName,
  direction,
}: GuidedCaptureWizardProps) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [viewMode, setViewMode] = useState<'capture' | 'review'>('capture');

  const currentPhoto = photos[currentPhotoIndex];
  
  // Calculate progress
  const completedCount = photos.filter(p => p.url || p.skipped).length;
  const progress = (completedCount / photos.length) * 100;
  const requiredComplete = photos.filter(p => p.required && (p.url || p.skipped)).length;
  const requiredTotal = photos.filter(p => p.required).length;
  const canComplete = requiredComplete === requiredTotal;

  // Handle photo capture
  const handleCapture = useCallback((imageData: string) => {
    onPhotoCapture(currentPhoto.id, imageData);
    
    // Auto-advance to next photo
    if (currentPhotoIndex < photos.length - 1) {
      setTimeout(() => {
        setCurrentPhotoIndex(prev => prev + 1);
      }, 500);
    } else {
      // All photos captured, switch to review
      setViewMode('review');
    }
  }, [currentPhoto, currentPhotoIndex, photos.length, onPhotoCapture]);

  // Handle skip
  const handleSkip = useCallback(() => {
    onPhotoSkip(currentPhoto.id);
    
    if (currentPhotoIndex < photos.length - 1) {
      setCurrentPhotoIndex(prev => prev + 1);
    } else {
      setViewMode('review');
    }
  }, [currentPhoto, currentPhotoIndex, photos.length, onPhotoSkip]);

  // Navigate photos
  const goToPrevious = useCallback(() => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(prev => prev - 1);
    }
  }, [currentPhotoIndex]);

  const goToNext = useCallback(() => {
    if (currentPhotoIndex < photos.length - 1) {
      setCurrentPhotoIndex(prev => prev + 1);
    }
  }, [currentPhotoIndex, photos.length]);

  // Handle damage added
  const handleDamageAdd = useCallback((damage: Omit<DamageItem, 'id'>) => {
    onDamageAdd(damage);
    setShowDamageModal(false);
  }, [onDamageAdd]);

  if (viewMode === 'capture') {
    return (
      <div className="flex flex-col h-full bg-black">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/90">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-white hover:bg-white/20"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Back
          </Button>
          
          <div className="text-center">
            <p className="text-white/60 text-xs">
              {direction === 'check_in' ? 'Check-In' : 'Check-Out'} Inspection
            </p>
            <p className="text-white text-sm font-medium">{vehicleName}</p>
          </div>
          
          <Badge variant="outline" className="text-white border-white/30">
            {currentPhotoIndex + 1} / {photos.length}
          </Badge>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-2">
          <Progress value={progress} className="h-1" />
        </div>

        {/* Photo Dots Navigator */}
        <div className="flex justify-center gap-1.5 pb-3 px-4 overflow-x-auto">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => setCurrentPhotoIndex(index)}
              className={cn(
                'w-2.5 h-2.5 rounded-full transition-all flex-shrink-0',
                index === currentPhotoIndex 
                  ? 'bg-white scale-125' 
                  : photo.url 
                    ? 'bg-green-500' 
                    : photo.skipped 
                      ? 'bg-yellow-500' 
                      : 'bg-white/30'
              )}
            />
          ))}
        </div>

        {/* Camera Viewfinder */}
        <div className="flex-1 relative">
          <CameraViewfinder
            instruction={currentPhoto.instruction}
            photoLabel={currentPhoto.label}
            onCapture={handleCapture}
            onSkip={currentPhoto.required ? undefined : handleSkip}
            canSkip={!currentPhoto.required}
            className="h-full"
          />
        </div>

        {/* Bottom Actions */}
        <div className="p-4 bg-black/90 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPrevious}
            disabled={currentPhotoIndex === 0}
            className="text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDamageModal(true)}
            className="text-white border-white/30 hover:bg-white/20"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Damage
            {damageItems.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-red-500 text-white">
                {damageItems.length}
              </Badge>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToNext}
            disabled={currentPhotoIndex === photos.length - 1}
            className="text-white hover:bg-white/20 disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Done Button (visible when all required photos are taken) */}
        {canComplete && (
          <div className="p-4 bg-black/90 border-t border-white/10">
            <Button
              onClick={() => setViewMode('review')}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4 mr-2" />
              Review Photos ({completedCount}/{photos.length})
            </Button>
          </div>
        )}

        {/* Damage Capture Modal */}
        <DamageCaptureModal
          open={showDamageModal}
          onClose={() => setShowDamageModal(false)}
          onCapture={handleDamageAdd}
        />
      </div>
    );
  }

  // Review Mode
  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode('capture')}
        >
          <ChevronLeft className="h-5 w-5 mr-1" />
          Back to Capture
        </Button>
        
        <h2 className="font-semibold">Review Photos</h2>
        
        <div className="w-20" /> {/* Spacer */}
      </div>

      {/* Photo Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-3 gap-2 mb-6">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              onClick={() => {
                setCurrentPhotoIndex(index);
                setViewMode('capture');
              }}
              className={cn(
                'aspect-square rounded-lg overflow-hidden relative border-2',
                photo.url 
                  ? 'border-green-500' 
                  : photo.skipped 
                    ? 'border-yellow-500 border-dashed' 
                    : 'border-dashed border-muted-foreground/30'
              )}
            >
              {photo.url ? (
                <img
                  src={photo.url}
                  alt={photo.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted/50 p-2">
                  <Camera className="h-6 w-6 text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground text-center">
                    {photo.skipped ? 'Skipped' : photo.label}
                  </span>
                </div>
              )}
              
              {photo.required && !photo.url && !photo.skipped && (
                <div className="absolute top-1 right-1">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                </div>
              )}
              
              {photo.url && (
                <div className="absolute top-1 right-1 bg-green-500 rounded-full p-0.5">
                  <Check className="h-3 w-3 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Damage Items */}
        {damageItems.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-3 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2 text-red-500" />
              Damage Items ({damageItems.length})
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {damageItems.map((damage) => (
                <div
                  key={damage.id}
                  className="relative rounded-lg overflow-hidden border"
                >
                  <img
                    src={damage.photoUrl}
                    alt={damage.damageType}
                    className="w-full aspect-video object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                    <p className="text-white text-xs font-medium capitalize">
                      {damage.damageType.replace('_', ' ')}
                    </p>
                  </div>
                  <button
                    onClick={() => onDamageRemove(damage.id)}
                    className="absolute top-1 right-1 bg-red-500 rounded-full p-1"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add More Damage Button */}
        <Button
          variant="outline"
          onClick={() => setShowDamageModal(true)}
          className="w-full mb-4"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Damage Photo
        </Button>
      </div>

      {/* Complete Button */}
      <div className="p-4 border-t">
        <Button
          onClick={onComplete}
          disabled={!canComplete}
          className="w-full btn-premium"
        >
          <Check className="h-4 w-4 mr-2" />
          Continue to Checklist
        </Button>
        {!canComplete && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            Please capture all required photos (odometer) to continue
          </p>
        )}
      </div>

      {/* Damage Capture Modal */}
      <DamageCaptureModal
        open={showDamageModal}
        onClose={() => setShowDamageModal(false)}
        onCapture={handleDamageAdd}
      />
    </div>
  );
};
