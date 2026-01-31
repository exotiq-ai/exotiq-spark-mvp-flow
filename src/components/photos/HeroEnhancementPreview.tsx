import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Image as ImageIcon,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type BackgroundType = 'white' | 'gradient' | 'transparent';

interface HeroEnhancementPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photoId: string;
  photoUrl: string;
  vehicleName: string;
  onEnhanced?: (enhancedUrl: string) => void;
}

export const HeroEnhancementPreview = ({
  open,
  onOpenChange,
  photoId,
  photoUrl,
  vehicleName,
  onEnhanced,
}: HeroEnhancementPreviewProps) => {
  const [background, setBackground] = useState<BackgroundType>('white');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhancedUrl, setEnhancedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(true);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setEnhancedUrl(null);
        setError(null);
        setIsEnhancing(false);
        setBackground('white');
        setShowComparison(true);
      }, 300);
    }
  }, [open]);

  const handleEnhance = async () => {
    setIsEnhancing(true);
    setError(null);
    setEnhancedUrl(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('enhance-hero-photo', {
        body: {
          imageUrl: photoUrl,
          photoId,
          background,
          outputFormat: 'png',
        },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        throw new Error(data.error || 'Enhancement failed');
      }

      setEnhancedUrl(data.enhancedUrl);
    } catch (err) {
      console.error('Enhancement error:', err);
      setError(err instanceof Error ? err.message : 'Failed to enhance photo');
      toast.error('Failed to enhance photo', {
        description: err instanceof Error ? err.message : 'Please try again',
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleSave = async () => {
    if (!enhancedUrl) return;

    setIsEnhancing(true);
    try {
      const { error: updateError } = await supabase
        .from('vehicle_photos')
        .update({
          enhanced_url: enhancedUrl,
          is_enhanced: true,
          enhanced_at: new Date().toISOString(),
          enhancement_settings: { background },
        })
        .eq('id', photoId);

      if (updateError) throw updateError;

      toast.success('Enhanced photo saved!');
      onEnhanced?.(enhancedUrl);
      onOpenChange(false);
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save enhanced photo');
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleReset = () => {
    setEnhancedUrl(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Enhance Hero Photo
          </DialogTitle>
          <DialogDescription>
            AI will remove the background and make your hero photo stand out
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Background Options */}
          {!enhancedUrl && !isEnhancing && (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Choose Background Style</Label>
              <RadioGroup
                value={background}
                onValueChange={(v) => setBackground(v as BackgroundType)}
                className="grid grid-cols-3 gap-3"
              >
                {[
                  { value: 'white', label: 'White', desc: 'Clean professional look' },
                  { value: 'gradient', label: 'Gradient', desc: 'Subtle gray gradient' },
                  { value: 'transparent', label: 'Transparent', desc: 'PNG with no background' },
                ].map((option) => (
                  <Label
                    key={option.value}
                    className={cn(
                      'flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all',
                      background === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-muted-foreground/30'
                    )}
                  >
                    <RadioGroupItem value={option.value} className="sr-only" />
                    <div
                      className={cn(
                        'w-12 h-12 rounded-lg mb-2',
                        option.value === 'white' && 'bg-white border',
                        option.value === 'gradient' && 'bg-gradient-to-br from-gray-100 to-gray-300 border',
                        option.value === 'transparent' && 'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23e5e5e5\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23e5e5e5\'/%3E%3C/svg%3E")] border'
                      )}
                    />
                    <span className="font-medium text-sm">{option.label}</span>
                    <span className="text-xs text-muted-foreground text-center">{option.desc}</span>
                  </Label>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Photo Comparison / Preview */}
          <div className={cn(
            'grid gap-4',
            enhancedUrl ? 'grid-cols-2' : 'grid-cols-1'
          )}>
            {/* Original */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant="outline">Original</Badge>
                {enhancedUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowComparison(!showComparison)}
                  >
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
                <img
                  src={photoUrl}
                  alt={`${vehicleName} - Original`}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Enhanced */}
            {(enhancedUrl || isEnhancing || error) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant="default" className="bg-primary">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Enhanced
                  </Badge>
                  {enhancedUrl && (
                    <Button variant="ghost" size="sm" onClick={handleReset}>
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Try Again
                    </Button>
                  )}
                </div>
                <div
                  className={cn(
                    'relative aspect-video rounded-lg overflow-hidden border',
                    background === 'white' && 'bg-white',
                    background === 'gradient' && 'bg-gradient-to-br from-gray-100 to-gray-300',
                    background === 'transparent' && 'bg-[url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\'%3E%3Crect width=\'8\' height=\'8\' fill=\'%23e5e5e5\'/%3E%3Crect x=\'8\' y=\'8\' width=\'8\' height=\'8\' fill=\'%23e5e5e5\'/%3E%3C/svg%3E")]'
                  )}
                >
                  {isEnhancing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Enhancing with AI...</p>
                      <p className="text-xs text-muted-foreground">This may take 5-10 seconds</p>
                    </div>
                  )}
                  
                  {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                      <AlertCircle className="h-8 w-8 text-destructive" />
                      <p className="text-sm text-destructive text-center">{error}</p>
                      <Button variant="outline" size="sm" onClick={handleEnhance}>
                        Try Again
                      </Button>
                    </div>
                  )}
                  
                  {enhancedUrl && (
                    <motion.img
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      src={enhancedUrl}
                      alt={`${vehicleName} - Enhanced`}
                      className="w-full h-full object-contain"
                      onError={() => {
                        console.error('Failed to load enhanced image:', enhancedUrl);
                        setError('Enhanced image failed to load. Please try again.');
                        setEnhancedUrl(null);
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            {enhancedUrl 
              ? '✓ Original photo will be preserved • You can restore it anytime'
              : 'Powered by PhotoRoom AI • Original photo will be preserved'}
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isEnhancing}>
              Cancel
            </Button>
            
            {!enhancedUrl && !isEnhancing && (
              <Button onClick={handleEnhance}>
                <Sparkles className="h-4 w-4 mr-2" />
                Enhance Photo
              </Button>
            )}
            
            {enhancedUrl && (
              <Button onClick={handleSave} disabled={isEnhancing}>
                {isEnhancing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Save Enhanced Photo
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
