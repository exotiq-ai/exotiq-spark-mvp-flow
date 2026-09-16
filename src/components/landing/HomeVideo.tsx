import { useRef, useState } from "react";
import { Play } from "lucide-react";
import overviewVideo from "@/assets/exotiq-platform-overview.mp4.asset.json";
import poster from "@/assets/home-video-poster.jpg";

/**
 * Homepage product video. Poster frame + single play action, no autoplay:
 * the narration is the point, so playback is always user-initiated.
 */
export const HomeVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);

  const handlePlay = () => {
    setStarted(true);
    // Let the controls render before requesting playback.
    requestAnimationFrame(() => {
      void videoRef.current?.play();
    });
  };

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
        <video
          ref={videoRef}
          src={overviewVideo.url}
          poster={poster}
          preload="none"
          playsInline
          controls={started}
          className="aspect-video w-full bg-muted"
          aria-label="Exotiq platform overview"
        />

        {!started && (
          <button
            type="button"
            onClick={handlePlay}
            className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-foreground/25 transition-colors hover:bg-foreground/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label="Play the 78-second platform tour"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-background shadow-md transition-transform group-hover:scale-105">
              <Play className="ml-1 h-6 w-6 text-primary" />
            </span>
            <span className="rounded-full bg-background/90 px-4 py-1.5 text-sm font-medium text-foreground">
              Watch the 78-second tour
            </span>
          </button>
        )}
      </div>
      <p className="mt-3 text-center text-sm text-muted-foreground">
        A real walkthrough of the platform — fleet, bookings, pricing and payments. Sound on.
      </p>
    </div>
  );
};
