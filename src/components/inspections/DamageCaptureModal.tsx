import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CameraViewfinder } from './CameraViewfinder';
import {
  DamageItem,
  DamageType,
  VehicleLocation,
  DamageSeverity,
  DAMAGE_TYPE_LABELS,
  VEHICLE_LOCATION_LABELS,
  SEVERITY_CONFIG,
} from './types';
import { ChevronLeft, Check, Camera } from 'lucide-react';

interface DamageCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (damage: Omit<DamageItem, 'id'>) => void;
}

type Step = 'capture' | 'details';

export const DamageCaptureModal = ({
  open,
  onClose,
  onCapture,
}: DamageCaptureModalProps) => {
  const [step, setStep] = useState<Step>('capture');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [damageType, setDamageType] = useState<DamageType>('scratch');
  const [vehicleLocation, setVehicleLocation] = useState<VehicleLocation>('front_bumper');
  const [severity, setSeverity] = useState<DamageSeverity>('minor');
  const [notes, setNotes] = useState('');

  const resetForm = useCallback(() => {
    setStep('capture');
    setPhotoUrl(null);
    setDamageType('scratch');
    setVehicleLocation('front_bumper');
    setSeverity('minor');
    setNotes('');
  }, []);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const handleCapture = useCallback((imageData: string) => {
    setPhotoUrl(imageData);
    setStep('details');
  }, []);

  const handleSubmit = useCallback(() => {
    if (!photoUrl) return;

    onCapture({
      photoUrl,
      damageType,
      vehicleLocation,
      severity,
      notes: notes.trim() || undefined,
      qualityWarning: false,
    });

    resetForm();
  }, [photoUrl, damageType, vehicleLocation, severity, notes, onCapture, resetForm]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-md p-0 gap-0 max-h-[85vh] overflow-hidden flex flex-col">
        {step === 'capture' && (
          <>
            <DialogHeader className="p-4 border-b">
              <DialogTitle>Capture Damage Photo</DialogTitle>
              <DialogDescription className="sr-only">Take a photo of the vehicle damage</DialogDescription>
            </DialogHeader>
            <div className="h-[60vh]">
              <CameraViewfinder
                instruction="Take a clear, close-up photo of the damage"
                photoLabel="Damage Photo"
                onCapture={handleCapture}
                canSkip={false}
                showBranding={false}
                className="h-full"
              />
            </div>
            <div className="p-4 border-t">
              <Button variant="outline" onClick={handleClose} className="w-full">
                Cancel
              </Button>
            </div>
          </>
        )}

        {step === 'details' && (
          <>
            <DialogHeader className="p-4 border-b">
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('capture')}
                  className="-ml-2"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Retake
                </Button>
                <DialogTitle className="flex-1 text-center pr-16">
                  Damage Details
                </DialogTitle>
                <DialogDescription className="sr-only">Describe the damage type, location, and severity</DialogDescription>
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-auto p-4 space-y-4 min-h-0">
              {/* Photo Preview */}
              {photoUrl && (
                <div className="relative rounded-lg overflow-hidden">
                  <img
                    src={photoUrl}
                    alt="Damage"
                    className="w-full max-h-32 object-cover"
                  />
                  <button
                    onClick={() => setStep('capture')}
                    className="absolute bottom-2 right-2 bg-black/60 text-white px-3 py-1.5 rounded-md text-sm flex items-center"
                  >
                    <Camera className="h-4 w-4 mr-1" />
                    Retake
                  </button>
                </div>
              )}

              {/* Damage Type */}
              <div className="space-y-2">
                <Label>Damage Type *</Label>
                <Select value={damageType} onValueChange={(v) => setDamageType(v as DamageType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DAMAGE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Vehicle Location */}
              <div className="space-y-2">
                <Label>Location on Vehicle *</Label>
                <Select value={vehicleLocation} onValueChange={(v) => setVehicleLocation(v as VehicleLocation)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {Object.entries(VEHICLE_LOCATION_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Severity */}
              <div className="space-y-2">
                <Label>Severity *</Label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                    <Button
                      key={value}
                      type="button"
                      variant={severity === value ? 'default' : 'outline'}
                      onClick={() => setSeverity(value as DamageSeverity)}
                      className={severity === value ? config.color : ''}
                    >
                      {config.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Additional Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Describe the damage in more detail..."
                  className="h-20"
                />
              </div>
            </div>

            <div className="p-4 border-t space-y-2 flex-shrink-0">
              <Button onClick={handleSubmit} className="w-full btn-premium">
                <Check className="h-4 w-4 mr-2" />
                Add Damage
              </Button>
              <Button variant="outline" onClick={handleClose} className="w-full">
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
