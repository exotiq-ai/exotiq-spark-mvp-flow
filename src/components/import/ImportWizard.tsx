import React, { useState, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Upload, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ImportEntityType } from '@/lib/importSchemas';
import { parseFile, detectEntityType, transformRows, validateRows, ColumnMapping, ParsedFileData, ValidationResult, EntityDetectionResult } from '@/lib/importUtils';
import { FileUploadZone } from './FileUploadZone';
import { EntityTypeSelector } from './EntityTypeSelector';
import { ColumnMapper } from './ColumnMapper';
import { ValidationPreview } from './ValidationPreview';
import { ImportProgress, ImportProgressState } from './ImportProgress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: (entityType: ImportEntityType, count: number) => void;
}

type WizardStep = 'upload' | 'entity' | 'mapping' | 'preview' | 'import';

const steps: { key: WizardStep; label: string }[] = [
  { key: 'upload', label: 'Upload File' },
  { key: 'entity', label: 'Select Type' },
  { key: 'mapping', label: 'Map Columns' },
  { key: 'preview', label: 'Preview' },
  { key: 'import', label: 'Import' }
];

export function ImportWizard({ open, onOpenChange, onComplete }: ImportWizardProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedFileData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [detectedEntity, setDetectedEntity] = useState<EntityDetectionResult | null>(null);
  const [selectedEntity, setSelectedEntity] = useState<ImportEntityType | null>(null);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importProgress, setImportProgress] = useState<ImportProgressState>({
    status: 'idle', totalRows: 0, processedRows: 0, importedCount: 0,
    skippedCount: 0, failedCount: 0, currentBatch: 0, totalBatches: 0
  });

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
    setImportProgress({ status: 'idle', totalRows: 0, processedRows: 0, importedCount: 0, skippedCount: 0, failedCount: 0, currentBatch: 0, totalBatches: 0 });
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
      const transformed = transformRows(parsedData.rows, columnMappings);
      const result = validateRows(transformed, selectedEntity);
      setValidationResult(result);
      setCurrentStep('preview');
    } else if (currentStep === 'preview' && validationResult) {
      setCurrentStep('import');
      await performImport();
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) setCurrentStep(steps[prevIndex].key);
  };

  const performImport = async () => {
    if (!validationResult || !selectedEntity || !user) return;
    
    const rows = validationResult.validRows;
    const batchSize = 50;
    const totalBatches = Math.ceil(rows.length / batchSize);
    
    setImportProgress({
      status: 'importing', totalRows: rows.length, processedRows: 0,
      importedCount: 0, skippedCount: validationResult.invalidRows.length,
      failedCount: 0, currentBatch: 0, totalBatches
    });

    try {
      let imported = 0, failed = 0;
      
      for (let i = 0; i < totalBatches; i++) {
        const batch = rows.slice(i * batchSize, (i + 1) * batchSize);
        const { data, error } = await supabase
          .from(selectedEntity)
          .insert(batch.map(row => ({ ...row, user_id: user.id })))
          .select();
        
        if (error) { failed += batch.length; } 
        else { imported += data?.length || 0; }
        
        setImportProgress(prev => ({
          ...prev, processedRows: (i + 1) * batchSize,
          currentBatch: i + 1, importedCount: imported, failedCount: failed
        }));
      }
      
      setImportProgress(prev => ({ ...prev, status: 'completed', processedRows: rows.length }));
      onComplete?.(selectedEntity, imported);
      toast({ title: 'Import Complete', description: `Successfully imported ${imported} ${selectedEntity}.` });
    } catch (error) {
      setImportProgress(prev => ({ ...prev, status: 'error', errorMessage: error instanceof Error ? error.message : 'Import failed' }));
    }
  };

  const canProceed = () => {
    if (currentStep === 'upload') return !!parsedData && !isProcessing;
    if (currentStep === 'entity') return !!selectedEntity;
    if (currentStep === 'mapping') return columnMappings.some(m => m.sourceColumn);
    if (currentStep === 'preview') return validationResult && validationResult.validRows.length > 0;
    return false;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetWizard(); onOpenChange(o); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Data
          </DialogTitle>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 py-4">
          {steps.map((step, index) => (
            <React.Fragment key={step.key}>
              <div className={cn('flex items-center gap-2', index <= currentStepIndex ? 'text-primary' : 'text-muted-foreground')}>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium', index < currentStepIndex ? 'bg-primary text-primary-foreground' : index === currentStepIndex ? 'bg-primary/20 text-primary border-2 border-primary' : 'bg-muted')}>
                  {index < currentStepIndex ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                <span className="text-sm hidden sm:inline">{step.label}</span>
              </div>
              {index < steps.length - 1 && <div className={cn('flex-1 h-0.5', index < currentStepIndex ? 'bg-primary' : 'bg-muted')} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {currentStep === 'upload' && <FileUploadZone onFileSelect={handleFileSelect} selectedFile={selectedFile} onClear={() => { setSelectedFile(null); setParsedData(null); }} isProcessing={isProcessing} error={fileError} />}
          {currentStep === 'entity' && <EntityTypeSelector detectedEntity={detectedEntity} selectedEntity={selectedEntity} onSelect={setSelectedEntity} />}
          {currentStep === 'mapping' && selectedEntity && parsedData && <ColumnMapper entityType={selectedEntity} sourceHeaders={parsedData.headers} sourceRows={parsedData.rows} mappings={columnMappings} onMappingsChange={setColumnMappings} />}
          {currentStep === 'preview' && selectedEntity && validationResult && <ValidationPreview entityType={selectedEntity} validationResult={validationResult} />}
          {currentStep === 'import' && <ImportProgress progress={importProgress} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={handleBack} disabled={currentStepIndex === 0 || importProgress.status === 'importing'}>
            <ArrowLeft className="h-4 w-4 mr-2" />Back
          </Button>
          {currentStep !== 'import' ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              {currentStep === 'preview' ? 'Start Import' : 'Next'}<ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={() => { resetWizard(); onOpenChange(false); }} disabled={importProgress.status === 'importing'}>
              {importProgress.status === 'completed' ? 'Done' : 'Close'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
