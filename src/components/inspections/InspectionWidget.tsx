import { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ClipboardCheck,
  Camera,
  ArrowRight,
  Check,
  AlertCircle,
} from 'lucide-react';
import { GuidedCaptureWizard } from './GuidedCaptureWizard';
import { InspectionChecklistForm } from './InspectionChecklistForm';
import {
  GuidedPhoto,
  DamageItem,
  InspectionChecklist,
  InspectionDirection,
  GUIDED_PHOTO_CONFIG,
} from './types';

interface InspectionWidgetProps {
  vehicleId: string;
  vehicleName: string;
  bookingId?: string;
  direction: InspectionDirection;
  onComplete?: () => void;
}

type WizardStep = 'start' | 'capture' | 'checklist' | 'complete';

export const InspectionWidget = ({
  vehicleId,
  vehicleName,
  bookingId,
  direction,
  onComplete,
}: InspectionWidgetProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>('start');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize photos from config
  const initialPhotos: GuidedPhoto[] = useMemo(() => 
    GUIDED_PHOTO_CONFIG.map((config, index) => ({
      ...config,
      id: `photo-${index}`,
      skipped: false,
      qualityWarning: false,
    })), 
  []);

  const [photos, setPhotos] = useState<GuidedPhoto[]>(initialPhotos);
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
  const [inspectorName, setInspectorName] = useState('');
  const [notes, setNotes] = useState('');
  const [checklist, setChecklist] = useState<InspectionChecklist>({
    odometerReading: null,
    fuelLevel: 100,
    keysCount: 1,
    cleanlinessRating: 5,
    exteriorCondition: 'excellent',
    interiorCondition: 'excellent',
    tireCondition: 'good',
  });

  // Reset state when dialog closes
  const handleClose = useCallback(() => {
    setIsOpen(false);
    setStep('start');
    setPhotos(initialPhotos);
    setDamageItems([]);
    setInspectorName('');
    setNotes('');
    setChecklist({
      odometerReading: null,
      fuelLevel: 100,
      keysCount: 1,
      cleanlinessRating: 5,
      exteriorCondition: 'excellent',
      interiorCondition: 'excellent',
      tireCondition: 'good',
    });
  }, [initialPhotos]);

  // Photo capture handler
  const handlePhotoCapture = useCallback((photoId: string, imageData: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === photoId 
        ? { ...p, url: imageData, skipped: false, capturedAt: new Date() }
        : p
    ));
  }, []);

  // Photo skip handler
  const handlePhotoSkip = useCallback((photoId: string) => {
    setPhotos(prev => prev.map(p => 
      p.id === photoId 
        ? { ...p, skipped: true }
        : p
    ));
  }, []);

  // Damage handlers
  const handleDamageAdd = useCallback((damage: Omit<DamageItem, 'id'>) => {
    const newDamage: DamageItem = {
      ...damage,
      id: `damage-${Date.now()}`,
    };
    setDamageItems(prev => [...prev, newDamage]);
  }, []);

  const handleDamageRemove = useCallback((damageId: string) => {
    setDamageItems(prev => prev.filter(d => d.id !== damageId));
  }, []);

  // Upload photo to storage
  const uploadPhoto = async (
    imageData: string, 
    folder: string, 
    filename: string
  ): Promise<string | null> => {
    try {
      // Convert base64 to blob
      const response = await fetch(imageData);
      const blob = await response.blob();

      const filePath = `${folder}/${filename}`;
      
      const { data, error } = await supabase.storage
        .from('vehicle-photos')
        .upload(filePath, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (error) throw error;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('vehicle-photos')
        .getPublicUrl(filePath);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      return null;
    }
  };

  // Submit inspection
  const handleSubmit = async () => {
    if (!user?.id || checklist.odometerReading === null) return;

    setIsSubmitting(true);

    try {
      const inspectionId = crypto.randomUUID();
      const timestamp = Date.now();
      const photoFolder = `${user.id}/${inspectionId}`;

      // Upload all captured photos
      const uploadedPhotos = await Promise.all(
        photos
          .filter(p => p.url && !p.skipped)
          .map(async (photo) => {
            const url = await uploadPhoto(
              photo.url!,
              photoFolder,
              `${photo.role}-${timestamp}.jpg`
            );
            return { ...photo, uploadedUrl: url };
          })
      );

      // Upload damage photos
      const uploadedDamage = await Promise.all(
        damageItems.map(async (damage, index) => {
          const url = await uploadPhoto(
            damage.photoUrl,
            photoFolder,
            `damage-${index}-${timestamp}.jpg`
          );
          return { ...damage, uploadedUrl: url };
        })
      );

      // Create inspection record
      const { error: inspectionError } = await supabase
        .from('vehicle_inspections')
        .insert({
          id: inspectionId,
          user_id: user.id,
          vehicle_id: vehicleId,
          booking_id: bookingId || null,
          inspection_type: direction === 'check_in' ? 'pre_rental' : 'post_rental',
          inspector_name: inspectorName,
          odometer_reading: checklist.odometerReading,
          fuel_level: checklist.fuelLevel,
          exterior_condition: checklist.exteriorCondition,
          interior_condition: checklist.interiorCondition,
          tire_condition: checklist.tireCondition,
          notes: notes || null,
          inspection_direction: direction,
          status: 'completed',
          keys_count: checklist.keysCount,
          cleanliness_rating: checklist.cleanlinessRating,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });

      if (inspectionError) throw inspectionError;

      // Insert inspection photos
      const photoRecords = uploadedPhotos
        .filter(p => p.uploadedUrl)
        .map(p => ({
          inspection_id: inspectionId,
          photo_url: p.uploadedUrl!,
          photo_type: p.label,
          photo_role: p.role,
          skipped: false,
          captured_at: p.capturedAt?.toISOString() || new Date().toISOString(),
        }));

      if (photoRecords.length > 0) {
        const { error: photosError } = await supabase
          .from('inspection_photos')
          .insert(photoRecords);

        if (photosError) console.error('Error inserting photos:', photosError);
      }

      // Insert damage items
      const damageRecords = uploadedDamage
        .filter(d => d.uploadedUrl)
        .map(d => ({
          inspection_id: inspectionId,
          photo_url: d.uploadedUrl!,
          damage_type: d.damageType,
          vehicle_location: d.vehicleLocation,
          severity: d.severity,
          notes: d.notes || null,
          quality_warning: d.qualityWarning,
        }));

      if (damageRecords.length > 0) {
        const { error: damageError } = await supabase
          .from('inspection_damage_items')
          .insert(damageRecords);

        if (damageError) console.error('Error inserting damage items:', damageError);
      }

      toast({
        title: 'Inspection Complete',
        description: `${direction === 'check_in' ? 'Check-in' : 'Check-out'} inspection saved successfully.`,
      });

      setStep('complete');
      
      if (onComplete) {
        setTimeout(() => {
          onComplete();
          handleClose();
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting inspection:', error);
      toast({
        title: 'Error',
        description: 'Failed to save inspection. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const capturedCount = photos.filter(p => p.url).length;
  const skippedCount = photos.filter(p => p.skipped).length;

  return (
    <>
      {/* Trigger Button */}
      <Card 
        className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setIsOpen(true)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <ClipboardCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium">
                {direction === 'check_in' ? 'Check-In' : 'Check-Out'} Inspection
              </h4>
              <p className="text-sm text-muted-foreground">
                Guided photo capture with checklist
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm">
            Start <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </Card>

      {/* Full Screen Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-full h-[100dvh] max-h-[100dvh] p-0 gap-0 rounded-none sm:rounded-lg sm:max-w-lg sm:h-auto sm:max-h-[85vh]">
          {step === 'start' && (
            <div className="flex flex-col h-full">
              <DialogHeader className="p-4 border-b">
                <DialogTitle>
                  {direction === 'check_in' ? 'Check-In' : 'Check-Out'} Inspection
                </DialogTitle>
              </DialogHeader>
              
              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                <div className="p-4 rounded-full bg-primary/10 mb-4">
                  <Camera className="h-12 w-12 text-primary" />
                </div>
                <h2 className="text-xl font-semibold mb-2">{vehicleName}</h2>
                <p className="text-muted-foreground mb-6 max-w-xs">
                  You'll be guided through capturing {photos.length} photos of the vehicle, 
                  then complete a quick checklist.
                </p>
                
                <div className="space-y-2 text-sm text-left w-full max-w-xs">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>{photos.length} guided photo angles</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Unlimited damage documentation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    <span>Quick condition checklist</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t space-y-2">
                <Button 
                  onClick={() => setStep('capture')} 
                  className="w-full btn-premium"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Start Inspection
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleClose}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {step === 'capture' && (
            <GuidedCaptureWizard
              photos={photos}
              damageItems={damageItems}
              onPhotoCapture={handlePhotoCapture}
              onPhotoSkip={handlePhotoSkip}
              onDamageAdd={handleDamageAdd}
              onDamageRemove={handleDamageRemove}
              onComplete={() => setStep('checklist')}
              onBack={() => setStep('start')}
              vehicleName={vehicleName}
              direction={direction}
            />
          )}

          {step === 'checklist' && (
            <InspectionChecklistForm
              checklist={checklist}
              inspectorName={inspectorName}
              notes={notes}
              onChecklistChange={setChecklist}
              onInspectorNameChange={setInspectorName}
              onNotesChange={setNotes}
              onComplete={handleSubmit}
              onBack={() => setStep('capture')}
              isSubmitting={isSubmitting}
            />
          )}

          {step === 'complete' && (
            <div className="flex flex-col h-full items-center justify-center p-6 text-center">
              <div className="p-4 rounded-full bg-green-500/10 mb-4">
                <Check className="h-12 w-12 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Inspection Complete!</h2>
              <p className="text-muted-foreground mb-4">
                The {direction === 'check_in' ? 'check-in' : 'check-out'} inspection 
                has been saved successfully.
              </p>
              <div className="flex gap-2">
                <Badge variant="outline">
                  {capturedCount} photos
                </Badge>
                {damageItems.length > 0 && (
                  <Badge variant="outline" className="border-red-500/50 text-red-600">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {damageItems.length} damage items
                  </Badge>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
