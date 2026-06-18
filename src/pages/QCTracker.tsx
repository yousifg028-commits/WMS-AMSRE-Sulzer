import { useState, useMemo } from 'react';
import { Search, CheckCircle, Eye, ClipboardCheck, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWMSStore } from '../store';
import { format, printTable } from '../utils/helpers';

export default function QCTracker() {
  const { stockInRecords, batchLedger, masterItems } = useWMSStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const qcRecords = useMemo(() => {
    return stockInRecords.filter(r => {
      const item = masterItems.find(i => i.id === r.itemId);
      if (!item || item.trackerGroup !== 'QC') return false;
      const matchSearch = !search || r.itemName.toLowerCase().includes(search.toLowerCase()) || r.itemCode.toLowerCase().includes(search.toLowerCase()) || r.supplier.toLowerCase().includes(search.toLowerCase()) || r.grnNumber.toLowerCase().includes(search.toLowerCase());
      const matchFrom = !dateFrom || r.receiptDate >= dateFrom;
      const matchTo = !dateTo || r.receiptDate <= dateTo;
      return matchSearch && matchFrom && matchTo;
    }).sort((a, b) => new Date(b.receiptDate).getTime() - new Date(a.receiptDate).getTime());
  }, [stockInRecords, masterItems, search, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const totalReceived = qcRecords.reduce((s, r) => s + r.quantity, 0);
    const uniqueSuppliers = new Set(qcRecords.map(r => r.supplier)).size;
    const uniqueItems = new Set(qcRecords.map(r => r.itemId)).size;
    return { count: qcRecords.length, totalReceived, uniqueSuppliers, uniqueItems };
  }, [qcRecords]);

  const detailRecord = stockInRecords.find(r => r.id === showDetail);
  const detailBatch = detailRecord ? batchLedger.find(b => b.batchId === detailRecord.batchId) : null;

  const handlePrint = () => {
    const headers = ['GRN #', 'Date', 'Item', 'Qty', 'Batch', 'Supplier', 'Expiry'];
    const rows = qcRecords.map(r => [
      r.grnNumber, format(new Date(r.receiptDate), 'dd MMM yyyy'),
      `${r.itemCode} - ${r.itemName}`, `${r.quantity} ${r.unit}`, r.batchId,
      r.supplier, r.expiryDate ? format(new Date(r.expiryDate), 'dd MMM yy') : '-',
    ]);
    printTable('QC Tracker', headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">QC Tracker</h1>
            <p className="text-sm text-gray-500">Quality Control - Track received materials inspection</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => navigate('/qc-form')} className="btn-primary flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4" /> QC Form
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Receipts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.count}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Received Qty</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.totalReceived}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Unique Items</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.uniqueItems}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Suppliers</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stats.uniqueSuppliers}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by GRN, item, supplier..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <div>
            <label className="label-field">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field w-36" />
          </div>
          <div>
            <label className="label-field">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field w-36" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">GRN #</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {qcRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-green-600">{record.grnNumber}</td>
                  <td className="table-cell">{format(new Date(record.receiptDate), 'dd MMM yyyy')}</td>
                  <td className="table-cell">{record.itemCode} - {record.itemName}</td>
                  <td className="table-cell text-right font-bold">{record.quantity} {record.unit}</td>
                  <td className="table-cell font-mono text-xs">{record.batchId}</td>
                  <td className="table-cell">{record.supplier}</td>
                  <td className="table-cell">{record.expiryDate ? format(new Date(record.expiryDate), 'dd MMM yy') : '-'}</td>
                  <td className="table-cell text-center">
                    <button onClick={() => setShowDetail(record.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {qcRecords.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No QC records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {qcRecords.length} records</div>
      </div>

      {showDetail && detailRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">QC Receipt Detail</h3>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {Object.entries({
                'GRN #': detailRecord.grnNumber,
                'Date': format(new Date(detailRecord.receiptDate), 'dd MMM yyyy'),
                'Item': `${detailRecord.itemCode} - ${detailRecord.itemName}`,
                'Qty Received': `${detailRecord.quantity} ${detailRecord.unit}`,
                'Batch': detailRecord.batchId,
                'DOM': detailRecord.dom ? format(new Date(detailRecord.dom), 'dd MMM yyyy') : '-',
                'Expiry': detailRecord.expiryDate ? format(new Date(detailRecord.expiryDate), 'dd MMM yyyy') : '-',
                'Supplier': detailRecord.supplier,
                'Location': detailRecord.warehouseLocation,
                'Current Balance': detailBatch?.balance ?? '-',
                'Remarks': detailRecord.remarks || '-',
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">{k}</span>
                  <span className="text-sm font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
