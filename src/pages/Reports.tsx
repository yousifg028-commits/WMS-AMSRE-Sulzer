import { useState, useMemo } from 'react';
import { FileText, Download, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { format as fmt, getExpiryStatus, exportToCSV, exportToExcel, printTable } from '../utils/helpers';

type ReportType = 'inventory' | 'stock-movement' | 'expiry' | 'ppe' | 'batch' | 'low-stock' | 'issue-history';

const reportTypes: { value: ReportType; label: string }[] = [
  { value: 'inventory', label: 'Inventory Report' },
  { value: 'stock-movement', label: 'Stock Movement Report' },
  { value: 'expiry', label: 'Expiry Report' },
  { value: 'ppe', label: 'Employee PPE Report' },
  { value: 'batch', label: 'Batch Report' },
  { value: 'low-stock', label: 'Low Stock Report' },
  { value: 'issue-history', label: 'Issue History Report' },
];

export default function Reports() {
  const { masterItems, batchLedger, stockInRecords, stockOutRecords, employees } = useWMSStore();
  const [activeReport, setActiveReport] = useState<ReportType>('inventory');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const reportData = useMemo(() => {
    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    const filterByDate = (dateStr: string) => {
      const d = new Date(dateStr);
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    };

    switch (activeReport) {
      case 'inventory':
        return masterItems.filter(i => i.status === 'Active').map(item => {
          const batches = batchLedger.filter(b => b.itemId === item.id);
          const total = batches.reduce((s, b) => s + b.balance, 0);
          return {
            'Item Code': item.itemCode,
            'Item Name': item.itemName,
            'Category': item.category,
            'Total Qty': total,
            'Reorder Level': item.reorderLevel,
            'Status': total === 0 ? 'Out of Stock' : total <= item.reorderLevel ? 'Low Stock' : 'OK',
          };
        });
      case 'stock-movement':
        return stockInRecords.filter(r => filterByDate(r.receiptDate)).map(r => ({
          'Type': 'Stock In',
          'Reference': r.grnNumber,
          'Date': r.receiptDate,
          'Item': r.itemName,
          'Qty': r.quantity,
          'Batch': r.batchId,
          'Supplier': r.supplier,
        })).concat(
          stockOutRecords.filter(r => filterByDate(r.issueDate)).map(r => ({
            'Type': 'Stock Out',
            'Reference': r.issueNumber,
            'Date': r.issueDate,
            'Item': r.itemName,
            'Qty': r.quantity,
            'Batch': r.batchId,
            'Supplier': r.employeeName,
          }))
        ).sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
      case 'expiry':
        return batchLedger.filter(b => b.balance > 0 && b.expiryDate).map(b => ({
          'Batch ID': b.batchId,
          'Item Code': b.itemCode,
          'Item Name': b.itemName,
          'Expiry Date': fmt(new Date(b.expiryDate), 'dd MMM yyyy'),
          'Balance': b.balance,
          'Status': getExpiryStatus(b.expiryDate),
        }));
      case 'ppe':
        return employees.filter(e => e.status === 'Active').map(emp => {
          const issues = stockOutRecords.filter(r => r.employeeId === emp.id);
          const ppeIssues = issues.filter(r => {
            const item = masterItems.find(i => i.id === r.itemId);
            return item?.trackerGroup === 'PPE';
          });
          return {
            'Employee ID': emp.employeeId,
            'Name': emp.employeeName,
            'Department': emp.department,
            'Total Issues': issues.length,
            'PPE Issues': ppeIssues.length,
            'Last Issue': issues.length > 0 ? fmt(new Date(issues[0].issueDate), 'dd MMM yyyy') : 'N/A',
          };
        });
      case 'batch':
        return batchLedger.filter(b => filterByDate(b.createdAt)).map(b => ({
          'Batch ID': b.batchId,
          'Item Code': b.itemCode,
          'Item Name': b.itemName,
          'DOM': b.dom ? fmt(new Date(b.dom), 'dd MMM yyyy') : '-',
          'Expiry': b.expiryDate ? fmt(new Date(b.expiryDate), 'dd MMM yyyy') : '-',
          'Qty In': b.quantityIn,
          'Qty Out': b.quantityOut,
          'Balance': b.balance,
          'Status': b.status,
        }));
      case 'low-stock': {
        return masterItems.filter(i => i.status === 'Active').filter(item => {
          const total = batchLedger.filter(b => b.itemId === item.id).reduce((s, b) => s + b.balance, 0);
          return total <= item.reorderLevel;
        }).map(item => {
          const total = batchLedger.filter(b => b.itemId === item.id).reduce((s, b) => s + b.balance, 0);
          return {
            'Item Code': item.itemCode,
            'Item Name': item.itemName,
            'Category': item.category,
            'Current Stock': total,
            'Reorder Level': item.reorderLevel,
            'Min Stock': item.minimumStock,
            'Deficit': item.minimumStock - total,
          };
        });
      }
      case 'issue-history':
        return stockOutRecords.filter(r => filterByDate(r.issueDate)).map(r => ({
          'Issue #': r.issueNumber,
          'Date': r.issueDate,
          'Employee': r.employeeName,
          'Item': r.itemName,
          'Qty': r.quantity,
          'Batch': r.batchId,
          'Job #': r.jobNumber,
        }));
      default:
        return [];
    }
  }, [activeReport, masterItems, batchLedger, stockInRecords, stockOutRecords, employees, dateFrom, dateTo]);

  const handlePrint = () => {
    if (reportData.length === 0) return;
    const cols = Object.keys(reportData[0]);
    const rows = reportData.map(row => cols.map(col => String((row as Record<string, unknown>)[col] ?? '')));
    const reportLabel = reportTypes.find(r => r.value === activeReport)?.label || 'Report';
    printTable(reportLabel, cols, rows);
  };

  const handleExport = (format: 'csv' | 'excel') => {
    if (format === 'csv') exportToCSV(reportData, `wms-${activeReport}-report`);
    else exportToExcel(reportData, `wms-${activeReport}-report`);
  };

  const columns = reportData.length > 0 ? Object.keys(reportData[0]) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Generate and export warehouse reports</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => handleExport('csv')} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => handleExport('excel')} className="btn-primary flex items-center gap-2">
            <Download className="w-4 h-4" /> Excel
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Report Type:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {reportTypes.map(rt => (
              <button
                key={rt.value}
                onClick={() => setActiveReport(rt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeReport === rt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4">
          <div>
            <label className="label-field">From Date</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field w-40" />
          </div>
          <div>
            <label className="label-field">To Date</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field w-40" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">
            {reportTypes.find(r => r.value === activeReport)?.label}
          </h3>
          <span className="text-sm text-gray-500">{reportData.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                {columns.map(col => (
                  <th key={col} className="px-4 py-3 text-left">{col}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col} className="table-cell">{String((row as Record<string, unknown>)[col] ?? '')}</td>
                  ))}
                </tr>
              ))}
              {reportData.length === 0 && (
                <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">No data for this report</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
