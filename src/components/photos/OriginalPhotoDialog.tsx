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
import { RotateCcw, Sparkles, X } from 'lucide-react';

interface OriginalPhotoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalUrl: string;
  enhancedUrl: string;
  vehicleName: string;
  onRestoreOriginal: () => void;
  isRestoring?: boolean;
}

export function OriginalPhotoDialog({
  open,
  onOpenChange,
  originalUrl,
  enhancedUrl,
  vehicleName,
  onRestoreOriginal,
  isRestoring,
}: OriginalPhotoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compare Photos</DialogTitle>
          <DialogDescription>
            Your original photo is preserved. You can restore it at any time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Original */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge variant="outline">Original</Badge>
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
              <img
                src={originalUrl}
                alt={`${vehicleName} - Original`}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Enhanced */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Badge className="bg-primary gap-1">
                <Sparkles className="h-3 w-3" />
                Enhanced (Current)
              </Badge>
            </div>
            <div className="relative aspect-video rounded-lg overflow-hidden bg-muted border">
              <img
                src={enhancedUrl}
                alt={`${vehicleName} - Enhanced`}
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between pt-4 border-t">
          <p className="text-xs text-muted-foreground">
            Original photo is safely preserved
          </p>
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={onRestoreOriginal}
              disabled={isRestoring}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              {isRestoring ? 'Restoring...' : 'Restore Original'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
