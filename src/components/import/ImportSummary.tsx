import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, ExternalLink, Users, Car, Calendar, MapPin, Download, Image as ImageIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ImportEntityType } from '@/lib/importSchemas';

interface FailedRowInfo {
  row: number;
  errors: { field: string; message: string }[];
}

interface ImportSummaryProps {
  entityType: ImportEntityType;
  stats: {
    imported: number;
    skipped: number;
    failed: number;
    needsAttention: number;
  };
  onClose: () => void;
  onViewData: (module: string) => void;
  fileName?: string;
  columnMappings?: { sourceColumn: string; targetField: string | null }[];
  failedRows?: FailedRowInfo[];
  /** Photo filenames referenced by the CSV but not uploadable (e.g. local Mac paths). */
  photoReferences?: string[];
}

const ENTITY_CONFIG: Record<ImportEntityType, { 
  icon: React.ElementType; 
  label: string; 
  module: string;
  color: string;
}> = {
  vehicles: { icon: Car, label: 'Vehicles', module: 'fleet', color: 'text-primary' },
  customers: { icon: Users, label: 'Customers', module: 'crm', color: 'text-primary' },
  bookings: { icon: Calendar, label: 'Bookings', module: 'book', color: 'text-primary' },
  locations: { icon: MapPin, label: 'Locations', module: 'settings', color: 'text-accent' }
};

function generateReportText(
  entityType: ImportEntityType,
  stats: ImportSummaryProps['stats'],
  fileName?: string,
  columnMappings?: ImportSummaryProps['columnMappings'],
  failedRows?: FailedRowInfo[]
): string {
  const config = ENTITY_CONFIG[entityType];
  const lines: string[] = [];
  const now = new Date();

  lines.push('═══════════════════════════════════════════');
  lines.push('         IMPORT SUMMARY REPORT');
  lines.push('═══════════════════════════════════════════');
  lines.push('');
  lines.push(`Date:        ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`);
  lines.push(`Entity Type: ${config.label}`);
  if (fileName) lines.push(`File:        ${fileName}`);
  lines.push('');

  lines.push('── Results ──────────────────────────────');
  lines.push(`  Imported:   ${stats.imported}`);
  lines.push(`  Skipped:    ${stats.skipped}`);
  lines.push(`  Failed:     ${stats.failed}`);
  const total = stats.imported + stats.skipped + stats.failed;
  const rate = total > 0 ? Math.round((stats.imported / total) * 100) : 0;
  lines.push(`  Total:      ${total}`);
  lines.push(`  Success:    ${rate}%`);
  lines.push('');

  if (columnMappings && columnMappings.length > 0) {
    const mapped = columnMappings.filter(m => m.targetField);
    const skipped = columnMappings.filter(m => !m.targetField);

    lines.push('── Column Mappings ─────────────────────');
    lines.push(`  Mapped: ${mapped.length}  |  Skipped: ${skipped.length}`);
    lines.push('');
    if (mapped.length > 0) {
      lines.push('  Mapped columns:');
      mapped.forEach(m => lines.push(`    ${m.sourceColumn} → ${m.targetField}`));
    }
    if (skipped.length > 0) {
      lines.push('  Skipped columns:');
      skipped.forEach(m => lines.push(`    ${m.sourceColumn}`));
    }
    lines.push('');
  }

  if (failedRows && failedRows.length > 0) {
    lines.push('── Failed Rows ─────────────────────────');
    failedRows.slice(0, 50).forEach(r => {
      lines.push(`  Row ${r.row}:`);
      r.errors.forEach(e => lines.push(`    • ${e.field}: ${e.message}`));
    });
    if (failedRows.length > 50) {
      lines.push(`  ... and ${failedRows.length - 50} more`);
    }
    lines.push('');
  }

  if (stats.needsAttention > 0) {
    lines.push('── Attention Needed ────────────────────');
    lines.push(`  ${stats.needsAttention} record(s) may need review.`);
    lines.push('');
  }

  lines.push('═══════════════════════════════════════════');
  return lines.join('\n');
}

