// Centralized Export Utilities for ExotIQ
// Handles CSV, JSON, and PDF export functionality

/**
 * Export data as CSV file
 */
export const exportToCSV = (data: any[], fileName: string) => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        // Handle values with commas, quotes, or newlines
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, `${fileName}.csv`, 'text/csv;charset=utf-8;');
};

/**
 * Export data as JSON file
 */
export const exportToJSON = (data: any, fileName: string) => {
  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, `${fileName}.json`, 'application/json');
};

/**
 * Export data as PDF file
 * Uses HTML template and browser print-to-PDF
 */
export const exportToPDF = async (data: { title: string; content: any; summary?: Record<string, any> }, fileName: string) => {
  // Create a temporary window for printing
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('Could not open print window. Please check your popup blocker.');
  }

  const htmlContent = generatePDFHTML(data);
  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for content to load
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      // Close after printing (user can cancel)
      setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.close();
        }
      }, 100);
    }, 250);
  };
};

/**
 * Generate HTML template for PDF export
 */
const generatePDFHTML = (data: { title: string; content: any; summary?: Record<string, any> }): string => {
  const { title, content, summary } = data;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>${title}</title>
        <style>
          @page {
            margin: 1in;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
            line-height: 1.6;
            color: #1a1a1a;
            max-width: 8.5in;
            margin: 0 auto;
          }
          header {
            border-bottom: 3px solid #2563eb;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
          }
          h1 {
            color: #2563eb;
            font-size: 28px;
            margin: 0 0 0.5rem 0;
          }
          h2 {
            color: #1e40af;
            font-size: 20px;
            margin: 1.5rem 0 0.75rem 0;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 0.25rem;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 1rem 0;
          }
          th, td {
            text-align: left;
            padding: 0.75rem;
            border-bottom: 1px solid #e5e7eb;
          }
          th {
            background-color: #f3f4f6;
            font-weight: 600;
            color: #374151;
          }
          tr:hover {
            background-color: #f9fafb;
          }
          .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 1.5rem 0;
          }
          .summary-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 1rem;
            background: #f9fafb;
          }
          .summary-card-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.25rem;
          }
          .summary-card-value {
            font-size: 24px;
            font-weight: 700;
            color: #1f2937;
          }
          footer {
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #6b7280;
            text-align: center;
          }
          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <header>
          <h1>${title}</h1>
          <p style="color: #6b7280; margin: 0;">Generated: ${new Date().toLocaleString()}</p>
        </header>

        ${summary ? `
          <h2>Summary</h2>
          <div class="summary-grid">
            ${Object.entries(summary).map(([key, value]) => `
              <div class="summary-card">
                <div class="summary-card-label">${formatLabel(key)}</div>
                <div class="summary-card-value">${formatValue(key, value)}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${content.details ? `
          <h2>Details</h2>
          ${generateTable(content.details)}
        ` : generateContent(content)}

        <footer>
          <p>ExotIQ Fleet Management Platform | ${window.location.hostname}</p>
        </footer>
      </body>
    </html>
  `;
};

/**
 * Generate table HTML from array of objects
 */
const generateTable = (data: any[]): string => {
  if (!data || data.length === 0) return '<p>No data available</p>';

  const headers = Object.keys(data[0]);

  return `
    <table>
      <thead>
        <tr>
          ${headers.map(h => `<th>${formatLabel(h)}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${data.map(row => `
          <tr>
            ${headers.map(h => `<td>${formatValue(h, row[h])}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
};

/**
 * Generate generic content HTML
 */
const generateContent = (content: any): string => {
  if (typeof content === 'string') {
    return `<p>${content}</p>`;
  }
  if (Array.isArray(content)) {
    return generateTable(content);
  }
  if (typeof content === 'object') {
    return `<pre>${JSON.stringify(content, null, 2)}</pre>`;
  }
  return String(content);
};

/**
 * Format label for display
 */
const formatLabel = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

/**
 * Format value for display
 */
const formatValue = (key: string, value: any): string => {
  if (value === null || value === undefined) return '-';
  
  const keyLower = key.toLowerCase();
  
  // Currency formatting
  if (keyLower.includes('revenue') || keyLower.includes('price') || keyLower.includes('rate') || keyLower.includes('amount')) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (!isNaN(num)) {
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  }
  
  // Percentage formatting
  if (keyLower.includes('percent') || keyLower.includes('utilization') || key.toLowerCase().includes('rate')) {
    const num = typeof value === 'number' ? value : parseFloat(value);
    if (!isNaN(num) && num <= 100) {
      return `${num}%`;
    }
  }
  
  // Date formatting
  if (keyLower.includes('date') || keyLower.includes('time')) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString();
    }
  }
  
  // Number formatting
  if (typeof value === 'number') {
    return value.toLocaleString();
  }
  
  return String(value);
};

/**
 * Download file helper
 */
const downloadFile = (content: string, fileName: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 100);
};

/**
 * Quick export button helper for components
 */
export const createExportActions = (data: any[], fileName: string) => {
  return {
    exportCSV: () => exportToCSV(data, fileName),
    exportJSON: () => exportToJSON(data, fileName),
    exportPDF: (title: string, summary?: Record<string, any>) => 
      exportToPDF({ title, content: { details: data }, summary }, fileName),
  };
};
