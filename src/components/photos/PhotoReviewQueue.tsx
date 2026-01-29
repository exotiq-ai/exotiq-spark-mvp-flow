import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
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
  CheckSquare,
  Square,
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
  const { 
    queue, 
    loading, 
    matchPhoto, 
    skipPhoto, 
    rejectPhoto,
    batchMatchPhotos,
    batchRejectPhotos,
    batchProgress,
  } = usePhotoReviewQueue();
  
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Batch mode state
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(new Set());
  const [batchVehicleId, setBatchVehicleId] = useState<string>('');

  // Filter vehicles by search
  const filteredVehicles = vehicles.filter(v => 
    v.name.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.make?.toLowerCase().includes(vehicleSearch.toLowerCase()) ||
    v.model?.toLowerCase().includes(vehicleSearch.toLowerCase())
  );

  const currentPhoto = queue[currentIndex];

  // Batch selection helpers
  const allSelected = useMemo(() => 
    queue.length > 0 && selectedPhotoIds.size === queue.length,
    [queue.length, selectedPhotoIds.size]
  );

  const someSelected = useMemo(() => 
    selectedPhotoIds.size > 0 && selectedPhotoIds.size < queue.length,
    [queue.length, selectedPhotoIds.size]
  );

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedPhotoIds(new Set());
    } else {
      setSelectedPhotoIds(new Set(queue.map(p => p.id)));
    }
  }, [allSelected, queue]);

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotoIds(prev => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  // Clear selection when switching modes
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (mode === 'single') {
      setSelectedPhotoIds(new Set());
      setBatchVehicleId('');
    }
  }, []);

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

  // Batch operations
  const handleBatchMatch = useCallback(async () => {
    if (selectedPhotoIds.size === 0 || !batchVehicleId) {
      toast.error('Select photos and a vehicle');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await batchMatchPhotos(Array.from(selectedPhotoIds), batchVehicleId);
      
      if (result.failed > 0) {
        toast.warning(`Matched ${result.success} photos, ${result.failed} failed`);
      } else {
        toast.success(`Matched ${result.success} photos to vehicle`);
      }
      
      setSelectedPhotoIds(new Set());
      setBatchVehicleId('');
    } catch (error) {
      toast.error('Batch match failed');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPhotoIds, batchVehicleId, batchMatchPhotos]);

  const handleBatchReject = useCallback(async () => {
    if (selectedPhotoIds.size === 0) {
      toast.error('Select photos to reject');
      return;
    }

    try {
      setIsProcessing(true);
      const result = await batchRejectPhotos(Array.from(selectedPhotoIds));
      
      if (result.failed > 0) {
        toast.warning(`Rejected ${result.success} photos, ${result.failed} failed`);
      } else {
        toast.success(`Rejected ${result.success} photos`);
      }
      
      setSelectedPhotoIds(new Set());
    } catch (error) {
      toast.error('Batch reject failed');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedPhotoIds, batchRejectPhotos]);

  const goToNext = () => setCurrentIndex(prev => Math.min(prev + 1, queue.length - 1));
  const goToPrev = () => setCurrentIndex(prev => Math.max(prev - 1, 0));

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (isProcessing || viewMode === 'batch') return;
    
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
  }, [selectedVehicleId, handleMatch, handleSkip, isProcessing, viewMode]);

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
            onClick={() => handleViewModeChange('single')}
          >
            <Rows3 className="h-4 w-4 mr-1" />
            Single
          </Button>
          <Button
            variant={viewMode === 'batch' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleViewModeChange('batch')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" />
            Batch
          </Button>
        </div>
      </div>

      {/* Batch Progress Indicator */}
      {batchProgress && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {batchProgress.status === 'matching' ? 'Matching' : 
                   batchProgress.status === 'rejecting' ? 'Rejecting' : 'Complete'}...
                </span>
                <span className="text-muted-foreground">
                  {batchProgress.current} of {batchProgress.total}
                </span>
              </div>
              <Progress 
                value={(batchProgress.current / batchProgress.total) * 100} 
                className="h-2"
              />
              {batchProgress.status === 'complete' && (
                <p className="text-xs text-muted-foreground">
                  ✓ {batchProgress.successCount} successful
                  {batchProgress.failCount > 0 && `, ${batchProgress.failCount} failed`}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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
                    <span>{Math.round(currentPhoto.suggestion_confidence)}%</span>
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
        <div className="space-y-4">
          {/* Batch Actions Bar */}
          <Card>
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Select All */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleSelectAll}
                    className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                  >
                    {allSelected ? (
                      <CheckSquare className="h-5 w-5 text-primary" />
                    ) : someSelected ? (
                      <div className="h-5 w-5 border-2 border-primary rounded flex items-center justify-center">
                        <div className="h-2 w-2 bg-primary rounded-sm" />
                      </div>
                    ) : (
                      <Square className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span>
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </span>
                  </button>
                  <Badge variant="secondary" className="text-xs">
                    {selectedPhotoIds.size} of {queue.length} selected
                  </Badge>
                </div>

                {/* Vehicle Selector and Actions */}
                <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
                  <Select 
                    value={batchVehicleId} 
                    onValueChange={setBatchVehicleId}
                    disabled={selectedPhotoIds.size === 0}
                  >
                    <SelectTrigger className="w-full sm:w-[250px]">
                      <SelectValue placeholder="Select vehicle to match..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vehicles.map(vehicle => (
                        <SelectItem key={vehicle.id} value={vehicle.id}>
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4" />
                            <span>{vehicle.name}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleBatchMatch}
                      disabled={selectedPhotoIds.size === 0 || !batchVehicleId || isProcessing}
                      className="flex-1 sm:flex-none"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Match {selectedPhotoIds.size > 0 ? selectedPhotoIds.size : ''} Selected
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleBatchReject}
                      disabled={selectedPhotoIds.size === 0 || isProcessing}
                    >
                      <X className="h-4 w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Reject</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photo Grid */}
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {queue.map((photo, index) => {
                  const isSelected = selectedPhotoIds.has(photo.id);
                  
                  return (
                    <motion.div
                      key={photo.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                      className={cn(
                        'relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all',
                        isSelected 
                          ? 'border-primary ring-2 ring-primary/20' 
                          : 'border-transparent hover:border-muted-foreground/30'
                      )}
                      onClick={() => togglePhotoSelection(photo.id)}
                    >
                      <img
                        src={photo.url}
                        alt={photo.original_filename || 'Photo'}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      
                      {/* Checkbox Overlay */}
                      <div className="absolute top-2 left-2">
                        <div className={cn(
                          'h-6 w-6 rounded border-2 flex items-center justify-center transition-colors',
                          isSelected 
                            ? 'bg-primary border-primary' 
                            : 'bg-background/80 border-muted-foreground/50 backdrop-blur-sm'
                        )}>
                          {isSelected && <Check className="h-4 w-4 text-primary-foreground" />}
                        </div>
                      </div>

                      {/* AI Suggestion Badge */}
                      {photo.suggested_make && (
                        <div className="absolute top-2 right-2">
                          <Badge 
                            variant="secondary" 
                            className="text-[10px] bg-background/80 backdrop-blur-sm"
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            {Math.round(photo.suggestion_confidence)}%
                          </Badge>
                        </div>
                      )}

                      {/* Info Overlay */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-white text-xs truncate">
                          {photo.suggested_make || 'Unknown vehicle'}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
