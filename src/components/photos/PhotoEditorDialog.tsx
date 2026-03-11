import { useState, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { RotateCw, RotateCcw, Crop, Sun, Contrast, Palette, Loader2 } from 'lucide-react';
import { applyEdits, type ImageEditParams } from '@/lib/imageCompression';
import { toast } from 'sonner';
import type { VehiclePhoto } from './types';

interface PhotoEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing DB photo — or use imageUrl+filename for local files */
  photo?: VehiclePhoto;
  imageUrl?: string;
  filename?: string;
  onSave: (editedFile: File) => Promise<void>;
}

type AspectOption = 'free' | '16:9' | '4:3' | '1:1';

const ASPECT_VALUES: Record<AspectOption, number | undefined> = {
  free: undefined,
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
};

export function PhotoEditorDialog({ open, onOpenChange, photo, imageUrl, filename, onSave }: PhotoEditorDialogProps) {
  const resolvedUrl = photo?.url ?? imageUrl ?? '';
  const resolvedFilename = photo?.original_filename ?? filename ?? 'edited-photo';
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [aspect, setAspect] = useState<AspectOption>('free');
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setAspect('free');
  };

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setSaving(true);
    try {
      const params: ImageEditParams = {
        cropArea: croppedAreaPixels,
        rotation,
        brightness,
        contrast,
        saturation,
      };
      const editedFile = await applyEdits(
        resolvedUrl,
        params,
        resolvedFilename
      );
      await onSave(editedFile);
      onOpenChange(false);
      handleReset();
      toast.success('Photo updated');
    } catch (error) {
      console.error('Photo edit failed:', error);
      toast.error('Failed to apply edits');
    } finally {
      setSaving(false);
    }
  };

  // CSS filter for live preview
  const previewFilter = [
    brightness !== 100 ? `brightness(${brightness / 100})` : '',
    contrast !== 100 ? `contrast(${contrast / 100})` : '',
    saturation !== 100 ? `saturate(${saturation / 100})` : '',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-2">
            <Crop className="h-5 w-5" />
            Edit Photo
          </DialogTitle>
        </DialogHeader>

        {/* Crop Area */}
        <div className="relative w-full h-[340px] bg-black">
          <Cropper
            image={resolvedUrl}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={ASPECT_VALUES[aspect]}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              mediaStyle: { filter: previewFilter },
            }}
          />
        </div>

        {/* Controls */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {/* Aspect Ratio + Rotate */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
              <ToggleGroup
                type="single"
                value={aspect}
                onValueChange={(v) => v && setAspect(v as AspectOption)}
                className="gap-1"
              >
                {(['free', '16:9', '4:3', '1:1'] as const).map((opt) => (
                  <ToggleGroupItem key={opt} value={opt} size="sm" className="text-xs px-2.5">
                    {opt === 'free' ? 'Free' : opt}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setRotation((r) => r - 90)}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                onClick={() => setRotation((r) => r + 90)}
              >
                <RotateCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Adjustments */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5" /> Brightness
              </Label>
              <Slider
                value={[brightness]}
                onValueChange={([v]) => setBrightness(v)}
                min={50}
                max={150}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Contrast className="h-3.5 w-3.5" /> Contrast
              </Label>
              <Slider
                value={[contrast]}
                onValueChange={([v]) => setContrast(v)}
                min={50}
                max={150}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5" /> Saturation
              </Label>
              <Slider
                value={[saturation]}
                onValueChange={([v]) => setSaturation(v)}
                min={50}
                max={150}
                step={1}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="px-6 pb-6 pt-2 flex-row justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Reset
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Applying…
                </>
              ) : (
                'Apply Changes'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
