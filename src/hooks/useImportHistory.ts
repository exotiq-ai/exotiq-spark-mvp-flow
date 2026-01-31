import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeam } from '@/contexts/TeamContext';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { devError } from '@/lib/logger';

export interface ImportBatch {
  id: string;
  userId: string;
  teamId: string | null;
  entityType: string;
  fileName: string | null;
  totalRows: number | null;
  importedCount: number | null;
  skippedCount: number | null;
  failedCount: number | null;
  status: string | null;
  errorDetails: Record<string, unknown> | null;
  columnMappings: Array<{
    sourceColumn: string;
    targetField: string;
  }>;
  failedRows: Array<{
    rowIndex: number;
    data: Record<string, unknown>;
    error: string;
  }>;
  originalFileUrl: string | null;
  canRetry: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface GroupedImports {
  label: string;
  date: Date;
  imports: ImportBatch[];
}

export function useImportHistory() {
  const { currentTeam } = useTeam();
  const queryClient = useQueryClient();

  // Fetch import history
  const { data: imports, isLoading, error, refetch } = useQuery({
    queryKey: ['import-history', currentTeam?.id],
    queryFn: async (): Promise<ImportBatch[]> => {
      if (!currentTeam?.id) return [];

      const { data, error } = await supabase
        .from('import_batches')
        .select('*')
        .eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        devError('[ImportHistory] Error fetching:', error);
        throw error;
      }

      return (data || []).map((row) => ({
        id: row.id,
        userId: row.user_id,
        teamId: row.team_id,
        entityType: row.entity_type,
        fileName: row.file_name,
        totalRows: row.total_rows,
        importedCount: row.imported_count,
        skippedCount: row.skipped_count,
        failedCount: row.failed_count,
        status: row.status,
        errorDetails: row.error_details as Record<string, unknown> | null,
        columnMappings: (row.column_mappings as ImportBatch['columnMappings']) || [],
        failedRows: (row.failed_rows as ImportBatch['failedRows']) || [],
        originalFileUrl: row.original_file_url,
        canRetry: row.can_retry || false,
        createdAt: row.created_at || '',
        completedAt: row.completed_at,
      }));
    },
    enabled: !!currentTeam?.id,
    staleTime: 30000,
  });

  // Group imports by date
  const groupedImports: GroupedImports[] = (() => {
    if (!imports) return [];

    const groups: Map<string, ImportBatch[]> = new Map();

    for (const imp of imports) {
      const date = parseISO(imp.createdAt);
      let label: string;

      if (isToday(date)) {
        label = 'Today';
      } else if (isYesterday(date)) {
        label = 'Yesterday';
      } else {
        label = format(date, 'MMMM d, yyyy');
      }

      if (!groups.has(label)) {
        groups.set(label, []);
      }
      groups.get(label)!.push(imp);
    }

    return Array.from(groups.entries()).map(([label, imps]) => ({
      label,
      date: parseISO(imps[0].createdAt),
      imports: imps,
    }));
  })();

  // Calculate summary stats
  const stats = (() => {
    if (!imports) return { total: 0, successful: 0, partial: 0, failed: 0 };

    return imports.reduce(
      (acc, imp) => {
        acc.total++;
        if (imp.status === 'completed' && (imp.failedCount || 0) === 0) {
          acc.successful++;
        } else if (imp.status === 'completed' && (imp.failedCount || 0) > 0) {
          acc.partial++;
        } else if (imp.status === 'failed') {
          acc.failed++;
        }
        return acc;
      },
      { total: 0, successful: 0, partial: 0, failed: 0 }
    );
  })();

  // Delete import batch
  const deleteBatch = useMutation({
    mutationFn: async (batchId: string) => {
      const { error } = await supabase
        .from('import_batches')
        .delete()
        .eq('id', batchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-history', currentTeam?.id] });
    },
  });

  // Get single batch details
  const getBatchDetails = async (batchId: string): Promise<ImportBatch | null> => {
    const { data, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .single();

    if (error) {
      devError('[ImportHistory] Error fetching batch:', error);
      return null;
    }

    return {
      id: data.id,
      userId: data.user_id,
      teamId: data.team_id,
      entityType: data.entity_type,
      fileName: data.file_name,
      totalRows: data.total_rows,
      importedCount: data.imported_count,
      skippedCount: data.skipped_count,
      failedCount: data.failed_count,
      status: data.status,
      errorDetails: data.error_details as Record<string, unknown> | null,
      columnMappings: (data.column_mappings as ImportBatch['columnMappings']) || [],
      failedRows: (data.failed_rows as ImportBatch['failedRows']) || [],
      originalFileUrl: data.original_file_url,
      canRetry: data.can_retry || false,
      createdAt: data.created_at || '',
      completedAt: data.completed_at,
    };
  };

  // Download failed rows as CSV
  const downloadFailedRows = (batch: ImportBatch) => {
    if (!batch.failedRows || batch.failedRows.length === 0) return;

    const headers = Object.keys(batch.failedRows[0].data);
    const csvContent = [
      [...headers, 'Error'].join(','),
      ...batch.failedRows.map((row) =>
        [...headers.map((h) => JSON.stringify(row.data[h] || '')), JSON.stringify(row.error)].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `failed_rows_${batch.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    // Data
    imports: imports || [],
    groupedImports,
    stats,
    isLoading,
    error,

    // Actions
    refetch,
    deleteBatch: deleteBatch.mutate,
    isDeleting: deleteBatch.isPending,
    getBatchDetails,
    downloadFailedRows,
  };
}
