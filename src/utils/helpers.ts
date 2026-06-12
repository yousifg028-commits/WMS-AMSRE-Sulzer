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
  const expiry = new Date(expiryDate);
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

export const exportToCSV = (data: Record<string, unknown>[], filename: string): void => {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = String(row[h] ?? '');
        return val.includes(',') ? `"${val}"` : val;
      }).join(',')
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
   <Row>${headers.map(h => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}</Row>
   ${data.map(row => `<Row>${headers.map(h => `<Cell><Data ss:Type="String">${String(row[h] ?? '')}</Data></Cell>`).join('')}</Row>`).join('\n   ')}
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
