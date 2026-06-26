import React, { useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Upload, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImportEntityType } from '@/lib/importSchemas';
import { parseFile, detectEntityType, transformRows, validateRows, ColumnMapping, ParsedFileData, ValidationResult, EntityDetectionResult } from '@/lib/importUtils';
import { checkForDuplicates, applyDuplicateResolutions, linkBookingsToExistingRecords, linkBookingsToLocations, DuplicateCheckResult, DuplicateMatch } from '@/lib/importDuplicateCheck';
import { useNavigate } from 'react-router-dom';
import { FileUploadZone } from './FileUploadZone';
import { EntityTypeSelector } from './EntityTypeSelector';
import { ColumnMapper } from './ColumnMapper';
import { ValidationPreview } from './ValidationPreview';
import { ImportProgress, ImportProgressState } from './ImportProgress';
import { DuplicateResolver, DuplicateResolution } from './DuplicateResolver';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTeam } from '@/contexts/TeamContext';
import { useFleet } from '@/contexts/FleetContext';
import { useQueryClient } from '@tanstack/react-query';
import { ImportSummary } from './ImportSummary';

interface ImportWizardProps {
  onClose?: () => void;
  onComplete?: (entityType: ImportEntityType | string, count: number) => void;
}

type WizardStep = 'upload' | 'entity' | 'mapping' | 'preview' | 'duplicates' | 'import' | 'summary';

const steps: { key: WizardStep; label: string }[] = [
  { key: 'upload', label: 'Upload File' },
  { key: 'entity', label: 'Select Type' },
  { key: 'mapping', label: 'Map Columns' },
  { key: 'preview', label: 'Preview' },
  { key: 'duplicates', label: 'Review' },
  { key: 'import', label: 'Import' },
  { key: 'summary', label: 'Summary' }
];

