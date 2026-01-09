import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogOverlay,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { 
  X, 
  Play, 
  Pause, 
  Sparkles,
  ChevronRight,
  Volume2,
  VolumeX 
} from 'lucide-react';

interface WelcomeVideoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
  onStartTour: () => void;
  videoUrl?: string;
  posterUrl?: string;
}

export const WelcomeVideoModal = ({
  open,
  onOpenChange,
  onComplete,
  onStartTour,
  videoUrl = '/videos/welcome-tour.mp4',
  posterUrl,
}: WelcomeVideoModalProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [videoError, setVideoError] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-hide controls after 3 seconds of playback
  useEffect(() => {
    if (isPlaying && showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);

  const handleVideoEnd = () => {
    onComplete();
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    
    if (videoRef.current.paused) {
      videoRef.current.play();
    } else {
      videoRef.current.pause();
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !videoRef.current.muted;
    setIsMuted(!isMuted);
  };

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onOpenChange(false);
    onComplete();
  };

  const handleStartTour = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    onOpenChange(false);
    onStartTour();
  };

  // If no video URL or video error, show a simplified welcome modal
  if (!videoUrl || videoError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogOverlay className="bg-black/80 backdrop-blur-sm" />
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-gradient-to-br from-background to-muted border-2 border-primary/20">
          <div className="p-8 text-center">
            {/* Icon */}
            <div className="flex items-center justify-center w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary to-accent mb-6">
              <Sparkles className="h-10 w-10 text-white" />
            </div>

            {/* Content */}
            <h2 className="text-2xl font-bold mb-3">Welcome to Exotiq! 🚀</h2>
            <p className="text-muted-foreground mb-6">
              Your AI-powered fleet management command center is ready. 
              Let's take a quick tour of the key features.
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" onClick={handleClose}>
                Skip for Now
              </Button>
              <Button onClick={handleStartTour} className="btn-premium">
                Start Tour
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay className="bg-black/90 backdrop-blur-sm" />
      <DialogContent className="sm:max-w-[800px] p-0 overflow-hidden bg-transparent border-0 shadow-none">
        {/* Video Container */}
        <div 
          className="relative aspect-video w-full rounded-xl overflow-hidden bg-black"
          onMouseMove={() => setShowControls(true)}
          onClick={togglePlay}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            poster={posterUrl}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={handleVideoEnd}
            onError={() => setVideoError(true)}
            onTimeUpdate={(e) => {
              const video = e.currentTarget;
              if (video.duration) {
                setProgress((video.currentTime / video.duration) * 100);
              }
            }}
            autoPlay
            muted={isMuted}
            playsInline
            className="w-full h-full object-cover"
          />

          {/* Overlay Controls */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40"
              >
                {/* Top Bar */}
                <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-white font-medium text-sm">
                      Welcome Tour
                    </span>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose();
                    }}
                    className="text-white/80 hover:text-white hover:bg-white/20"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                </div>

                {/* Center Play/Pause */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {!isPlaying && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                      className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
                    >
                      <Play className="h-8 w-8 text-white ml-1" />
                    </button>
                  )}
                </div>

                {/* Bottom Controls */}
                <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
                  {/* Progress Bar */}
                  <Progress value={progress} className="h-1 bg-white/20" />
                  
                  {/* Control Buttons */}
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMute();
                      }}
                      className="text-white/80 hover:text-white hover:bg-white/20"
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePlay();
                      }}
                      className="text-white/80 hover:text-white hover:bg-white/20"
                    >
                      {isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* CTA Footer */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-4 p-4 rounded-xl bg-background/95 backdrop-blur-md border border-border"
        >
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">Ready to explore?</h3>
              <p className="text-sm text-muted-foreground">
                Take the interactive tour or dive right in
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleClose}>
                Skip for Now
              </Button>
              <Button onClick={handleStartTour} className="btn-premium">
                Start Tour
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
};

export default WelcomeVideoModal;
