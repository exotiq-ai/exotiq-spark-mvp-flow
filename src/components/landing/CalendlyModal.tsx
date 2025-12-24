import { useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CalendlyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CalendlyModal = ({ open, onOpenChange }: CalendlyModalProps) => {
  useEffect(() => {
    if (open) {
      // Load Calendly widget script
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Schedule a Demo</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden p-6 pt-0">
          <div
            className="calendly-inline-widget w-full h-full min-h-[500px]"
            data-url="https://calendly.com/hello-exotiq/30min?hide_gdpr_banner=1"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
