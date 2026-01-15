import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Download, Filter, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
import { ValidationResult, ValidationError, generateImportSummary } from '@/lib/importUtils';

interface ValidationPreviewProps {
  entityType: ImportEntityType;
  validationResult: ValidationResult;
  onExportErrors?: () => void;
}

export function ValidationPreview({
  entityType,
  validationResult,
  onExportErrors
}: ValidationPreviewProps) {
  const [activeTab, setActiveTab] = useState<'valid' | 'invalid'>('valid');
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Eye className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summary.totalRows}</p>
              <p className="text-sm text-muted-foreground">Total Rows</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{summary.validRows}</p>
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
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
                  <p className="text-lg font-medium">All rows are valid!</p>
                  <p className="text-sm text-muted-foreground">
                    No errors found in your data
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {validationResult.invalidRows.map((invalidRow) => (
                    <div key={invalidRow.row} className="p-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-destructive border-destructive">
                          Row {invalidRow.row}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {invalidRow.errors.length} error{invalidRow.errors.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        {invalidRow.errors.map((error, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                            <div>
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
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
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
              You can download the errors, fix them in your spreadsheet, and re-import.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
