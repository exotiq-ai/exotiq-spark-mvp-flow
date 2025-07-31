import React, { useState, useCallback } from 'react';
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
    ...props 
  }, ref) => {
    const [imgSrc, setImgSrc] = useState(performance.optimizeImage(src, width, quality));
    const [isLoading, setIsLoading] = useState(true);
    const [hasError, setHasError] = useState(false);

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
      <div className={cn('relative overflow-hidden', className)}>
        {isLoading && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
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
            'transition-opacity duration-300',
            isLoading ? 'opacity-0' : 'opacity-100',
            hasError ? 'filter grayscale' : ''
          )}
          {...props}
        />
      </div>
    );
  }
);

OptimizedImage.displayName = 'OptimizedImage';