import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getVehicleImage } from "@/lib/vehicleImageMapping";
import { VehiclePhotoManager } from "@/components/photos/VehiclePhotoManager";
import { BulkUploadModal } from "@/components/photos/BulkUploadModal";
import { PhotoGalleryStrip } from "@/components/photos/PhotoGalleryStrip";
import { useVehiclePhotos } from "@/hooks/useVehiclePhotos";
import { Calendar, TrendingUp, DollarSign, CheckCircle2, AlertTriangle, Camera, Image, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface VehicleImageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicleName: string;
  vehicleId?: string;
  vehicleDetails?: {
    make: string;
    model: string;
    year: number;
    status: string;
    dailyRate: number;
    utilization?: number;
    revenue?: number;
    returnDate?: string;
    maintenanceAlerts?: Array<{
      type: string;
      description: string;
      severity: 'low' | 'medium' | 'high';
    }>;
  };
}

export function VehicleImageDialog({
  open,
  onOpenChange,
  vehicleName,
  vehicleId,
  vehicleDetails,
}: VehicleImageDialogProps) {
  const staticImageUrl = getVehicleImage(vehicleName);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Fetch actual vehicle photos
  const { photos, loading: photosLoading, refetch } = useVehiclePhotos({ 
    vehicleId: vehicleId || '', 
    realtime: true 
  });

  // Find hero photo and determine main image with cascading resolution
  const heroPhoto = useMemo(() => 
    photos.find(p => p.photo_type === 'hero'),
    [photos]
  );

  // Cascading image resolution: Enhanced Hero → Original Hero → Static → null
  const mainImageUrl = useMemo(() => {
    if (heroPhoto?.enhanced_url) return heroPhoto.enhanced_url;
    if (heroPhoto?.url) return heroPhoto.url;
    return staticImageUrl;
  }, [heroPhoto, staticImageUrl]);

  // Get current displayed photo based on gallery selection
  const currentDisplayUrl = useMemo(() => {
    if (photos.length === 0) return mainImageUrl;
    if (selectedPhotoIndex === 0 && heroPhoto) {
      return heroPhoto.enhanced_url || heroPhoto.url;
    }
    const photo = photos[selectedPhotoIndex];
    return photo?.enhanced_url || photo?.url || mainImageUrl;
  }, [photos, selectedPhotoIndex, heroPhoto, mainImageUrl]);

  // Reset photo index when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPhotoIndex(0);
    }
  }, [open]);

  // Keyboard navigation for gallery
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!open || photos.length <= 1) return;
    if (e.key === 'ArrowLeft') {
      setSelectedPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
    } else if (e.key === 'ArrowRight') {
      setSelectedPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
    }
  }, [open, photos.length]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const goToPrevious = () => {
    setSelectedPhotoIndex(prev => (prev > 0 ? prev - 1 : photos.length - 1));
  };

  const goToNext = () => {
    setSelectedPhotoIndex(prev => (prev < photos.length - 1 ? prev + 1 : 0));
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">{vehicleName}</DialogTitle>
        </DialogHeader>
        
        {vehicleId ? (
          <>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="overview" className="gap-2">
                  <Image className="h-4 w-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="photos" className="gap-2">
                  <Camera className="h-4 w-4" />
                  Photos
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="overview" className="space-y-4 mt-4">
                {/* Main Image with Navigation */}
                <div className="relative group">
                  {currentDisplayUrl ? (
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl border shadow-lg bg-muted">
                      <img
                        src={currentDisplayUrl}
                        alt={vehicleName}
                        className="object-contain w-full h-full"
                        onError={(e) => {
                          // Fallback to static if photo fails to load
                          if (staticImageUrl && e.currentTarget.src !== staticImageUrl) {
                            e.currentTarget.src = staticImageUrl;
                          }
                        }}
                      />
                      
                      {/* Navigation arrows (only if multiple photos) */}
                      {photos.length > 1 && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={goToPrevious}
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={goToNext}
                          >
                            <ChevronRight className="h-6 w-6" />
                          </Button>
                        </>
                      )}

                      {/* Photo type badge */}
                      {photos.length > 0 && photos[selectedPhotoIndex] && (
                        <div className="absolute top-2 left-2">
                          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
                            {selectedPhotoIndex === 0 && heroPhoto ? 'Hero Photo' : `Photo ${selectedPhotoIndex + 1}/${photos.length}`}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="aspect-video w-full bg-muted rounded-xl flex items-center justify-center">
                      <p className="text-muted-foreground">No image available</p>
                    </div>
                  )}
                </div>

                {/* Photo Gallery Strip */}
                {photos.length > 1 && (
                  <PhotoGalleryStrip
                    photos={photos}
                    currentIndex={selectedPhotoIndex}
                    onSelect={setSelectedPhotoIndex}
                    size="sm"
                  />
                )}

                <VehicleDetailsSection vehicleDetails={vehicleDetails} formatDate={formatDate} />
              </TabsContent>
              
              <TabsContent value="photos" className="mt-4">
                <VehiclePhotoManager
                  vehicleId={vehicleId}
                  vehicleName={vehicleName}
                  onUploadClick={() => setShowUploadModal(true)}
                />
              </TabsContent>
            </Tabs>
            
            {/* Bulk Upload Modal for this vehicle */}
            <BulkUploadModal
              open={showUploadModal}
              onOpenChange={setShowUploadModal}
              vehicles={[{ id: vehicleId, name: vehicleName }]}
              preSelectedVehicleId={vehicleId}
            />
          </>
        ) : (
          <div className="space-y-6">
            {staticImageUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-xl border shadow-lg">
                <img
                  src={staticImageUrl}
                  alt={vehicleName}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : (
              <div className="aspect-video w-full bg-muted rounded-xl flex items-center justify-center">
                <p className="text-muted-foreground">No image available</p>
              </div>
            )}
            <VehicleDetailsSection vehicleDetails={vehicleDetails} formatDate={formatDate} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Extracted vehicle details section for reuse
function VehicleDetailsSection({ 
  vehicleDetails, 
  formatDate 
}: { 
  vehicleDetails?: VehicleImageDialogProps['vehicleDetails']; 
  formatDate: (dateString: string) => string;
}) {
  if (!vehicleDetails) return null;
  
  return (
    <>
      {/* Basic Details */}
      <div className="grid grid-cols-2 gap-4 pb-4 border-b">
        <div>
          <p className="text-sm text-muted-foreground">Make & Model</p>
          <p className="font-medium text-lg">{vehicleDetails.make} {vehicleDetails.model}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Year</p>
          <p className="font-medium text-lg">{vehicleDetails.year}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Status</p>
          <Badge variant={vehicleDetails.status === 'available' ? 'default' : 'secondary'} className="capitalize">
            {vehicleDetails.status}
          </Badge>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Daily Rate</p>
          <p className="font-medium text-lg">
            {vehicleDetails.dailyRate != null ? `$${vehicleDetails.dailyRate.toLocaleString()}` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Performance Metrics */}
      {(vehicleDetails.utilization !== undefined || vehicleDetails.revenue !== undefined) && (
        <div className="grid grid-cols-2 gap-4">
          {vehicleDetails.utilization !== undefined && (
            <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <p className="text-sm text-muted-foreground">Utilization Rate</p>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">{vehicleDetails.utilization}%</p>
                <Badge variant={vehicleDetails.utilization > 80 ? 'default' : 'secondary'} className="text-xs">
                  {vehicleDetails.utilization > 80 ? 'High' : 'Moderate'}
                </Badge>
              </div>
            </Card>
          )}
          
          {vehicleDetails.revenue !== undefined && (
            <Card className="p-4 bg-gradient-to-br from-success/5 to-success/10 border-success/20">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-success" />
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
              <p className="text-3xl font-bold">${vehicleDetails.revenue?.toLocaleString()}</p>
            </Card>
          )}
        </div>
      )}

      {/* Return Date */}
      {vehicleDetails.returnDate && (
        <div className="flex items-center gap-3 p-4 bg-accent/10 border border-accent/20 rounded-lg">
          <Calendar className="h-5 w-5 text-accent flex-shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">Expected Return</p>
            <p className="font-semibold text-lg">{formatDate(vehicleDetails.returnDate)}</p>
          </div>
        </div>
      )}

      {/* Maintenance Alerts */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Maintenance Status
        </h4>
        {vehicleDetails.maintenanceAlerts && vehicleDetails.maintenanceAlerts.length > 0 ? (
          vehicleDetails.maintenanceAlerts.map((alert, idx) => (
            <Alert key={idx} variant={alert.severity === 'high' ? 'destructive' : 'default'}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{alert.description}</AlertDescription>
            </Alert>
          ))
        ) : (
          <div className="flex items-center gap-3 p-4 bg-success/10 border border-success/20 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
            <p className="text-sm font-medium text-success">No maintenance alerts - Vehicle is in excellent condition</p>
          </div>
        )}
      </div>
    </>
  );
}
