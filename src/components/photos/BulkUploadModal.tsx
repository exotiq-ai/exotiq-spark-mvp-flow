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
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon,
  Car,
  FolderOpen,
  Sparkles,
  Zap,
  Link,
  HelpCircle,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { usePhotoAnalysis } from './usePhotoAnalysis';
import { toast } from 'sonner';
import type { PhotoUploadProgress } from './types';
import { uploadMetrics, formatBytes } from '@/lib/uploadMetrics';

interface Vehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  color?: string;
}

interface BulkUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicles: Vehicle[];
  preSelectedVehicleId?: string;
  onComplete?: (results: PhotoUploadProgress[]) => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <ImageIcon className="h-4 w-4 text-muted-foreground" />,
  preprocessing: <Zap className="h-4 w-4 animate-pulse text-amber-500" />,
  uploading: <Loader2 className="h-4 w-4 animate-spin text-primary" />,
  matching: <Link className="h-4 w-4 animate-pulse text-blue-500" />,
  analyzing: <Sparkles className="h-4 w-4 animate-pulse text-amber-500" />,
  complete: <CheckCircle2 className="h-4 w-4 text-success" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  preprocessing: 'Compressing...',
  uploading: 'Uploading...',
  matching: 'Matching...',
  analyzing: 'AI Analyzing...',
  complete: 'Complete',
  error: 'Failed',
};

const MATCH_BADGES: Record<string, { label: string; className: string }> = {
  'auto-matched': { label: 'Auto-matched', className: 'border-success/50 text-success' },
  'suggested': { label: 'Suggested', className: 'border-amber-500/50 text-amber-600' },
  'unmatched': { label: 'Review needed', className: 'border-muted-foreground/30 text-muted-foreground' },
  'skipped': { label: 'Assigned', className: 'border-primary/50 text-primary' },
};

