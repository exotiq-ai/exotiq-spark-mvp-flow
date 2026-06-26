import React, { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, FileText, X, Download, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getAllTemplates, downloadTemplate } from '@/lib/importTemplates';
import { ImportEntityType } from '@/lib/importSchemas';
import { useTeam } from '@/contexts/TeamContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onClear: () => void;
  isProcessing?: boolean;
  error?: string | null;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function FileUploadZone({ 
  onFileSelect, 
  selectedFile, 
  onClear,
  isProcessing = false,
  error = null
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const { currentTeam } = useTeam();
  const countryCode = (currentTeam as { country_code?: string } | null)?.country_code || undefined;
  const templates = getAllTemplates(countryCode);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      validateAndSelectFile(files[0]);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSelectFile(files[0]);
    }
    // Reset input
    e.target.value = '';
  }, []);

  const validateAndSelectFile = (file: File) => {
    const fileName = file.name.toLowerCase();
    const isValidType = fileName.endsWith('.csv') || fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    
    if (!isValidType) {
      return; // Will be handled by parent with error state
    }
    
    if (file.size > MAX_FILE_SIZE) {
      return;
    }
    
    onFileSelect(file);
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.csv')) {
      return <FileText className="h-8 w-8 text-green-500" />;
    }
    return <FileSpreadsheet className="h-8 w-8 text-blue-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadTemplate = (entityType: ImportEntityType) => {
    downloadTemplate(entityType);
  };

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      {!selectedFile ? (
        <Card
          className={cn(
            'border-2 border-dashed p-8 transition-all cursor-pointer',
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
            error && 'border-destructive'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInput}
            className="hidden"
          />
          
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className={cn(
              'p-4 rounded-full',
              isDragging ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Upload className={cn(
                'h-8 w-8',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )} />
            </div>
            
            <div>
              <p className="text-lg font-medium">
                {isDragging ? 'Drop your file here' : 'Drag and drop your file here'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                or click to browse
              </p>
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>CSV</span>
              <span className="mx-2">•</span>
              <FileSpreadsheet className="h-4 w-4" />
              <span>Excel (.xlsx, .xls)</span>
              <span className="mx-2">•</span>
              <span>Max 10MB</span>
            </div>
          </div>
        </Card>
      ) : (
        /* Selected File Display */
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getFileIcon(selectedFile.name)}
              <div>
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClear}
              disabled={isProcessing}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {isProcessing && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span>Processing file...</span>
            </div>
          )}
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Template Downloads */}
      <div className="flex items-center justify-between pt-2">
        <p className="text-sm text-muted-foreground">
          Don't have a file ready?
        </p>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Download Template
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-popover">
            {templates.map((template) => (
              <DropdownMenuItem
                key={template.entityType}
                onClick={() => handleDownloadTemplate(template.entityType)}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{template.displayName}</span>
                  <span className="text-xs text-muted-foreground">
                    {template.requiredFields.length} required, {template.optionalFields.length} optional fields
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
