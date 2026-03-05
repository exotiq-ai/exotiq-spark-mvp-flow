import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Photo {
  id: string;
  url: string;
  thumbnail_url?: string | null;
  photo_type?: string;
}

interface PhotoGalleryStripProps {
  photos: Photo[];
  currentIndex: number;
  onSelect: (index: number) => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function PhotoGalleryStrip({
  photos,
  currentIndex,
  onSelect,
  size = 'md',
  className,
}: PhotoGalleryStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to keep current thumbnail visible
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const thumbnail = container.children[currentIndex] as HTMLElement;
      if (thumbnail) {
        const containerRect = container.getBoundingClientRect();
        const thumbnailRect = thumbnail.getBoundingClientRect();
        
        if (thumbnailRect.left < containerRect.left) {
          thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
        } else if (thumbnailRect.right > containerRect.right) {
          thumbnail.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
        }
      }
    }
  }, [currentIndex]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  if (photos.length === 0) return null;

  const thumbSize = size === 'sm' ? 'h-12 w-12' : 'h-16 w-16';

  return (
    <div className={cn('relative', className)}>
      {/* Navigation Arrows */}
      {photos.length > 4 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm shadow-sm"
            onClick={() => scroll('left')}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 bg-background/80 backdrop-blur-sm shadow-sm"
            onClick={() => scroll('right')}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </>
      )}

      {/* Thumbnail Strip */}
      <div
        ref={scrollRef}
        className={cn(
          'flex gap-2 overflow-x-auto scrollbar-hide px-8',
          photos.length <= 4 && 'justify-center px-0'
        )}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {photos.map((photo, index) => (
          <motion.button
            key={photo.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(index)}
            className={cn(
              'flex-shrink-0 rounded-lg overflow-hidden border-2 transition-all',
              thumbSize,
              currentIndex === index
                ? 'border-primary ring-2 ring-primary/30'
                : 'border-transparent hover:border-muted-foreground/30'
            )}
          >
            <img
              src={photo.thumbnail_url || photo.url}
              alt={`Photo ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </motion.button>
        ))}
      </div>

      {/* Dot Indicators for mobile/compact view */}
      {photos.length > 1 && photos.length <= 8 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {photos.map((_, index) => (
            <button
              key={index}
              onClick={() => onSelect(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                currentIndex === index
                  ? 'bg-primary w-4'
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
