import { FileCheck2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { HQ_IMPORT_TAG, HqImportReport } from '@/lib/hqRentalCustomers';

/** What the HQ Rental preset did to the file, shown on the upload and preview steps. */
export function HqImportBanner({ report }: { report: HqImportReport }) {
  const skipped = report.skippedNoEmail;
  return (
    <Card className="p-4 border-primary/40 bg-primary/5" data-testid="hq-import-banner">
      <div className="flex items-start gap-3">
        <FileCheck2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-2 text-sm min-w-0">
          <p className="font-medium">HQ Rental customer export recognised</p>
          <p>
            {report.rows} {report.rows === 1 ? 'row' : 'rows'} → <strong>{report.customers} {report.customers === 1 ? 'customer' : 'customers'}</strong>
          </p>
          <ul className="space-y-1 text-muted-foreground">
            {report.mergedRows > 0 && (
              <li>
                {report.mergedRows} {report.mergedRows === 1 ? 'row shares' : 'rows share'} an email with another row. Each email becomes one
                customer; the other names are kept in its notes.
              </li>
            )}
            {skipped.length > 0 && (
              <li>
                {skipped.length} {skipped.length === 1 ? 'row has' : 'rows have'} no email and {skipped.length === 1 ? 'is' : 'are'} left out:
                every customer needs an email. Add {skipped.length === 1 ? 'it' : 'them'} by hand.
                <details className="mt-1">
                  <summary className="cursor-pointer text-foreground">Show {skipped.length === 1 ? 'it' : `the ${skipped.length}`}</summary>
                  <ul className="mt-1 max-h-40 overflow-y-auto pl-4 list-disc">
                    {skipped.map((p, i) => (
                      <li key={i}>
                        {p.name || 'No name'}
                        {p.phone ? ` · ${p.phone}` : ''}
                      </li>
                    ))}
                  </ul>
                </details>
              </li>
            )}
            {report.expiredLicences > 0 && (
              <li>
                {report.expiredLicences} {report.expiredLicences === 1 ? 'customer has' : 'customers have'} an expired driver's licence.
              </li>
            )}
            <li>Every customer is tagged “{HQ_IMPORT_TAG}”; HQ reservation counts go in notes.</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}
