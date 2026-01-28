import { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Camera, SkipForward, AlertTriangle, Volume2 } from 'lucide-react';

interface CameraViewfinderProps {
  instruction: string;
  photoLabel: string;
  onCapture: (imageData: string) => void;
  onSkip?: () => void;
  canSkip?: boolean;
  showBranding?: boolean;
  className?: string;
}

export const CameraViewfinder = ({
  instruction,
  photoLabel,
  onCapture,
  onSkip,
  canSkip = true,
  showBranding = true,
  className,
}: CameraViewfinderProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [flashActive, setFlashActive] = useState(false);

  // Initialize camera
  useEffect(() => {
    const initCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Prefer back camera
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
        setStream(mediaStream);
        setError(null);
      } catch (err) {
        console.error('Camera access error:', err);
        setError('Unable to access camera. Please grant camera permissions.');
      }
    };

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Haptic feedback helper
  const triggerHaptic = useCallback((pattern: 'light' | 'medium' | 'heavy' = 'medium') => {
    if ('vibrate' in navigator) {
      const patterns = {
        light: [10],
        medium: [30],
        heavy: [50, 30, 50],
      };
      navigator.vibrate(patterns[pattern]);
    }
  }, []);

  // Capture photo
  const handleCapture = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);
    triggerHaptic('medium');
    
    // Flash effect
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 150);

    // Play shutter sound
    const audio = new Audio('/sounds/shutter.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {}); // Ignore audio errors

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) {
      setIsCapturing(false);
      return;
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const imageData = canvas.toDataURL('image/jpeg', 0.85);
    
    // Small delay for visual feedback
    setTimeout(() => {
      onCapture(imageData);
      setIsCapturing(false);
    }, 200);
  }, [isCapturing, onCapture, triggerHaptic]);

  // Handle skip
  const handleSkip = useCallback(() => {
    if (onSkip) {
      triggerHaptic('light');
      onSkip();
    }
  }, [onSkip, triggerHaptic]);

  if (error) {
    return (
      <div className={cn('flex flex-col items-center justify-center bg-black min-h-[60vh] rounded-lg', className)}>
        <AlertTriangle className="h-12 w-12 text-yellow-500 mb-4" />
        <p className="text-white text-center px-4">{error}</p>
        <Button 
          variant="outline" 
          className="mt-4"
          onClick={() => window.location.reload()}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('relative bg-black rounded-lg overflow-hidden', className)}>
      {/* Video Feed */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-cover"
      />
      
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Flash overlay */}
      {flashActive && (
        <div className="absolute inset-0 bg-white animate-pulse z-20" />
      )}

      {/* Corner Brackets Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {/* Top Left */}
        <div className="absolute top-8 left-8">
          <div className="w-12 h-12 border-l-2 border-t-2 border-white/80" />
        </div>
        {/* Top Right */}
        <div className="absolute top-8 right-8">
          <div className="w-12 h-12 border-r-2 border-t-2 border-white/80" />
        </div>
        {/* Bottom Left */}
        <div className="absolute bottom-32 left-8">
          <div className="w-12 h-12 border-l-2 border-b-2 border-white/80" />
        </div>
        {/* Bottom Right */}
        <div className="absolute bottom-32 right-8">
          <div className="w-12 h-12 border-r-2 border-b-2 border-white/80" />
        </div>
      </div>

      {/* Top Instruction Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent z-10">
        <div className="text-center">
          <h3 className="text-white font-semibold text-lg">{photoLabel}</h3>
          <p className="text-white/80 text-sm mt-1">{instruction}</p>
        </div>
      </div>

      {/* EQ Logo Branding */}
      {showBranding && (
        <div className="absolute bottom-32 right-4 z-10 opacity-70">
          <img 
            src="/brand/logos/svg/d-emblem-white-transparent.svg" 
            alt="EQ" 
            className="h-8 w-8"
          />
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
        <div className="flex items-center justify-center gap-4">
          {/* Skip Button */}
          {canSkip && onSkip && (
            <Button
              variant="ghost"
              size="lg"
              onClick={handleSkip}
              className="text-white hover:bg-white/20"
            >
              <SkipForward className="h-5 w-5 mr-2" />
              Skip
            </Button>
          )}

          {/* Capture Button */}
          <Button
            size="lg"
            onClick={handleCapture}
            disabled={isCapturing}
            className={cn(
              'w-20 h-20 rounded-full bg-white hover:bg-white/90 transition-all',
              isCapturing && 'scale-95 opacity-80'
            )}
          >
            <div className="w-16 h-16 rounded-full border-4 border-black/20 flex items-center justify-center">
              <Camera className="h-8 w-8 text-black" />
            </div>
          </Button>

          {/* Spacer for symmetry when skip is shown */}
          {canSkip && onSkip && <div className="w-24" />}
        </div>
      </div>
    </div>
  );
};
