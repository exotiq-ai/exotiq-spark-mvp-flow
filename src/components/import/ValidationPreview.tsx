import React, { useState, useCallback } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Download, Edit2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { ImportEntityType, getImportSchema } from '@/lib/importSchemas';
import { ValidationResult, ValidationError, generateImportSummary, validateRows } from '@/lib/importUtils';

interface ValidationPreviewProps {
  entityType: ImportEntityType;
  validationResult: ValidationResult;
  onExportErrors?: () => void;
  onFixRow?: (rowIndex: number, updatedData: Record<string, unknown>) => void;
  onValidationUpdate?: (result: ValidationResult) => void;
}

// Quick fix suggestions for common validation errors
const QUICK_FIX_SUGGESTIONS: Record<string, { type: 'select' | 'input'; options?: string[] }> = {
  status: { type: 'select', options: ['pending', 'confirmed', 'completed', 'cancelled', 'active'] },
  customer_status: { type: 'select', options: ['active', 'inactive', 'blacklisted'] },
  payment_status: { type: 'select', options: ['pending', 'partial', 'paid', 'overdue'] },
};

export function ValidationPreview({
  entityType,
  validationResult,
  onExportErrors,
  onFixRow,
  onValidationUpdate
}: ValidationPreviewProps) {
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('valid');
  const [editingRow, setEditingRow] = useState<number | null>(null);
  const [editedData, setEditedData] = useState<Record<string, unknown>>({});
  const schema = getImportSchema(entityType);
  const summary = generateImportSummary(validationResult);
  
  // Get visible fields (first 5)
  const visibleFields = schema.fields.slice(0, 5);

  const handleExportErrors = () => {
    if (!onExportErrors) {
      // Default export implementation
      const errors = validationResult.invalidRows.map(row => ({
        row: row.row,
        ...row.data,
        errors: row.errors.map(e => `${e.field}: ${e.message}`).join('; ')
      }));
      
      const headers = ['row', ...Object.keys(validationResult.invalidRows[0]?.data || {}), 'errors'];
      const csv = [
        headers.join(','),
        ...errors.map(e => headers.map(h => `"${String(e[h as keyof typeof e] || '').replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'import_errors.csv';
      link.click();
      URL.revokeObjectURL(url);
    } else {
      onExportErrors();
    }
  };

  const handleStartEdit = (rowIndex: number, rowData: Record<string, unknown>) => {
    setEditingRow(rowIndex);
    setEditedData({ ...rowData });
  };

  const handleCancelEdit = () => {
    setEditingRow(null);
    setEditedData({});
  };

  const handleSaveEdit = useCallback((rowIndex: number) => {
    if (!onValidationUpdate) return;
    
    // Re-validate the edited row
    const result = validateRows([editedData], entityType);
    
    if (result.validRows.length > 0) {
      // Row is now valid - move it from invalid to valid
      const newValidRows = [...validationResult.validRows, editedData];
      const newInvalidRows = validationResult.invalidRows.filter(r => r.row !== rowIndex + 1);
      
      onValidationUpdate({
        isValid: newInvalidRows.length === 0,
        errors: newInvalidRows.flatMap(r => r.errors),
        validRows: newValidRows,
        invalidRows: newInvalidRows
      });
    } else {
      // Still invalid but with possibly different errors
      const newInvalidRows = validationResult.invalidRows.map(r => {
        if (r.row === rowIndex + 1) {
          return {
            row: r.row,
            data: editedData,
            errors: result.invalidRows[0]?.errors || r.errors
          };
        }
        return r;
      });
      
      onValidationUpdate({
        isValid: false,
        errors: newInvalidRows.flatMap(r => r.errors),
        validRows: validationResult.validRows,
        invalidRows: newInvalidRows
      });
    }
    
    setEditingRow(null);
    setEditedData({});
  }, [editedData, entityType, validationResult, onValidationUpdate]);

  const handleQuickFix = (field: string, value: string) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const renderQuickFix = (error: ValidationError) => {
    const suggestion = QUICK_FIX_SUGGESTIONS[error.field];
    if (!suggestion) {
      // Default to text input for unknown fields
      return (
        <Input
          type="text"
          className="h-7 text-xs w-32"
          placeholder="Enter value..."
          value={String(editedData[error.field] || '')}
          onChange={(e) => handleQuickFix(error.field, e.target.value)}
        />
      );
    }
    
    if (suggestion.type === 'select' && suggestion.options) {
      const currentValue = editedData[error.field];
      const selectValue = currentValue ? String(currentValue) : '__empty__';
      return (
        <Select
          value={selectValue}
          onValueChange={(val) => handleQuickFix(error.field, val === '__empty__' ? '' : val)}
        >
          <SelectTrigger className="h-7 text-xs w-32">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__empty__" className="text-xs text-muted-foreground">
              -- None --
            </SelectItem>
            {suggestion.options.map(opt => (
              <SelectItem key={opt} value={opt} className="text-xs">
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    
    return (
      <Input
        type="text"
        className="h-7 text-xs w-32"
        value={String(editedData[error.field] || '')}
        onChange={(e) => handleQuickFix(error.field, e.target.value)}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalRows}</p>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold text-success">{summary.validRows}</p>
              <p className="text-sm text-muted-foreground">Ready to Import</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-destructive">{summary.invalidRows}</p>
              <p className="text-sm text-muted-foreground">With Errors</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Success Rate Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Validation Success Rate</span>
          <span className="font-medium">{summary.successRate}%</span>
        </div>
        <Progress value={summary.successRate} className="h-2" />
      </div>

      {/* Data Preview Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'valid' | 'invalid')}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="valid" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Valid ({summary.validRows})
            </TabsTrigger>
            <TabsTrigger value="invalid" className="gap-2">
              <XCircle className="h-4 w-4" />
              Errors ({summary.invalidRows})
            </TabsTrigger>
          </TabsList>
          
          {activeTab === 'invalid' && summary.invalidRows > 0 && (
            <Button variant="outline" size="sm" onClick={handleExportErrors}>
              <Download className="h-4 w-4 mr-2" />
              Export Errors
            </Button>
          )}
        </div>

        {/* Valid Rows Tab */}
        <TabsContent value="valid" className="mt-4">
          <Card>
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {visibleFields.map(field => (
                      <TableHead key={field.name}>
                        {field.label}
                        {field.required && <span className="text-destructive">*</span>}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validationResult.validRows.length === 0 ? (
                    <TableRow>
                      <TableCell 
                        colSpan={visibleFields.length + 1} 
                        className="text-center text-muted-foreground py-8"
                      >
                        No valid rows to display
                      </TableCell>
                    </TableRow>
                  ) : (
                    validationResult.validRows.slice(0, 50).map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                        {visibleFields.map(field => (
                          <TableCell key={field.name} className="max-w-[200px] truncate">
                            {String(row[field.name] ?? '-')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            {validationResult.validRows.length > 50 && (
              <div className="p-3 border-t text-center text-sm text-muted-foreground">
                Showing 50 of {validationResult.validRows.length} valid rows
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Invalid Rows Tab */}
        <TabsContent value="invalid" className="mt-4">
          <Card>
            <ScrollArea className="h-[300px]">
              {validationResult.invalidRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 text-success mb-4" />
                  <p className="text-lg font-medium">All rows are valid!</p>
                  <p className="text-sm text-muted-foreground">
                    No errors found in your data
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {validationResult.invalidRows.map((invalidRow) => {
                    const isEditing = editingRow === invalidRow.row - 1;
                    
                    return (
                      <div key={invalidRow.row} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-destructive border-destructive">
                              Row {invalidRow.row}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {invalidRow.errors.length} error{invalidRow.errors.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          
                          {onValidationUpdate && (
                            <div className="flex gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    className="h-7 px-2"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleSaveEdit(invalidRow.row - 1)}
                                    className="h-7 px-2"
                                  >
                                    <Check className="h-3 w-3 mr-1" />
                                    Save
                                  </Button>
                                </>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleStartEdit(invalidRow.row - 1, invalidRow.data)}
                                  className="h-7 px-2"
                                >
                                  <Edit2 className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          {invalidRow.errors.map((error, i) => (
                            <div key={i} className="flex items-start gap-2 text-sm">
                              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                              <div className="flex-1">
                                <span className="font-medium">{error.field}:</span>
                                <span className="text-muted-foreground ml-1">{error.message}</span>
                                {error.value !== undefined && error.value !== null && error.value !== '' && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    (value: "{String(error.value)}")
                                  </span>
                                )}
                                {error.suggestion && (
                                  <p className="text-xs text-primary mt-0.5">
                                    💡 {error.suggestion}
                                  </p>
                                )}
                                
                                {/* Quick Fix Controls */}
                                {isEditing && (
                                  <div className="mt-2 flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground">Quick fix:</span>
                                    {renderQuickFix(error)}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Warning for skipped rows */}
      {summary.invalidRows > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-sm">Some rows will be skipped</p>
            <p className="text-sm text-muted-foreground">
              {summary.invalidRows} row{summary.invalidRows > 1 ? 's' : ''} with errors will not be imported. 
              {onValidationUpdate 
                ? ' Click "Edit" to fix errors inline, or download and fix in your spreadsheet.'
                : ' You can download the errors, fix them in your spreadsheet, and re-import.'
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
