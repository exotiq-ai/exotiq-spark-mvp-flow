import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ErrorShake } from '@/components/ui/error-shake';

interface ErrorRetryProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  fullScreen?: boolean;
}

export const ErrorRetry = ({ 
  title = "Something went wrong",
  message = "We couldn't load this data. Please try again.",
  onRetry,
  fullScreen = false
}: ErrorRetryProps) => {
  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <ErrorShake>
          <div className="max-w-md w-full space-y-4">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="animate-shake">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <div>
                <h2 className="text-xl font-semibold mb-2">{title}</h2>
                <p className="text-sm text-muted-foreground">{message}</p>
              </div>
              {onRetry && (
                <Button onClick={onRetry} variant="default" className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Try Again
                </Button>
              )}
            </div>
          </div>
        </ErrorShake>
      </div>
    );
  }

  return (
    <ErrorShake>
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex items-center justify-between gap-4">
          <span>{message}</span>
          {onRetry && (
            <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    </ErrorShake>
  );
};
