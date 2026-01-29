import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Check,
  X,
  SkipForward,
  Car,
  Sparkles,
  Search,
  ImageOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Rows3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePhotoReviewQueue } from '@/hooks/usePhotoReviewQueue';
import { EmptyState } from '@/components/common/EmptyState';
import { toast } from 'sonner';

interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
}

interface PhotoReviewQueueProps {
  vehicles: Vehicle[];
}

type ViewMode = 'single' | 'batch';

export const PhotoReviewQueue = ({ vehicles }: PhotoReviewQueueProps) => {
  const { queue, loading, matchPhoto, skipPhoto, rejectPhoto } = usePhotoReviewQueue();
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Filter vehicles by search
  const filteredVehicles = vehicles.filter(v => 
    v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.make?.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.model?.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  const currentPhoto = queue[currentIndex];

  const handleMatch = useCallback(async () => {
    if (!currentPhoto || !selectedVehicleId) {
      toast.error('Please select a vehicle');
      return;
    }

    try {
      setIsProcessing(true);
      await matchPhoto(currentPhoto.id, selectedVehicleId);
      toast.success('Photo matched to vehicle');
      setSelectedVehicleId('');
      // Move to next photo or stay at end
      if (currentIndex >= queue.length - 1) {
        setCurrentIndex(Math.max(0, queue.length - 2));
      }
    } catch (error) {
      toast.error('Failed to match photo');
    } finally {
      setIsProcessing(false);
    }
  }, [currentPhoto, selectedVehicleId, matchPhoto, currentIndex, queue.length]);

  const handleSkip = useCallback(async () => {
    if (!currentPhoto) return;
    await skipPhoto(currentPhoto.id);
    toast.info('Photo skipped');
  }, [currentPhoto, skipPhoto]);

  const handleReject = useCallback(async () => {
    if (!currentPhoto) return;

    try {
      setIsProcessing(true);
      await rejectPhoto(currentPhoto.id);
      toast.success('Photo rejected');
      if (currentIndex >= queue.length - 1) {
        setCurrentIndex(Math.max(0, queue.length - 2));
      }
    } catch (error) {
      toast.error('Failed to reject photo');
    } finally {
      setIsProcessing(false);
    }
  }, [currentPhoto, rejectPhoto, currentIndex, queue.length]);

  const goToNext = () => setCurrentIndex(prev => Math.min(prev + 1, queue.length - 1));
  const goToPrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isProcessing) return;
    
    switch (e.key) {
      case 'ArrowLeft':
        goToPrev();
        break;
      case 'ArrowRight':
        goToNext();
        break;
      case 'Enter':
        if (selectedVehicleId) handleMatch();
        break;
      case 's':
        handleSkip();
        break;
    }
  }, [selectedVehicleId, handleMatch, handleSkip, isProcessing]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="aspect-[4/3] rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <EmptyState
            icon={Check}
            title="All caught up!"
            description="No photos pending review. Great job!"
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" onKeyDown={handleKeyDown} tabIndex={0}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Review Queue</h2>
          <p className="text-sm text-muted-foreground">
            {queue.length} photo{queue.length !== 1 ? 's' : ''} pending review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'single' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('single')}
          >
            <Rows3 className="h-4 w-4 mr-1" />
            Single
          </Button>
          <Button
            variant={viewMode === 'batch' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('batch')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Batch
          </Button>
        </div>
      </div>

      {viewMode === 'single' ? (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Photo Preview */}
          <Card className="overflow-hidden">
            <div className="relative aspect-[4/3] bg-muted">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentPhoto.id}
                  src={currentPhoto.url}
                  alt={currentPhoto.original_filename || 'Photo'}
                  className="w-full h-full object-contain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              </AnimatePresence>

              {/* Navigation arrows */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-2">
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={goToPrev}
                  disabled={currentIndex === 0}
                  className="rounded-full shadow-lg"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={goToNext}
                  disabled={currentIndex === queue.length - 1}
                  className="rounded-full shadow-lg"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Counter */}
              <Badge className="absolute bottom-2 left-1/2 -translate-x-1/2">
                {currentIndex + 1} / {queue.length}
              </Badge>
            </div>

            {/* AI Analysis Info */}
            {currentPhoto.ai_analysis && (
              <div className="p-4 border-t bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">AI Analysis</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Angle: </span>
                    <span className="capitalize">
                      {(currentPhoto.ai_analysis as any)?.angle?.replace('_', ' ') || 'Unknown'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Confidence: </span>
                    <span>{Math.round(currentPhoto.suggestion_confidence * 100)}%</span>
                  </div>
                  {currentPhoto.suggested_make && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Detected: </span>
                      <span>
                        {currentPhoto.suggested_color} {currentPhoto.suggested_make}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>

          {/* Vehicle Selection */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Assign to Vehicle</CardTitle>
                <CardDescription>
                  Select which vehicle this photo belongs to
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vehicles..."
                    value={vehicleSearch}
                    onChange={e => setVehicleSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Vehicle List */}
                <ScrollArea className="h-[200px] border rounded-lg">
                  <div className="p-2 space-y-1">
                    {filteredVehicles.map(vehicle => (
                      <button
                        key={vehicle.id}
                        onClick={() => setSelectedVehicleId(vehicle.id)}
                        className={cn(
                          'w-full flex items-center gap-3 p-2 rounded-md text-left transition-colors',
                          'hover:bg-muted',
                          selectedVehicleId === vehicle.id && 'bg-primary/10 border border-primary/30'
                        )}
                      >
                        <Car className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{vehicle.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {vehicle.year} {vehicle.make} {vehicle.model}
                          </p>
                        </div>
                        {selectedVehicleId === vehicle.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </ScrollArea>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={handleMatch}
                    disabled={!selectedVehicleId || isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Match to Vehicle
                  </Button>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSkip}
                      disabled={isProcessing}
                    >
                      <SkipForward className="h-4 w-4 mr-2" />
                      Skip
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleReject}
                      disabled={isProcessing}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>

                {/* Keyboard shortcuts hint */}
                <div className="text-xs text-muted-foreground text-center">
                  <kbd className="px-1 py-0.5 rounded bg-muted">←</kbd>
                  <kbd className="px-1 py-0.5 rounded bg-muted ml-1">→</kbd>
                  {' to navigate • '}
                  <kbd className="px-1 py-0.5 rounded bg-muted">Enter</kbd>
                  {' to match • '}
                  <kbd className="px-1 py-0.5 rounded bg-muted">S</kbd>
                  {' to skip'}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Batch Mode */
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {queue.map((photo, index) => (
                <motion.div
                  key={photo.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-colors',
                    currentIndex === index ? 'border-primary' : 'border-transparent hover:border-muted-foreground/30'
                  )}
                  onClick={() => {
                    setCurrentIndex(index);
                    setViewMode('single');
                  }}
                >
                  <img
                    src={photo.url}
                    alt={photo.original_filename || 'Photo'}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-white text-xs truncate">
                      {photo.suggested_make || 'Unknown vehicle'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