function downloadReport(content: string, entityType: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `import-report-${entityType}-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ImportSummary({ entityType, stats, onClose, onViewData, fileName, columnMappings, failedRows }: ImportSummaryProps) {
  const config = ENTITY_CONFIG[entityType];
  const Icon = config.icon;
  const totalProcessed = stats.imported + stats.skipped + stats.failed;
  const successRate = totalProcessed > 0 ? Math.round((stats.imported / totalProcessed) * 100) : 0;

  const handleDownloadReport = () => {
    const report = generateReportText(entityType, stats, fileName, columnMappings, failedRows);
    downloadReport(report, entityType);
  };

  return (
    <div className="space-y-6">
      {/* Success Header */}
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Import Complete!</h2>
        <p className="text-muted-foreground">
          Your {config.label.toLowerCase()} have been imported successfully
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-primary">{stats.imported}</div>
          <div className="text-sm text-muted-foreground">Imported</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-muted-foreground">{stats.skipped}</div>
          <div className="text-sm text-muted-foreground">Skipped</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold text-destructive">{stats.failed}</div>
          <div className="text-sm text-muted-foreground">Failed</div>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-3xl font-bold">{successRate}%</div>
          <div className="text-sm text-muted-foreground">Success Rate</div>
        </Card>
      </div>

      {/* Needs Attention Alert */}
      {stats.needsAttention > 0 && (
        <Card className="p-4 border-accent/30 bg-accent/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-accent mt-0.5 shrink-0" />
            <div className="flex-1">
              <h4 className="font-medium text-accent-foreground">
                {stats.needsAttention} {stats.needsAttention === 1 ? 'record needs' : 'records need'} attention
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {entityType === 'bookings' 
                  ? 'Some bookings are missing customer or vehicle links. You can link them from the Bookings view.'
                  : 'Some records may have incomplete information that you can complete in the data view.'}
              </p>
            </div>
          </div>
        </Card>
      )}

      <Separator />

      {/* Next Steps */}
      <div className="space-y-3">
        <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          Next Steps
        </h4>
        
        <div className="grid gap-2">
          <Button 
            variant="default" 
            className="w-full justify-between"
            onClick={() => onViewData(config.module)}
          >
            <span className="flex items-center gap-2">
              <Icon className={`w-4 h-4 ${config.color}`} />
              View {config.label}
            </span>
            <ExternalLink className="w-4 h-4" />
          </Button>
          
          {entityType === 'bookings' && stats.needsAttention > 0 && (
            <Button 
              variant="outline" 
              className="w-full justify-between"
              onClick={() => onViewData('book?filter=incomplete')}
            >
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-accent" />
                Review Incomplete Bookings
              </span>
              <Badge variant="outline" className="text-accent border-accent/30">
                {stats.needsAttention}
              </Badge>
            </Button>
          )}

          <Button 
            variant="outline" 
            className="w-full justify-between"
            onClick={handleDownloadReport}
          >
            <span className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Download Import Report
            </span>
          </Button>
          
          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground"
            onClick={onClose}
          >
            Import More Data
          </Button>
        </div>
      </div>

      {/* Quick Tips */}
      <Card className="p-4 bg-muted/30">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          Quick Tips
        </h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          {entityType === 'vehicles' && (
            <>
              <li>• Add photos to your vehicles in the Photo Hub</li>
              <li>• Set up maintenance schedules for each vehicle</li>
            </>
          )}
          {entityType === 'customers' && (
            <>
              <li>• Verify customer license and insurance documents</li>
              <li>• Add notes for VIP customers</li>
            </>
          )}
          {entityType === 'bookings' && (
            <>
              <li>• Link any unmatched customers by email or phone</li>
              <li>• Assign vehicles to bookings from the calendar view</li>
            </>
          )}
          {entityType === 'locations' && (
            <>
              <li>• Set your primary location in Settings</li>
              <li>• Assign staff to each location</li>
            </>
          )}
        </ul>
      </Card>
    </div>
  );
}
