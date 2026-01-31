import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, parseISO } from 'date-fns';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  Download,
  Trash2,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Eye,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useImportHistory, ImportBatch, GroupedImports } from '@/hooks/useImportHistory';

interface ImportHistoryProps {
  onNewImport?: () => void;
  onViewDetails?: (batch: ImportBatch) => void;
  onRetryFailed?: (batch: ImportBatch) => void;
}

export function ImportHistory({
  onNewImport,
  onViewDetails,
  onRetryFailed,
}: ImportHistoryProps) {
  const {
    groupedImports,
    stats,
    isLoading,
    deleteBatch,
    isDeleting,
    downloadFailedRows,
  } = useImportHistory();

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today']));
  const [deleteConfirm, setDeleteConfirm] = useState<ImportBatch | null>(null);

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  };

  const getStatusIcon = (batch: ImportBatch) => {
    if (batch.status === 'completed' && (batch.failedCount || 0) === 0) {
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
    if (batch.status === 'completed' && (batch.failedCount || 0) > 0) {
      return <AlertTriangle className="h-5 w-5 text-warning" />;
    }
    if (batch.status === 'failed') {
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    return <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />;
  };

  const getEntityLabel = (type: string) => {
    const labels: Record<string, string> = {
      vehicles: 'Vehicles',
      customers: 'Customers',
      bookings: 'Bookings',
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Import History</h3>
          <p className="text-sm text-muted-foreground">
            {stats.total} imports • {stats.successful} successful • {stats.partial} partial • {stats.failed} failed
          </p>
        </div>
        {onNewImport && (
          <Button onClick={onNewImport} size="sm" className="gap-1">
            <Plus className="h-4 w-4" />
            New Import
          </Button>
        )}
      </div>

      {/* Empty State */}
      {groupedImports.length === 0 && (
        <Card className="p-8 text-center">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h4 className="font-medium mb-2">No imports yet</h4>
          <p className="text-sm text-muted-foreground mb-4">
            Import vehicles, customers, or bookings from CSV or Excel files.
          </p>
          {onNewImport && (
            <Button onClick={onNewImport} variant="outline">
              Start Your First Import
            </Button>
          )}
        </Card>
      )}

      {/* Import Groups */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-4 pr-4">
          {groupedImports.map((group) => (
            <div key={group.label}>
              {/* Group Header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className="flex items-center gap-2 w-full text-left mb-2 hover:text-primary transition-colors"
              >
                {expandedGroups.has(group.label) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-medium text-sm">{group.label}</span>
                <span className="text-xs text-muted-foreground">
                  ({group.imports.length})
                </span>
              </button>

              {/* Group Content */}
              <AnimatePresence>
                {expandedGroups.has(group.label) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="space-y-2"
                  >
                    {group.imports.map((batch) => (
                      <ImportBatchCard
                        key={batch.id}
                        batch={batch}
                        statusIcon={getStatusIcon(batch)}
                        entityLabel={getEntityLabel(batch.entityType)}
                        onViewDetails={onViewDetails}
                        onRetryFailed={onRetryFailed}
                        onDownloadFailed={() => downloadFailedRows(batch)}
                        onDelete={() => setDeleteConfirm(batch)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Import Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the import history record for "{deleteConfirm?.fileName}".
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm) {
                  deleteBatch(deleteConfirm.id);
                  setDeleteConfirm(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface ImportBatchCardProps {
  batch: ImportBatch;
  statusIcon: React.ReactNode;
  entityLabel: string;
  onViewDetails?: (batch: ImportBatch) => void;
  onRetryFailed?: (batch: ImportBatch) => void;
  onDownloadFailed?: () => void;
  onDelete?: () => void;
}

function ImportBatchCard({
  batch,
  statusIcon,
  entityLabel,
  onViewDetails,
  onRetryFailed,
  onDownloadFailed,
  onDelete,
}: ImportBatchCardProps) {
  const hasFailures = (batch.failedCount || 0) > 0;

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium truncate">{batch.fileName || 'Import'}</span>
            <Badge variant="secondary" className="text-xs">
              {entityLabel}
            </Badge>
          </div>

          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
            <span>
              {batch.importedCount || 0} imported
            </span>
            {hasFailures && (
              <span className="text-destructive">
                {batch.failedCount} failed
              </span>
            )}
            {(batch.skippedCount || 0) > 0 && (
              <span>{batch.skippedCount} skipped</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {format(parseISO(batch.createdAt), 'h:mm a')}
          </p>

          {/* Error Message */}
          {batch.status === 'failed' && batch.errorDetails && (
            <p className="text-xs text-destructive mt-2">
              Error: {String((batch.errorDetails as any).message || 'Unknown error')}
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {onViewDetails && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onViewDetails(batch)}
                className="h-7 text-xs gap-1"
              >
                <Eye className="h-3 w-3" />
                View Details
              </Button>
            )}
            {hasFailures && onDownloadFailed && (
              <Button
                size="sm"
                variant="outline"
                onClick={onDownloadFailed}
                className="h-7 text-xs gap-1"
              >
                <Download className="h-3 w-3" />
                Download Failed
              </Button>
            )}
            {hasFailures && batch.canRetry && onRetryFailed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetryFailed(batch)}
                className="h-7 text-xs gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Retry Failed
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onDelete}
                className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default ImportHistory;
