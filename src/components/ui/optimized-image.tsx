import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { performance } from '@/lib/performance';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  quality?: number;
  fallback?: string;
  lazy?: boolean;
  className?: string;
  blurDataURL?: string;
}

export const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({ 
    src, 
    alt, 
    width, 
    height, 
    quality = 80, 
    fallback = '/placeholder.svg',
    lazy = true,
    className,
    onLoad,
    onError,
    blurDataURL,
    ...props 
  }, ref) => {
    const [imgSrc, setImgSrc] = useState(performance.optimizeImage(src, width, quality));
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);
    const [inView, setInView] = useState(!lazy);

    useEffect(() => {
      if (!lazy) return;

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setInView(true);
              observer.disconnect();
            }
          });
        },
        { rootMargin: '50px' }
      );

      const element = document.getElementById(`img-${src}`);
      if (element) observer.observe(element);

      return () => observer.disconnect();
    }, [lazy, src]);

    const handleLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
      setIsLoading(false);
      setHasError(false);
      onLoad?.(event);
    }, [onLoad]);

    const handleError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
      setIsLoading(false);
      setHasError(true);
      setImgSrc(fallback);
      onError?.(event);
    }, [fallback, onError]);

    return (
      <div id={`img-${src}`} className={cn('relative overflow-hidden', className)}>
        {isLoading && blurDataURL && (
          <img
            src={blurDataURL}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-cover blur-sm scale-110"
          />
        )}
        {isLoading && !blurDataURL && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        {inView && (
          <img
            ref={ref}
            src={imgSrc}
            alt={alt}
            width={width}
            height={height}
            loading={lazy ? 'lazy' : 'eager'}
            onLoad={handleLoad}
            onError={handleError}
            className={cn(
              'transition-opacity duration-500',
              isLoading ? 'opacity-0' : 'opacity-100',
              hasError ? 'filter grayscale' : '',
              className
            )}
            {...props}
          />
        )}
      </div>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';