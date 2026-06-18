import { useState, useMemo } from 'react';
import { Search, History, ArrowDown, ArrowUp, RefreshCw, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { format, printTable } from '../utils/helpers';

export default function InventoryHistory() {
  const { stockInRecords, stockOutRecords, stockAdjustments } = useWMSStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const allTransactions = useMemo(() => {
    const txns = [
      ...stockInRecords.map(r => ({
        type: 'Stock In' as const,
        date: r.receiptDate,
        reference: r.grnNumber,
        itemCode: r.itemCode,
        itemName: r.itemName,
        quantity: r.quantity,
        batchId: r.batchId,
        details: `From: ${r.supplier}`,
        createdAt: r.createdAt,
      })),
      ...stockOutRecords.map(r => ({
        type: 'Stock Out' as const,
        date: r.issueDate,
        reference: r.issueNumber,
        itemCode: r.itemCode,
        itemName: r.itemName,
        quantity: -r.quantity,
        batchId: r.batchId,
        details: `To: ${r.employeeName}${r.jobNumber ? ' | Job: ' + r.jobNumber : ''}`,
        createdAt: r.createdAt,
      })),
      ...stockAdjustments.map(r => ({
        type: 'Adjustment' as const,
        date: r.adjustmentDate,
        reference: r.adjustmentNumber,
        itemCode: r.itemCode,
        itemName: r.itemName,
        quantity: r.adjustmentType === 'Deduction' ? -r.quantityAdjusted : r.quantityAdjusted,
        batchId: r.batchId,
        details: `${r.adjustmentType}: ${r.reason}`,
        createdAt: r.createdAt,
      })),
    ];

    return txns.filter(txn => {
      const matchSearch = !search || txn.reference.toLowerCase().includes(search.toLowerCase()) || txn.itemName.toLowerCase().includes(search.toLowerCase()) || txn.itemCode.toLowerCase().includes(search.toLowerCase());
      const matchType = !filterType || txn.type === filterType;
      const matchFrom = !dateFrom || txn.date >= dateFrom;
      const matchTo = !dateTo || txn.date <= dateTo;
      return matchSearch && matchType && matchFrom && matchTo;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [stockInRecords, stockOutRecords, stockAdjustments, search, filterType, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const stockIn = allTransactions.filter(t => t.type === 'Stock In').length;
    const stockOut = allTransactions.filter(t => t.type === 'Stock Out').length;
    const adj = allTransactions.filter(t => t.type === 'Adjustment').length;
    return { total: allTransactions.length, stockIn, stockOut, adj };
  }, [allTransactions]);

  const handlePrint = () => {
    const headers = ['Type', 'Date', 'Reference', 'Item', 'Qty', 'Batch', 'Details'];
    const rows = allTransactions.map(txn => [
      txn.type, format(new Date(txn.date), 'dd MMM yyyy'), txn.reference,
      `${txn.itemCode} - ${txn.itemName}`, txn.quantity, txn.batchId, txn.details,
    ]);
    printTable('Inventory History', headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <History className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inventory History</h1>
            <p className="text-sm text-gray-500">Complete log of all inventory movements</p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Transactions</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <ArrowDown className="w-4 h-4 text-green-500" />
            <p className="text-xs font-medium text-gray-500 uppercase">Stock In</p>
          </div>
          <p className="text-2xl font-bold text-green-600 mt-1">{stats.stockIn}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <ArrowUp className="w-4 h-4 text-red-500" />
            <p className="text-xs font-medium text-gray-500 uppercase">Stock Out</p>
          </div>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.stockOut}</p>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-medium text-gray-500 uppercase">Adjustments</p>
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.adj}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search reference, item..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="select-field w-36">
            <option value="">All Types</option>
            <option value="Stock In">Stock In</option>
            <option value="Stock Out">Stock Out</option>
            <option value="Adjustment">Adjustment</option>
          </select>
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
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Reference</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-left">Batch</th>
                <th className="px-4 py-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {allTransactions.map((txn, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="table-cell">
                    <span className={txn.type === 'Stock In' ? 'badge-green' : txn.type === 'Stock Out' ? 'badge-red' : 'badge-blue'}>
                      {txn.type}
                    </span>
                  </td>
                  <td className="table-cell">{format(new Date(txn.date), 'dd MMM yyyy')}</td>
                  <td className="table-cell font-medium">{txn.reference}</td>
                  <td className="table-cell">{txn.itemCode} - {txn.itemName}</td>
                  <td className={`table-cell text-right font-bold ${txn.quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {txn.quantity > 0 ? '+' : ''}{txn.quantity}
                  </td>
                  <td className="table-cell font-mono text-xs">{txn.batchId}</td>
                  <td className="table-cell text-gray-500 text-xs">{txn.details}</td>
                </tr>
              ))}
              {allTransactions.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No transactions found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {allTransactions.length} transactions</div>
      </div>
    </div>
  );
}
