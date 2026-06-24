import { useState, useMemo } from 'react';
import { Search, PenTool, Eye, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { format, printTable } from '../utils/helpers';

export default function StationeryTracker() {
  const { stockOutRecords, masterItems } = useWMSStore();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const stationeryRecords = useMemo(() => {
    return stockOutRecords.filter(r => {
      const item = masterItems.find(i => i.id === r.itemId);
      if (!item || item.trackerGroup !== 'Stationery') return false;
      const matchSearch = !search || r.itemName.toLowerCase().includes(search.toLowerCase()) || r.employeeName.toLowerCase().includes(search.toLowerCase());
      const matchFrom = !dateFrom || r.issueDate >= dateFrom;
      const matchTo = !dateTo || r.issueDate <= dateTo;
      return matchSearch && matchFrom && matchTo;
    }).sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [stockOutRecords, masterItems, search, dateFrom, dateTo]);
  const detailRecord = stockOutRecords.find(r => r.id === showDetail);

  const handlePrint = () => {
    const headers = ['Date', 'Employee', 'Item', 'Qty', 'Batch', 'Job #'];
    const rows = stationeryRecords.map(r => [
      format(new Date(r.issueDate), 'dd MMM yyyy'), r.employeeName,
      `${r.itemCode} - ${r.itemName}`, r.quantity, r.batchId, r.jobNumber || '-',
    ]);
    printTable('Stationery Tracker', headers, rows);
  };

  const stats = useMemo(() => {
    const total = stationeryRecords.reduce((s, r) => s + r.quantity, 0);
    const uniqueEmp = new Set(stationeryRecords.map(r => r.employeeId)).size;
    return { count: stationeryRecords.length, totalQty: total, uniqueEmp };
  }, [stationeryRecords]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
            <PenTool className="w-5 h-5 text-yellow-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Stationery Tracker</h1>
            <p className="text-sm text-gray-500">Track stationery and office supplies consumption</p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Issues</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.count}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Qty</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.totalQty}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Recipients</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.uniqueEmp}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
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
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Job #</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stationeryRecords.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="table-cell">{format(new Date(record.issueDate), 'dd MMM yyyy')}</td>
                  <td className="table-cell font-medium">{record.employeeName}</td>
                  <td className="table-cell">{record.itemCode} - {record.itemName}</td>
                  <td className="table-cell text-right font-bold">{record.quantity}</td>
                  <td className="table-cell font-mono text-xs">{record.batchId}</td>
                  <td className="table-cell">{record.jobNumber || '-'}</td>
                  <td className="table-cell text-center">
                    <button onClick={() => setShowDetail(record.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {stationeryRecords.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No stationery records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {stationeryRecords.length} records</div>
      </div>

      {showDetail && detailRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Issue Detail</h3>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {Object.entries({
                'Issue #': detailRecord.issueNumber,
                'Date': format(new Date(detailRecord.issueDate), 'dd MMM yyyy'),
                'Employee': detailRecord.employeeName,
                'Item': `${detailRecord.itemCode} - ${detailRecord.itemName}`,
                'Qty': detailRecord.quantity,
                'Batch': detailRecord.batchId,
                'Job #': detailRecord.jobNumber || '-',
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
