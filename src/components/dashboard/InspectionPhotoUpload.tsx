import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Camera,
  Upload,
  X,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { uploadVehiclePhoto, deleteVehiclePhoto } from "@/lib/photoUpload";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

export interface InspectionPhoto {
  id: string;
  file?: File;
  url: string;
  path: string;
  type: PhotoType;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  progress: number;
  error?: string;
}

export type PhotoType = 
  | 'exterior_front'
  | 'exterior_rear'
  | 'exterior_left'
  | 'exterior_right'
  | 'interior_front'
  | 'interior_rear'
  | 'dashboard'
  | 'damage'
  | 'other';

const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  exterior_front: 'Front',
  exterior_rear: 'Rear',
  exterior_left: 'Left Side',
  exterior_right: 'Right Side',
  interior_front: 'Interior Front',
  interior_rear: 'Interior Rear',
  dashboard: 'Dashboard',
  damage: 'Damage',
  other: 'Other',
};

interface InspectionPhotoUploadProps {
  photos: InspectionPhoto[];
  onPhotosChange: (photos: InspectionPhoto[]) => void;
  inspectionId?: string;
  maxPhotos?: number;
}

export const InspectionPhotoUpload = ({
  photos,
  onPhotosChange,
  inspectionId,
  maxPhotos = 8,
}: InspectionPhotoUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedType, setSelectedType] = useState<PhotoType>('exterior_front');

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  }, []);

  const processFiles = useCallback(async (files: FileList) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to upload photos.",
        variant: "destructive",
      });
      return;
    }

    const remainingSlots = maxPhotos - photos.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    if (filesToProcess.length === 0) {
      toast({
        title: "Maximum Photos Reached",
        description: `You can upload up to ${maxPhotos} photos per inspection.`,
        variant: "destructive",
      });
      return;
    }

    // Create pending photo entries
    const newPhotos: InspectionPhoto[] = filesToProcess.map((file, index) => ({
      id: `pending-${Date.now()}-${index}`,
      file,
      url: URL.createObjectURL(file),
      path: '',
      type: selectedType,
      status: 'pending' as const,
      progress: 0,
    }));

    let currentPhotos = [...photos, ...newPhotos];
    onPhotosChange(currentPhotos);

    // Upload each photo
    for (const photo of newPhotos) {
      if (!photo.file) continue;

      // Update status to uploading
      currentPhotos = currentPhotos.map(p => 
        p.id === photo.id ? { ...p, status: 'uploading' as const, progress: 10 } : p
      );
      onPhotosChange(currentPhotos);

      const folder = inspectionId || 'temp';
      const result = await uploadVehiclePhoto(photo.file, folder, user.id);

      if (result.error) {
        currentPhotos = currentPhotos.map(p => 
          p.id === photo.id 
            ? { ...p, status: 'error' as const, error: result.error } 
            : p
        );
      } else {
        currentPhotos = currentPhotos.map(p => 
          p.id === photo.id 
            ? { ...p, status: 'uploaded' as const, progress: 100, url: result.url, path: result.path } 
            : p
        );
      }
      onPhotosChange(currentPhotos);
    }
  }, [user, photos, maxPhotos, selectedType, inspectionId, onPhotosChange, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const handleRemovePhoto = async (photo: InspectionPhoto) => {
    // Delete from storage if uploaded
    if (photo.path && photo.status === 'uploaded') {
      await deleteVehiclePhoto(photo.path);
    }
    
    // Revoke object URL if it's a blob
    if (photo.url.startsWith('blob:')) {
      URL.revokeObjectURL(photo.url);
    }

    onPhotosChange(photos.filter(p => p.id !== photo.id));
  };

  const updatePhotoType = (photoId: string, newType: PhotoType) => {
    onPhotosChange(
      photos.map(p => p.id === photoId ? { ...p, type: newType } : p)
    );
  };

  const uploadedCount = photos.filter(p => p.status === 'uploaded').length;
  const pendingCount = photos.filter(p => p.status === 'uploading').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Inspection Photos</h4>
          <p className="text-sm text-muted-foreground">
            {uploadedCount}/{maxPhotos} photos • {pendingCount > 0 && `${pendingCount} uploading...`}
          </p>
        </div>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as PhotoType)}
          className="text-sm border rounded-md px-2 py-1 bg-background"
        >
          {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer
          ${isDragActive 
            ? 'border-primary bg-primary/5' 
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }
          ${photos.length >= maxPhotos ? 'opacity-50 pointer-events-none' : ''}
        `}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="flex flex-col items-center gap-2">
          {isDragActive ? (
            <>
              <Upload className="h-8 w-8 text-primary animate-bounce" />
              <p className="text-primary font-medium">Drop photos here</p>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <Camera className="h-6 w-6 text-muted-foreground" />
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Drag & drop photos or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG, WEBP, HEIC • Max 5MB each
              </p>
            </>
          )}
        </div>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square rounded-lg overflow-hidden border bg-muted/30 group"
            >
              <img
                src={photo.url}
                alt={PHOTO_TYPE_LABELS[photo.type]}
                className="w-full h-full object-cover"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemovePhoto(photo);
                  }}
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Status Badge */}
              <div className="absolute top-2 left-2">
                {photo.status === 'uploading' && (
                  <Badge variant="secondary" className="text-xs">
                    <div className="animate-spin h-3 w-3 border-2 border-primary border-t-transparent rounded-full mr-1" />
                    Uploading
                  </Badge>
                )}
                {photo.status === 'uploaded' && (
                  <Badge className="bg-success/90 text-success-foreground text-xs">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Uploaded
                  </Badge>
                )}
                {photo.status === 'error' && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Error
                  </Badge>
                )}
              </div>

              {/* Type Badge */}
              <div className="absolute bottom-2 left-2 right-2">
                <select
                  value={photo.type}
                  onChange={(e) => updatePhotoType(photo.id, e.target.value as PhotoType)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full text-xs bg-black/60 text-white border-0 rounded px-2 py-1"
                >
                  {Object.entries(PHOTO_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Upload Progress */}
              {photo.status === 'uploading' && (
                <div className="absolute bottom-0 left-0 right-0">
                  <Progress value={photo.progress} className="h-1 rounded-none" />
                </div>
              )}
            </div>
          ))}

          {/* Add More Placeholder */}
          {photos.length < maxPhotos && (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors hover:bg-muted/30"
            >
              <ImageIcon className="h-6 w-6 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Add Photo</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