export const BulkUploadModal = ({
  open,
  onOpenChange,
  vehicles,
  preSelectedVehicleId,
  onComplete,
}: BulkUploadModalProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(preSelectedVehicleId || 'auto-detect');
  const [uploadProgress, setUploadProgress] = useState<PhotoUploadProgress[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [skipAnalysis, setSkipAnalysis] = useState(true); // Default to skip for faster uploads

  // Sync preSelectedVehicleId when it changes
  useEffect(() => {
    setSelectedVehicleId(preSelectedVehicleId || 'auto-detect');
  }, [preSelectedVehicleId]);

  const { isProcessing, processBatch } = usePhotoAnalysis({
    onProgress: setUploadProgress,
    onComplete: (results) => {
      setIsComplete(true);
      onComplete?.(results);
    },
  });

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => {
      // Block HEIC files - browsers can't display them
      if (f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif')) {
        toast.warning(`${f.name}: HEIC format not supported. Please convert to JPEG first.`);
        return false;
      }
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_FILE_SIZE) {
        console.warn(`${f.name} exceeds 50MB limit and was not added`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter(f => {
      // Block HEIC files - browsers can't display them
      if (f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif')) {
        toast.warning(`${f.name}: HEIC format not supported. Please convert to JPEG first.`);
        return false;
      }
      if (!f.type.startsWith('image/')) return false;
      if (f.size > MAX_FILE_SIZE) {
        console.warn(`${f.name} exceeds 50MB limit and was not added`);
        return false;
      }
      return true;
    });
    setFiles(prev => [...prev, ...selectedFiles]);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleStartUpload = async () => {
    if (files.length === 0) return;
    
    // Reset session metrics for this batch
    uploadMetrics.reset();
    
    // Convert 'auto-detect' placeholder back to undefined
    const vehicleId = selectedVehicleId === 'auto-detect' ? undefined : selectedVehicleId;
    await processBatch(files, vehicleId, { skipAnalysis, vehicles });
  };

  const handleClose = () => {
    if (isProcessing) return;
    setFiles([]);
    setUploadProgress([]);
    setIsComplete(false);
    setSelectedVehicleId('auto-detect');
    onOpenChange(false);
  };

  const completedCount = uploadProgress.filter(p => p.status === 'complete').length;
  const errorCount = uploadProgress.filter(p => p.status === 'error').length;
  const matchedCount = uploadProgress.filter(p => p.result?.vehicleId).length;
  const unmatchedCount = completedCount - matchedCount;
  const overallProgress = uploadProgress.length > 0
    ? Math.round(uploadProgress.reduce((sum, p) => sum + p.progress, 0) / uploadProgress.length)
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Bulk Photo Upload
          </DialogTitle>
          <DialogDescription>
            Upload multiple photos at once. AI will analyze each photo to detect vehicle angles and quality.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Vehicle Selection */}
          {!isProcessing && !isComplete && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Assign to vehicle (optional)
              </label>
              <Select value={selectedVehicleId} onValueChange={setSelectedVehicleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Auto-detect or select a vehicle..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto-detect">
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" />
                      Auto-detect (AI matching)
                    </span>
                  </SelectItem>
                  {vehicles.map(vehicle => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      <span className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        {vehicle.name}
                        {vehicle.year && (
                          <span className="text-muted-foreground">
                            ({vehicle.year} {vehicle.make})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Drop Zone or Progress */}
          {!isProcessing && !isComplete ? (
            <>
              {/* Drop Zone */}
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
                  'hover:border-primary/50 hover:bg-primary/5',
                  files.length > 0 && 'border-primary/30 bg-primary/5'
                )}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
              >
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  id="photo-upload"
                  onChange={handleFileSelect}
                />
                <label 
                  htmlFor="photo-upload" 
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <FolderOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Drop photos here or click to browse</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Supports JPG, PNG, WEBP • Max 50MB per file
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ HEIC files (iPhone) not supported - please convert to JPEG
                    </p>
                  </div>
                </label>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {files.length} photo{files.length !== 1 ? 's' : ''} selected
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setFiles([])}
                    >
                      Clear all
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px] border rounded-lg p-2">
                    <div className="space-y-2">
                      {files.map((file, index) => (
                        <div
                          key={`${file.name}-${index}`}
                          className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                        >
                          <ImageIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => handleRemoveFile(index)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Upload Progress */}
              <div className="space-y-4">
                {/* Overall Progress */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                      {isComplete ? 'Upload Complete' : 'Processing photos...'}
                    </span>
                    <span className="text-muted-foreground">{overallProgress}%</span>
                  </div>
                  <Progress value={overallProgress} className="h-2" />
                </div>

                {/* Summary Stats */}
                {isComplete && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-3 gap-3"
                  >
                    <div className="p-3 rounded-lg bg-success/10 border border-success/20 text-center">
                      <p className="text-2xl font-bold text-success">{matchedCount}</p>
                      <p className="text-xs text-success">Matched</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                      <p className="text-2xl font-bold text-amber-600">{unmatchedCount}</p>
                      <p className="text-xs text-amber-600">Review Queue</p>
                    </div>
                    {errorCount > 0 && (
                      <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                        <p className="text-2xl font-bold text-destructive">{errorCount}</p>
                        <p className="text-xs text-destructive">Failed</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Individual File Progress */}
                <ScrollArea className="h-[250px] border rounded-lg p-2">
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {uploadProgress.map((item, index) => (
                        <motion.div
                          key={`${item.file.name}-${index}`}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 p-2 rounded-md bg-muted/50"
                        >
                          {STATUS_ICONS[item.status]}
                          <span className="text-sm truncate flex-1">
                            {item.file.name}
                          </span>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              'text-xs',
                              item.status === 'complete' && 'border-success/50 text-success',
                              item.status === 'error' && 'border-destructive/50 text-destructive'
                            )}
                          >
                            {STATUS_LABELS[item.status]}
                          </Badge>
                          {item.result?.analysis && (
                            <Badge variant="secondary" className="text-xs">
                              {item.result.analysis.angle?.replace('_', ' ')}
                            </Badge>
                          )}
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          {!isProcessing && !isComplete ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                onClick={handleStartUpload}
                disabled={files.length === 0}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload {files.length} Photo{files.length !== 1 ? 's' : ''}
              </Button>
            </>
          ) : isComplete ? (
            <>
              {unmatchedCount > 0 && (
                <Button variant="outline" onClick={handleClose}>
                  Review Queue ({unmatchedCount})
                </Button>
              )}
              <Button onClick={handleClose}>
                Done
              </Button>
            </>
          ) : (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
