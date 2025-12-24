import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Download,
  Maximize2,
} from "lucide-react";
import { format } from "date-fns";

interface Photo {
  id: string;
  url: string;
  type: string;
  description?: string;
  uploadedAt?: string;
}

interface InspectionPhotoGalleryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: Photo[];
  inspectionType?: 'pre_rental' | 'post_rental';
  vehicleName?: string;
  inspectionDate?: string;
}

const PHOTO_TYPE_LABELS: Record<string, string> = {
  exterior_front: 'Front View',
  exterior_rear: 'Rear View',
  exterior_left: 'Left Side',
  exterior_right: 'Right Side',
  interior_front: 'Interior Front',
  interior_rear: 'Interior Rear',
  dashboard: 'Dashboard',
  damage: 'Damage Documentation',
  other: 'Other',
};

export const InspectionPhotoGallery = ({
  open,
  onOpenChange,
  photos,
  inspectionType,
  vehicleName,
  inspectionDate,
}: InspectionPhotoGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const currentPhoto = photos[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
    resetTransform();
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
    resetTransform();
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const resetTransform = () => {
    setZoom(1);
    setRotation(0);
  };

  const handleDownload = async () => {
    if (!currentPhoto) return;
    
    try {
      const response = await fetch(currentPhoto.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `inspection-${currentPhoto.type}-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') handlePrevious();
    if (e.key === 'ArrowRight') handleNext();
    if (e.key === 'Escape') onOpenChange(false);
  };

  if (photos.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-6xl w-full h-[90vh] p-0 gap-0"
        onKeyDown={handleKeyDown}
      >
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">
                {vehicleName ? `${vehicleName} Inspection Photos` : 'Inspection Photos'}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {inspectionType && (
                  <Badge variant="outline">
                    {inspectionType === 'pre_rental' ? 'Pickup' : 'Return'} Inspection
                  </Badge>
                )}
                {inspectionDate && (
                  <span className="text-sm text-muted-foreground">
                    {format(new Date(inspectionDate), 'MMM d, yyyy h:mm a')}
                  </span>
                )}
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} of {photos.length}
            </span>
          </div>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Thumbnail Sidebar */}
          <div className="w-24 border-r bg-muted/30">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-2">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    onClick={() => {
                      setCurrentIndex(index);
                      resetTransform();
                    }}
                    className={`
                      w-full aspect-square rounded-lg overflow-hidden border-2 transition-all
                      ${index === currentIndex 
                        ? 'border-primary ring-2 ring-primary/20' 
                        : 'border-transparent hover:border-primary/50'
                      }
                    `}
                  >
                    <img
                      src={photo.url}
                      alt={PHOTO_TYPE_LABELS[photo.type] || photo.type}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Main Image View */}
          <div className="flex-1 relative bg-black/90 flex items-center justify-center overflow-hidden">
            {/* Navigation Buttons */}
            {photos.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 z-10 text-white hover:bg-white/20 h-12 w-12"
                  onClick={handlePrevious}
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 z-10 text-white hover:bg-white/20 h-12 w-12"
                  onClick={handleNext}
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              </>
            )}

            {/* Image */}
            {currentPhoto && (
              <img
                src={currentPhoto.url}
                alt={PHOTO_TYPE_LABELS[currentPhoto.type] || currentPhoto.type}
                className="max-w-full max-h-full object-contain transition-transform duration-200"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              />
            )}

            {/* Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-4 py-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-8 w-8"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-8 w-8"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="w-px h-6 bg-white/30 mx-2" />
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-8 w-8"
                onClick={handleRotate}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-8 w-8"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 h-8 w-8"
                onClick={resetTransform}
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Photo Info */}
            <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
              <Badge className="bg-primary/80">
                {PHOTO_TYPE_LABELS[currentPhoto?.type] || currentPhoto?.type}
              </Badge>
              {currentPhoto?.description && (
                <p className="text-white text-sm mt-1">{currentPhoto.description}</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
