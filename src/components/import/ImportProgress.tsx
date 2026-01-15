import React from 'react';
import { CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface ImportProgressState {
  status: 'idle' | 'importing' | 'completed' | 'error';
  totalRows: number;
  processedRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  currentBatch: number;
  totalBatches: number;
  errorMessage?: string;
}

interface ImportProgressProps {
  progress: ImportProgressState;
}

export function ImportProgress({ progress }: ImportProgressProps) {
  const percentComplete = progress.totalRows > 0 
    ? Math.round((progress.processedRows / progress.totalRows) * 100)
    : 0;

  const getStatusIcon = () => {
    switch (progress.status) {
      case 'importing':
        return <Loader2 className="h-8 w-8 text-primary animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case 'error':
        return <XCircle className="h-8 w-8 text-destructive" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (progress.status) {
      case 'importing':
        return `Importing... Batch ${progress.currentBatch} of ${progress.totalBatches}`;
      case 'completed':
        return 'Import Complete!';
      case 'error':
        return 'Import Failed';
      default:
        return 'Ready to import';
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Status */}
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="mb-4">
          {getStatusIcon()}
        </div>
        <h3 className="text-xl font-semibold">{getStatusText()}</h3>
        {progress.status === 'importing' && (
          <p className="text-sm text-muted-foreground mt-2">
            Please don't close this window
          </p>
        )}
      </div>

      {/* Progress Bar */}
      {(progress.status === 'importing' || progress.status === 'completed') && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{percentComplete}%</span>
          </div>
          <Progress value={percentComplete} className="h-3" />
          <p className="text-xs text-muted-foreground text-center">
            {progress.processedRows} of {progress.totalRows} rows processed
          </p>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <div className="flex flex-col items-center">
            <CheckCircle2 className="h-6 w-6 text-green-500 mb-2" />
            <p className="text-2xl font-bold text-green-500">{progress.importedCount}</p>
            <p className="text-sm text-muted-foreground">Imported</p>
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="flex flex-col items-center">
            <AlertCircle className="h-6 w-6 text-yellow-500 mb-2" />
            <p className="text-2xl font-bold text-yellow-500">{progress.skippedCount}</p>
            <p className="text-sm text-muted-foreground">Skipped</p>
          </div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="flex flex-col items-center">
            <XCircle className="h-6 w-6 text-destructive mb-2" />
            <p className="text-2xl font-bold text-destructive">{progress.failedCount}</p>
            <p className="text-sm text-muted-foreground">Failed</p>
          </div>
        </Card>
      </div>

      {/* Error Message */}
      {progress.status === 'error' && progress.errorMessage && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <XCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm text-destructive">Error Details</p>
            <p className="text-sm text-muted-foreground">{progress.errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success Message */}
      {progress.status === 'completed' && progress.importedCount > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/20">
          <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm text-green-500">Import Successful</p>
            <p className="text-sm text-muted-foreground">
              Successfully imported {progress.importedCount} records.
              {progress.skippedCount > 0 && ` ${progress.skippedCount} records were skipped due to validation errors.`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