export function ImportWizard({ onClose, onComplete }: ImportWizardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentTeam } = useTeam();
  const { refreshData: refreshFleetData } = useFleet();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [detectedEntity, setDetectedEntity] = useState<EntityDetectionResult | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<ImportEntityType | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [duplicateResult, setDuplicateResult] = useState<DuplicateCheckResult | null>(null);
  const [duplicateResolutions, setDuplicateResolutions] = useState<Map<number, DuplicateResolution>>(new Map());
  const [importProgress, setImportProgress] = useState<ImportProgressState>({
    status: 'idle', totalRows: 0, processedRows: 0, importedCount: 0,
    skippedCount: 0, failedCount: 0, currentBatch: 0, totalBatches: 0
  });
  const [bookingsNeedingAttention, setBookingsNeedingAttention] = useState(0);
  const [photoReferences, setPhotoReferences] = useState<string[]>([]);

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  const resetWizard = useCallback(() => {
    setCurrentStep('upload');
    setSelectedFile(null);
    setParsedData(null);
    setFileError(null);
    setDetectedEntity(null);
    setSelectedEntity(null);
    setColumnMappings([]);
    setValidationResult(null);
    setDuplicateResult(null);
    setDuplicateResolutions(new Map());
    setImportProgress({ status: 'idle', totalRows: 0, processedRows: 0, importedCount: 0, skippedCount: 0, failedCount: 0, currentBatch: 0, totalBatches: 0 });
    setBookingsNeedingAttention(0);
    setPhotoReferences([]);
  }, []);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setFileError(null);
    setIsProcessing(true);
    try {
      const data = await parseFile(file);
      setParsedData(data);
      const detected = detectEntityType(data.headers);
      setDetectedEntity(detected);
      if (detected.confidence >= 70) setSelectedEntity(detected.entityType);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Failed to parse file');
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 'upload' && parsedData) {
      setCurrentStep('entity');
    } else if (currentStep === 'entity' && selectedEntity) {
      setCurrentStep('mapping');
    } else if (currentStep === 'mapping' && selectedEntity && parsedData) {
      setIsProcessing(true);
      try {
        const transformed = transformRows(parsedData.rows, columnMappings);
        const result = validateRows(transformed, selectedEntity);
        setValidationResult(result);
        setCurrentStep('preview');
      } finally {
        setIsProcessing(false);
      }
    } else if (currentStep === 'preview' && validationResult && selectedEntity && currentTeam) {
      setIsProcessing(true);
      try {
        // Check for duplicates
        const dupResult = await checkForDuplicates(
          validationResult.validRows,
          selectedEntity,
          currentTeam.id
        );
        setDuplicateResult(dupResult);
        
        if (dupResult.duplicates.length > 0) {
          // Initialize resolutions to 'skip'
          const initialResolutions = new Map<number, DuplicateResolution>();
          dupResult.duplicates.forEach(d => initialResolutions.set(d.importRowIndex, 'skip'));
          setDuplicateResolutions(initialResolutions);
          setCurrentStep('duplicates');
        } else {
          // No duplicates, proceed to import
          setCurrentStep('import');
          await performImport();
        }
      } finally {
        setIsProcessing(false);
      }
    } else if (currentStep === 'duplicates') {
      setCurrentStep('import');
      await performImport();
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(steps[prevIndex].key);
  };

  const handleDuplicateResolution = (resolutions: Map<number, DuplicateResolution>) => {
    setDuplicateResolutions(resolutions);
  };

  const performImport = async () => {
    if (!validationResult || !selectedEntity || !user || !currentTeam) return;
    
    const batchSize = 50;
    
    // Apply duplicate resolutions if any
    let recordsToProcess: Record<string, unknown>[];
    let updatesToProcess: { id: string; data: Record<string, unknown> }[] = [];
    let skippedFromDuplicates = 0;
    
    if (duplicateResult && duplicateResult.duplicates.length > 0) {
      // Apply resolutions
      const duplicatesWithResolutions = duplicateResult.duplicates.map(d => ({
        ...d,
        resolution: duplicateResolutions.get(d.importRowIndex) || 'skip'
      }));
      
      const { toInsert, toUpdate, skipped } = await applyDuplicateResolutions(
        duplicatesWithResolutions,
        duplicateResult.newRecords,
        selectedEntity,
        currentTeam.id,
        user.id
      );
      
      recordsToProcess = toInsert;
      updatesToProcess = toUpdate;
      skippedFromDuplicates = skipped;
    } else {
      recordsToProcess = validationResult.validRows.map(row => ({
        ...row,
        user_id: user.id,
        team_id: currentTeam.id
      }));
    }

    // Vehicles: extract photo references (CSV `image` column) into a sidecar list
    // so we can surface a "drop these files into Photo Hub" banner. Strip the
    // field before insert — vehicles table has no `image` column.
    if (selectedEntity === 'vehicles') {
      const refs: string[] = [];
      recordsToProcess = recordsToProcess.map(row => {
        const { image, ...rest } = row as Record<string, unknown> & { image?: unknown };
        if (image && typeof image === 'string') {
          const trimmed = image.trim();
          // Only collect non-URL local paths / filenames; URLs are stored elsewhere
          if (trimmed && !/^https?:\/\//i.test(trimmed)) {
            // Use basename for display (handles Windows + POSIX paths)
            const base = trimmed.split(/[\\/]/).pop() || trimmed;
            refs.push(base);
          }
        }
        return rest;
      });
      setPhotoReferences(refs);
    }

    // For bookings, auto-create customers and link entities
    if (selectedEntity === 'bookings') {
      recordsToProcess = await autoCreateCustomersAndLink(recordsToProcess, currentTeam.id, user.id);
    }
    
    const totalRows = recordsToProcess.length + updatesToProcess.length;
    const totalBatches = Math.ceil(recordsToProcess.length / batchSize) + (updatesToProcess.length > 0 ? 1 : 0);
    
    setImportProgress({
      status: 'importing', totalRows, processedRows: 0,
      importedCount: 0, skippedCount: validationResult.invalidRows.length + skippedFromDuplicates,
      failedCount: 0, currentBatch: 0, totalBatches
    });

    try {
      let imported = 0, failed = 0;
      let lastInsertError: string | null = null;
      
      // Record import batch
      const { data: batchRecord } = await supabase
        .from('import_batches')
        .insert({
          user_id: user.id,
          team_id: currentTeam.id,
          entity_type: selectedEntity,
          file_name: selectedFile?.name,
          total_rows: totalRows + validationResult.invalidRows.length,
          status: 'processing'
        } as any)
        .select()
        .single();
      
      // Process inserts in batches
      const insertBatches = Math.ceil(recordsToProcess.length / batchSize);
      for (let i = 0; i < insertBatches; i++) {
        const batch = recordsToProcess.slice(i * batchSize, (i + 1) * batchSize);
        
        const { data, error } = await supabase
          .from(selectedEntity)
          .insert(batch as any)
          .select();
        
        if (error) { 
          console.error('[ImportWizard] Batch insert error:', error.message, error.details, error.hint);
          lastInsertError = `${error.message}${error.details ? ` | ${error.details}` : ''}`;
          failed += batch.length; 
        } else { imported += data?.length || 0; }
        
        setImportProgress(prev => ({
          ...prev, processedRows: (i + 1) * batchSize,
          currentBatch: i + 1, importedCount: imported, failedCount: failed
        }));
      }
      
      // Process updates
      if (updatesToProcess.length > 0) {
        for (const update of updatesToProcess) {
          const { error } = await supabase
            .from(selectedEntity)
            .update(update.data as any)
            .eq('id', update.id);
          
          if (error) { failed++; } 
          else { imported++; }
        }
        
        setImportProgress(prev => ({
          ...prev, 
          processedRows: recordsToProcess.length + updatesToProcess.length,
          currentBatch: totalBatches, 
          importedCount: imported, 
          failedCount: failed
        }));
      }
      
      // Update batch record
      if (batchRecord?.id) {
        await supabase
          .from('import_batches')
          .update({
            status: 'completed',
            imported_count: imported,
            skipped_count: validationResult.invalidRows.length + skippedFromDuplicates,
            failed_count: failed,
            completed_at: new Date().toISOString(),
            ...(lastInsertError ? { error_details: { lastError: lastInsertError } } : {})
          } as any)
          .eq('id', batchRecord.id);
      }
      
      setImportProgress(prev => ({ ...prev, status: 'completed', processedRows: totalRows }));
      
      // Invalidate queries to refresh data
      await invalidateRelatedQueries(selectedEntity);
      
      // Force FleetContext refresh to immediately sync UI
      try {
        await refreshFleetData(true);
      } catch (e) {
        console.warn('[ImportWizard] FleetContext refresh failed, UI may need manual refresh:', e);
      }
      
      // Track bookings needing attention (missing customer or vehicle)
      if (selectedEntity === 'bookings') {
        const needsAttention = recordsToProcess.filter(r => !r.customer_id || !r.vehicle_id).length;
        setBookingsNeedingAttention(needsAttention);
      }
      
      // Transition to summary step
      setTimeout(() => {
        setCurrentStep('summary');
      }, 1500);
      
    } catch (error) {
      setImportProgress(prev => ({ ...prev, status: 'error', errorMessage: error instanceof Error ? error.message : 'Import failed' }));
    }
  };

  const autoCreateCustomersAndLink = async (
    rows: Record<string, unknown>[],
    teamId: string,
    userId: string
  ): Promise<Record<string, unknown>[]> => {
    // First link to existing records (customers and vehicles)
    let linkedRows = await linkBookingsToExistingRecords(rows, teamId);
    
    // Then link to existing locations
    linkedRows = await linkBookingsToLocations(linkedRows, teamId);
    
    // Validate and fix date ranges - ensure end_date >= start_date
    const dateValidatedRows = linkedRows.map(row => {
      if (row.start_date && row.end_date) {
        const startDate = new Date(String(row.start_date));
        const endDate = new Date(String(row.end_date));
        
        // If end date is before start date, swap them
        if (endDate < startDate) {
          console.warn(`Booking date range invalid: swapping ${row.start_date} and ${row.end_date}`);
          return {
            ...row,
            start_date: row.end_date,
            end_date: row.start_date
          };
        }
      }
      return row;
    });
    
    // Find rows that need customer creation (only if they have email)
    const rowsNeedingCustomers = dateValidatedRows.filter(
      row => !row.customer_id && row.customer_email
    );
    
    // Get unique emails that need customer creation
    const uniqueEmails = [...new Set(
      rowsNeedingCustomers
        .map(r => String(r.customer_email).toLowerCase())
        .filter(Boolean)
    )];
    
    // Create customers for each unique email
    const emailToCustomerId = new Map<string, string>();
    
    for (const email of uniqueEmails) {
      const matchingRow = rowsNeedingCustomers.find(
        r => String(r.customer_email).toLowerCase() === email
      );
      
      if (!matchingRow) continue;
      
      const { data: newCustomer, error } = await supabase
        .from('customers')
        .insert({
          full_name: String(matchingRow.customer_name || 'Unknown'),
          email: email,
          phone: matchingRow.customer_phone ? String(matchingRow.customer_phone) : null,
          user_id: userId,
          team_id: teamId,
          customer_status: 'active' as const
        } as any)
        .select('id')
        .single();
      
      if (!error && newCustomer) {
        emailToCustomerId.set(email, newCustomer.id);
      }
    }
    
    // Update rows with new customer IDs and preserve vehicle_name
    return dateValidatedRows.map(row => {
      const processedRow = { ...row };
      
      // Link customer if we created one
      if (!processedRow.customer_id) {
        const email = String(row.customer_email || '').toLowerCase();
        const customerId = emailToCustomerId.get(email);
        if (customerId) {
          processedRow.customer_id = customerId;
        }
      }
      
      // IMPORTANT: Keep vehicle_name for storage even if vehicle_id is null
      // The vehicle_name column now exists in the database
      // Remove helper fields that don't belong in final insert
      delete processedRow.customer_email;
      delete processedRow.customer_phone;
      // Keep vehicle_name - it's now a real column!
      
      return processedRow;
    });
  };

  const invalidateRelatedQueries = async (entityType: ImportEntityType) => {
    const queryKeys = [entityType];
    
    // Also invalidate related queries
    if (entityType === 'bookings') {
      queryKeys.push('customers' as any);
    }
    if (entityType === 'vehicles') {
      queryKeys.push('fleet' as any);
    }
    
    // Invalidate all related queries
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['fleet'] }),
      queryClient.invalidateQueries({ queryKey: ['customers'] }),
      queryClient.invalidateQueries({ queryKey: ['bookings'] }),
      queryClient.invalidateQueries({ queryKey: ['vehicles'] }),
      queryClient.invalidateQueries({ queryKey: ['locations'] }),
    ]);
  };

  const canProceed = () => {
    if (currentStep === 'upload') return !!parsedData && !isProcessing;
    if (currentStep === 'entity') return !!selectedEntity;
    if (currentStep === 'mapping') return columnMappings.some(m => m.sourceColumn) && !isProcessing;
    if (currentStep === 'preview') return validationResult && validationResult.validRows.length > 0 && !isProcessing;
    if (currentStep === 'duplicates') return true; // Can always proceed from duplicates
    return false;
  };

  // Skip duplicates step in progress indicator if no duplicates
  const visibleSteps = duplicateResult?.duplicates?.length 
    ? steps 
    : steps.filter(s => s.key !== 'duplicates');
  
  const visibleStepIndex = visibleSteps.findIndex(s => s.key === currentStep);

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      {/* Progress Steps */}
      <div className="flex items-center gap-2 py-4">
        {visibleSteps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className={cn('flex items-center gap-2', index <= visibleStepIndex ? 'text-primary' : 'text-muted-foreground')}>
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium', index < visibleStepIndex ? 'bg-primary text-primary-foreground' : index === visibleStepIndex ? 'bg-primary/20 text-primary border-2 border-primary' : 'bg-muted')}>
                {index < visibleStepIndex ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span className="text-sm hidden sm:inline">{step.label}</span>
            </div>
            {index < visibleSteps.length - 1 && <div className={cn('flex-1 h-0.5', index < visibleStepIndex ? 'bg-primary' : 'bg-muted')} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-y-auto py-4">
        {currentStep === 'upload' && (
          <FileUploadZone 
            onFileSelect={handleFileSelect} 
            selectedFile={selectedFile} 
            onClear={() => { setSelectedFile(null); setParsedData(null); }} 
            isProcessing={isProcessing} 
            error={fileError} 
          />
        )}
        {currentStep === 'entity' && (
          <EntityTypeSelector 
            detectedEntity={detectedEntity} 
            selectedEntity={selectedEntity} 
            onSelect={setSelectedEntity} 
          />
        )}
        {currentStep === 'mapping' && selectedEntity && parsedData && (
          <ColumnMapper 
            entityType={selectedEntity} 
            sourceHeaders={parsedData.headers} 
            sourceRows={parsedData.rows} 
            mappings={columnMappings} 
            onMappingsChange={setColumnMappings} 
          />
        )}
        {currentStep === 'preview' && selectedEntity && validationResult && (
          <ValidationPreview 
            entityType={selectedEntity} 
            validationResult={validationResult} 
          />
        )}
        {currentStep === 'duplicates' && duplicateResult && (
          <DuplicateResolver
            duplicates={duplicateResult.duplicates}
            onResolve={handleDuplicateResolution}
            onBack={() => setCurrentStep('preview')}
          />
        )}
        {currentStep === 'import' && <ImportProgress progress={importProgress} />}
        {currentStep === 'summary' && selectedEntity && (
          <ImportSummary
            entityType={selectedEntity}
            stats={{
              imported: importProgress.importedCount,
              skipped: importProgress.skippedCount,
              failed: importProgress.failedCount,
              needsAttention: bookingsNeedingAttention
            }}
            fileName={selectedFile?.name}
            columnMappings={columnMappings.map(m => ({
              sourceColumn: m.sourceColumn,
              targetField: m.targetField
            }))}
            failedRows={validationResult?.invalidRows.map(r => ({
              row: r.row,
              errors: r.errors.map(e => ({ field: e.field, message: e.message }))
            }))}
            photoReferences={photoReferences}
            onClose={() => {
              resetWizard();
            }}
            onViewData={(module) => {
              onComplete?.(selectedEntity, importProgress.importedCount);
              onClose?.();
              navigate(`/dashboard?tab=${module}`);
            }}
          />
        )}
      </div>

      {/* Footer - hidden on summary step */}
      {currentStep !== 'summary' && (
        <div className="flex items-center justify-between pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={handleBack} 
            disabled={currentStepIndex === 0 || importProgress.status === 'importing'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          {currentStep !== 'import' && currentStep !== 'duplicates' ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {currentStep === 'preview' ? 'Check Duplicates' : 'Next'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : currentStep === 'duplicates' ? (
            <Button onClick={handleNext}>
              Continue with Import
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => { resetWizard(); onClose?.(); }} disabled={importProgress.status === 'importing'}>
              {importProgress.status === 'completed' ? 'Done' : 'Close'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
