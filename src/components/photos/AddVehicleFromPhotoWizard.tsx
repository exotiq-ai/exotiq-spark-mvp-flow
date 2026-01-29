import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  Car,
  Sparkles,
  Camera,
  Star,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  ImageIcon,
  FolderOpen,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AIAnalysisResult } from './types';
import type { Json } from '@/integrations/supabase/types';

interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
}

interface AddVehicleFromPhotoWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (vehicleId: string) => void;
}

type WizardStep = 'upload' | 'analyzing' | 'details' | 'complete';

interface UploadedPhoto {
  file: File;
  url: string;
  storagePath: string;
  analysis: AIAnalysisResult | null;
}

export const AddVehicleFromPhotoWizard = ({
  open,
  onOpenChange,
  onComplete,
}: AddVehicleFromPhotoWizardProps) => {
  const { user } = useAuth();
  const { currentTeam, locations, selectedLocationId } = useTeam();
  
  // Wizard state
  const [step, setStep] = useState<WizardStep>('upload');
  const [isLoading, setIsLoading] = useState(false);
  
  // Upload state
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Vehicle form state (pre-filled from AI)
  const [vehicleName, setVehicleName] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [color, setColor] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [locationId, setLocationId] = useState('');
  const [setAsHero, setSetAsHero] = useState(true);
  
  // Result state
  const [createdVehicleId, setCreatedVehicleId] = useState<string | null>(null);

  // Auto-set location
  const effectiveLocationId = locationId || (selectedLocationId !== 'all' ? selectedLocationId : locations[0]?.id || '');

  // Reset wizard when closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep('upload');
        setPhotos([]);
        setUploadProgress(0);
        setVehicleName('');
        setMake('');
        setModel('');
        setYear(new Date().getFullYear().toString());
        setColor('');
        setDailyRate('');
        setLocationId('');
        setSetAsHero(true);
        setCreatedVehicleId(null);
        setIsLoading(false);
      }, 300);
    }
  }, [open]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('image/') && f.size <= 50 * 1024 * 1024
    );
    if (droppedFiles.length > 0) {
      handleFilesSelected(droppedFiles);
    }
  }, []);

  // Handle file selection
  const handleFilesSelected = async (files: File[]) => {
    if (!user || files.length === 0) return;
    
    setIsLoading(true);
    setStep('analyzing');
    setUploadProgress(0);

    const uploadedPhotos: UploadedPhoto[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(((i) / files.length) * 50);
      
      try {
        // Upload to storage
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const ext = file.name.split('.').pop();
        const path = `${user.id}/pending-vehicles/${timestamp}-${randomStr}.${ext}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('vehicle-photos')
          .upload(path, file, { cacheControl: '3600' });
        
        if (uploadError) throw uploadError;
        
        // Get signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from('vehicle-photos')
          .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365);
        
        if (signedError || !signedData?.signedUrl) throw new Error('Failed to get URL');
        
        setUploadProgress(((i + 0.5) / files.length) * 50 + 25);
        
        // Analyze with AI
        const { data: analysisData, error: analysisError } = await supabase.functions.invoke(
          'analyze-vehicle-photo',
          { body: { imageUrl: signedData.signedUrl, filename: file.name } }
        );
        
        const analysis = analysisError ? null : analysisData as AIAnalysisResult;
        
        uploadedPhotos.push({
          file,
          url: signedData.signedUrl,
          storagePath: uploadData.path,
          analysis,
        });
        
        setUploadProgress(((i + 1) / files.length) * 100);
      } catch (error) {
        console.error('Failed to upload/analyze:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }
    
    setPhotos(uploadedPhotos);
    
    // Pre-fill form from AI analysis
    if (uploadedPhotos.length > 0) {
      const firstAnalysis = uploadedPhotos.find(p => p.analysis?.suggestedVehicleMatch)?.analysis;
      if (firstAnalysis?.suggestedVehicleMatch) {
        const match = firstAnalysis.suggestedVehicleMatch;
        if (match.make) {
          setMake(match.make);
          setVehicleName(match.make);
        }
        if (match.color) setColor(match.color);
      }
    }
    
    setStep('details');
    setIsLoading(false);
  };

  // Create vehicle and assign photos
  const handleCreateVehicle = async () => {
    if (!user || !vehicleName || !make || !model || !year || !dailyRate) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Create vehicle
      const { data: vehicleData, error: vehicleError } = await supabase
        .from('vehicles')
        .insert({
          user_id: user.id,
          team_id: currentTeam?.id || null,
          location_id: effectiveLocationId || null,
          name: vehicleName,
          make,
          model,
          year: parseInt(year),
          current_rate: parseFloat(dailyRate),
          status: 'available',
          utilization: 0,
          revenue: 0,
        })
        .select()
        .single();
      
      if (vehicleError) throw vehicleError;
      
      // Assign photos to the new vehicle
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const isFirst = i === 0;
        const photoType = (isFirst && setAsHero) ? 'hero' : 'exterior';
        
        const getPhotoType = (angle: string | undefined): string => {
          if (!angle) return 'exterior';
          if (angle === 'interior' || angle.includes('interior')) return 'interior';
          if (angle === 'detail' || angle.includes('detail')) return 'detail';
          if (angle === 'engine') return 'engine';
          return 'exterior';
        };
        
        await supabase
          .from('vehicle_photos')
          .insert({
            vehicle_id: vehicleData.id,
            user_id: user.id,
            team_id: currentTeam?.id || null,
            storage_path: photo.storagePath,
            url: photo.url,
            photo_type: isFirst && setAsHero ? 'hero' : getPhotoType(photo.analysis?.angle),
            detected_angle: photo.analysis?.angle || 'unknown',
            ai_analysis: photo.analysis as unknown as Json,
            is_vehicle_confirmed: photo.analysis?.isVehicle || false,
            quality_score: photo.analysis?.quality?.score || 100,
            quality_issues: photo.analysis?.quality?.issues || [],
            original_filename: photo.file.name,
            file_size_bytes: photo.file.size,
            mime_type: photo.file.type,
            display_order: i,
            analyzed_at: new Date().toISOString(),
          });
      }
      
      setCreatedVehicleId(vehicleData.id);
      setStep('complete');
      
      toast.success('Vehicle created successfully!', {
        description: `${vehicleName} has been added with ${photos.length} photo(s).`,
      });
      
    } catch (error) {
      console.error('Failed to create vehicle:', error);
      toast.error('Failed to create vehicle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    if (createdVehicleId) {
      onComplete?.(createdVehicleId);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Add New Vehicle from Photos
          </DialogTitle>
          <DialogDescription>
            Upload photos and AI will help pre-fill vehicle details
          </DialogDescription>
        </DialogHeader>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          {(['upload', 'analyzing', 'details', 'complete'] as WizardStep[]).map((s, idx) => (
            <div key={s} className="flex items-center gap-2">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                step === s && 'bg-primary text-primary-foreground',
                step !== s && idx < ['upload', 'analyzing', 'details', 'complete'].indexOf(step) && 'bg-success text-success-foreground',
                step !== s && idx > ['upload', 'analyzing', 'details', 'complete'].indexOf(step) && 'bg-muted text-muted-foreground'
              )}>
                {idx < ['upload', 'analyzing', 'details', 'complete'].indexOf(step) ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  idx + 1
                )}
              </div>
              {idx < 3 && <div className="w-8 h-0.5 bg-muted" />}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step 1: Upload */}
            {step === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-12 text-center transition-colors h-full',
                    'hover:border-primary/50 hover:bg-primary/5 cursor-pointer'
                  )}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    id="wizard-photo-upload"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []).filter(f => 
                        f.type.startsWith('image/') && f.size <= 50 * 1024 * 1024
                      );
                      if (files.length > 0) handleFilesSelected(files);
                    }}
                  />
                  <label htmlFor="wizard-photo-upload" className="cursor-pointer flex flex-col items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <FolderOpen className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="text-lg font-medium">Drop vehicle photos here</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        or click to browse • JPG, PNG, WEBP up to 50MB
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span>AI will analyze photos and pre-fill vehicle details</span>
                    </div>
                  </label>
                </div>
              </motion.div>
            )}

            {/* Step 2: Analyzing */}
            {step === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex flex-col items-center justify-center h-64 gap-6"
              >
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-10 w-10 text-primary animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <p className="font-medium">Analyzing photos with AI...</p>
                  <p className="text-sm text-muted-foreground">
                    Detecting vehicle make, color, and photo angles
                  </p>
                </div>
                <div className="w-64 space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    {Math.round(uploadProgress)}% complete
                  </p>
                </div>
              </motion.div>
            )}

            {/* Step 3: Vehicle Details Form */}
            {step === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Photo Preview */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {photos.map((photo, idx) => (
                    <div 
                      key={idx}
                      className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border"
                    >
                      <img 
                        src={photo.url} 
                        alt={`Photo ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      {idx === 0 && setAsHero && (
                        <Badge className="absolute top-1 left-1 text-[8px] px-1 py-0 bg-amber-500">
                          <Star className="h-2 w-2 mr-0.5" />
                          Hero
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {/* AI Detection Badge */}
                {photos.some(p => p.analysis?.suggestedVehicleMatch) && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm">
                      AI detected: {make} {color && `(${color})`}
                    </span>
                  </div>
                )}

                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="vehicleName">Vehicle Name *</Label>
                    <Input
                      id="vehicleName"
                      placeholder="e.g., Ferrari 488 GTB"
                      value={vehicleName}
                      onChange={(e) => setVehicleName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="make">Make *</Label>
                    <Input
                      id="make"
                      placeholder="e.g., Ferrari"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="model">Model *</Label>
                    <Input
                      id="model"
                      placeholder="e.g., 488 GTB"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="year">Year *</Label>
                    <Input
                      id="year"
                      type="number"
                      placeholder="2024"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      required
                      min="1900"
                      max={new Date().getFullYear() + 1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Input
                      id="color"
                      placeholder="e.g., Rosso Corsa"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="dailyRate">Daily Rate ($) *</Label>
                    <Input
                      id="dailyRate"
                      type="number"
                      placeholder="1500"
                      value={dailyRate}
                      onChange={(e) => setDailyRate(e.target.value)}
                      required
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>

                {/* Location Selection */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Location
                  </Label>
                  <Select value={effectiveLocationId} onValueChange={setLocationId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {locations.map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                          {loc.is_default && " (Default)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hero Photo Toggle */}
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/50">
                  <Checkbox
                    id="setAsHero"
                    checked={setAsHero}
                    onCheckedChange={(checked) => setSetAsHero(checked as boolean)}
                  />
                  <label htmlFor="setAsHero" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                    <Star className="h-4 w-4 text-amber-500" />
                    Set first photo as hero photo
                  </label>
                </div>
              </motion.div>
            )}

            {/* Step 4: Complete */}
            {step === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center h-64 gap-6"
              >
                <div className="h-20 w-20 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-10 w-10 text-success" />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-xl font-semibold">Vehicle Added!</p>
                  <p className="text-muted-foreground">
                    {vehicleName} has been added to your fleet with {photos.length} photo(s).
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div>
            {step === 'details' && (
              <Button
                variant="ghost"
                onClick={() => setStep('upload')}
                disabled={isLoading}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {step !== 'complete' && (
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
            )}
            
            {step === 'details' && (
              <Button onClick={handleCreateVehicle} disabled={isLoading || !vehicleName || !make || !model || !dailyRate}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Create Vehicle
                  </>
                )}
              </Button>
            )}
            
            {step === 'complete' && (
              <Button onClick={handleClose}>
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
