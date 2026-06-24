import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

export { format } from 'date-fns';

export const generateId = (): string => uuidv4();

export const generateBatchId = (receiptDate: string, sequence: number): string => {
  const dateStr = format(new Date(receiptDate), 'yyyyMMdd');
  return `BATCH-${dateStr}-${String(sequence).padStart(4, '0')}`;
};

export const generateGRN = (sequence: number): string => {
  const dateStr = format(new Date(), 'yyyyMMdd');
  return `GRN-${dateStr}-${String(sequence).padStart(4, '0')}`;
};

export const generateIssueNumber = (sequence: number): string => {
  const dateStr = format(new Date(), 'yyyyMMdd');
  return `ISS-${dateStr}-${String(sequence).padStart(4, '0')}`;
};

export const generateAdjustmentNumber = (sequence: number): string => {
  const dateStr = format(new Date(), 'yyyyMMdd');
  return `ADJ-${dateStr}-${String(sequence).padStart(4, '0')}`;
};

export const formatDate = (date: string): string => {
  return format(new Date(date), 'dd MMM yyyy');
};

export const formatDateTime = (date: string): string => {
  return format(new Date(date), 'dd MMM yyyy HH:mm');
};

export const daysUntilExpiry = (expiryDate: string): number => {
  if (!expiryDate) return 9999;
  const expiry = new Date(expiryDate);
  if (isNaN(expiry.getTime())) return 9999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

export const getExpiryStatus = (expiryDate: string): 'Expired' | 'Near Expiry' | 'Warning' | 'Healthy' => {
  const days = daysUntilExpiry(expiryDate);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Near Expiry';
  if (days <= 90) return 'Warning';
  return 'Healthy';
};

export const getExpiryBadgeClass = (status: string): string => {
  switch (status) {
    case 'Expired': return 'badge-red';
    case 'Near Expiry': return 'badge-red';
    case 'Warning': return 'badge-yellow';
    case 'Healthy': case 'Active': return 'badge-green';
    case 'Depleted': return 'badge-gray';
    default: return 'badge-gray';
  }
};

export const classNames = (...classes: (string | boolean | undefined)[]): string => {
  return classes.filter(Boolean).join(' ');
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
};

export const formatNumber = (value: number): string => {
  return new Intl.NumberFormat('en-US').format(value);
};

const escapeXML = (val: string): string => {
  return val.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
};

const escapeCSV = (val: string): string => {
  if (/^[=+\-@\t\r]/.test(val)) val = "'" + val;
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return '"' + val.replace(/"/g, '""') + '"';
  }
  return val;
};

export const exportToCSV = (data: Record<string, unknown>[], filename: string): void => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.map(h => escapeCSV(h)).join(','),
    ...data.map(row =>
      headers.map(h => escapeCSV(String(row[h] ?? ''))).join(',')
    )
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportToExcel = (data: Record<string, unknown>[], filename: string): void => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Sheet1">
  <Table>
   <Row>${headers.map(h => `<Cell><Data ss:Type="String">${escapeXML(h)}</Data></Cell>`).join('')}</Row>
   ${data.map(row => `<Row>${headers.map(h => `<Cell><Data ss:Type="String">${escapeXML(String(row[h] ?? ''))}</Data></Cell>`).join('')}</Row>`).join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
  const blob = new Blob([xmlContent], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
};

export const printTable = (title: string, headers: string[], rows: (string | number)[][]): void => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; }
      h1 { color: #1e40af; border-bottom: 2px solid #1e40af; padding-bottom: 10px; font-size: 18px; }
      .logo { font-size: 12px; color: #666; margin-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
      th, td { border: 1px solid #ddd; padding: 6px 10px; text-align: left; }
      th { background: #f3f4f6; font-weight: bold; }
      tr:nth-child(even) { background: #f9fafb; }
      @media print { body { padding: 10px; } }
    </style></head><body>
    <div class="logo">AMSER - Sulzer</div>
    <h1>${title}</h1>
    <table>
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
    <p style="margin-top:15px;font-size:10px;color:#999;">Printed on: ${new Date().toLocaleString()}</p>
    <script>window.onload = function() { window.print(); }</script>
    </body></html>
  `);
  printWindow.document.close();
};
