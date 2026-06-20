import { useState, useMemo } from 'react';
import { Plus, Search, Calculator, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { format, getExpiryStatus, printTable } from '../utils/helpers';

const categories = ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality'];

export default function InventoryControl() {
  const { masterItems, batchLedger, stockAdjustments, createStockAdjustment } = useWMSStore();
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showCycleCount, setShowCycleCount] = useState(false);
  const [physicalCounts, setPhysicalCounts] = useState<Record<string, number>>({});
  const [adjustForm, setAdjustForm] = useState({
    adjustmentDate: format(new Date(), 'yyyy-MM-dd'),
    itemId: '',
    batchId: '',
    adjustmentType: 'Addition' as 'Addition' | 'Deduction' | 'Reconciliation',
    quantityAdjusted: 0,
    reason: '',
    approvedBy: 'admin',
  });

  const activeItems = masterItems.filter(i => i.status === 'Active');

  const inventoryData = useMemo(() => {
    return activeItems.map(item => {
      const batches = batchLedger.filter(b => b.itemId === item.id);
      const totalQty = batches.reduce((s, b) => s + b.balance, 0);
      const available = totalQty;
      const reserved = 0;
      const batchCount = batches.length;
      const activeBatches = batches.filter(b => b.balance > 0);
      const expiredBatches = activeBatches.filter(b => {
        const dateToCheck = b.expiryDate || b.bbd || '';
        if (!dateToCheck) return false;
        return getExpiryStatus(dateToCheck) === 'Expired';
      }).length;
      const nearExpiryBatches = activeBatches.filter(b => {
        const dateToCheck = b.expiryDate || b.bbd || '';
        if (!dateToCheck) return false;
        const status = getExpiryStatus(dateToCheck);
        return status === 'Near Expiry' || status === 'Warning';
      }).length;
      const batchesWithoutDate = activeBatches.filter(b => !b.expiryDate && !b.bbd).length;
      const isLow = totalQty <= item.reorderLevel && totalQty > 0;
      const isOut = totalQty === 0;
      return {
        ...item,
        totalQty,
        available,
        reserved,
        batchCount,
        expiredBatches,
        nearExpiryBatches,
        batchesWithoutDate,
        isLow,
        isOut,
      };
    });
  }, [activeItems, batchLedger]);

  const filtered = useMemo(() => {
    return inventoryData.filter(item => {
      const matchSearch = !search || item.itemCode.toLowerCase().includes(search.toLowerCase()) || item.itemName.toLowerCase().includes(search.toLowerCase());
      const matchCat = !filterCat || item.category === filterCat;
      return matchSearch && matchCat;
    });
  }, [inventoryData, search, filterCat]);

  const handlePrint = () => {
    const headers = ['Item Code', 'Item Name', 'Category', 'Total Qty', 'Available', 'Reorder Lvl', 'Batches', 'Expired', 'Near Exp', 'No Date', 'Status'];
    const rows = filtered.map(item => [
      item.itemCode, item.itemName, item.category, item.totalQty, item.available,
      item.reorderLevel, item.batchCount, item.expiredBatches, item.nearExpiryBatches,
      item.batchesWithoutDate, item.isOut ? 'Out of Stock' : item.isLow ? 'Low Stock' : 'OK',
    ]);
    printTable('Inventory Control', headers, rows);
  };

  const handleAdjust = () => {
    if (!adjustForm.itemId || !adjustForm.batchId || adjustForm.quantityAdjusted <= 0) return;
    const batch = batchLedger.find(b => b.batchId === adjustForm.batchId);
    if (!batch) return;

    let quantityAfter: number;
    if (adjustForm.adjustmentType === 'Addition') {
      quantityAfter = batch.balance + adjustForm.quantityAdjusted;
    } else if (adjustForm.adjustmentType === 'Deduction') {
      quantityAfter = Math.max(0, batch.balance - adjustForm.quantityAdjusted);
    } else {
      quantityAfter = adjustForm.quantityAdjusted;
    }

    createStockAdjustment({
      adjustmentDate: adjustForm.adjustmentDate,
      itemId: adjustForm.itemId,
      itemCode: batch.itemCode,
      itemName: batch.itemName,
      batchId: adjustForm.batchId,
      adjustmentType: adjustForm.adjustmentType,
      quantityBefore: batch.balance,
      quantityAdjusted: adjustForm.quantityAdjusted,
      quantityAfter,
      reason: adjustForm.reason,
      approvedBy: adjustForm.approvedBy,
      createdBy: 'admin',
    });
    setShowAdjustModal(false);
  };

  const selectedItemBatches = adjustForm.itemId
    ? batchLedger.filter(b => b.itemId === adjustForm.itemId && b.balance > 0)
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Control</h1>
          <p className="text-sm text-gray-500 mt-1">Current balances, adjustments, and cycle counts</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={() => setShowCycleCount(!showCycleCount)} className="btn-secondary flex items-center gap-2">
            <Calculator className="w-4 h-4" /> Cycle Count
          </button>
          <button onClick={() => setShowAdjustModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Stock Adjustment
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{inventoryData.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Stock</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{inventoryData.reduce((s, i) => s + i.totalQty, 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Low Stock Items</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{inventoryData.filter(i => i.isLow).length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Adjustments Today</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stockAdjustments.filter(a => a.adjustmentDate === format(new Date(), 'yyyy-MM-dd')).length}</p>
        </div>
      </div>

      {showCycleCount && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Cycle Count Sheet</h3>
            <button onClick={() => setPhysicalCounts({})} className="text-sm text-blue-600 hover:underline">Clear All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Item Code</th>
                  <th className="px-4 py-3 text-left">Item Name</th>
                  <th className="px-4 py-3 text-right">System Qty</th>
                  <th className="px-4 py-3 text-right">Physical Qty</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(item => {
                  const physical = physicalCounts[item.id];
                  const variance = physical !== undefined ? physical - item.totalQty : null;
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium">{item.itemCode}</td>
                      <td className="table-cell">{item.itemName}</td>
                      <td className="table-cell text-right font-medium">{item.totalQty}</td>
                      <td className="table-cell text-right">
                        <input type="number" min="0" className="w-24 text-right input-field py-1" placeholder="-"
                          value={physicalCounts[item.id] ?? ''}
                          onChange={(e) => setPhysicalCounts({ ...physicalCounts, [item.id]: +e.target.value })} />
                      </td>
                      <td className="table-cell text-right font-medium">
                        {variance !== null ? (
                          variance === 0 ? <span className="text-green-600">0</span>
                          : <span className="text-red-600">{variance > 0 ? '+' : ''}{variance}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="select-field w-40">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Item Code</th>
                <th className="px-4 py-3 text-left">Item Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Total Qty</th>
                <th className="px-4 py-3 text-right">Available</th>
                <th className="px-4 py-3 text-right">Reorder Lvl</th>
                <th className="px-4 py-3 text-center">Batches</th>
                <th className="px-4 py-3 text-center">Expired</th>
                <th className="px-4 py-3 text-center">Near Exp</th>
                <th className="px-4 py-3 text-center">No Date</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-blue-600">{item.itemCode}</td>
                  <td className="table-cell">{item.itemName}</td>
                  <td className="table-cell">{item.category}</td>
                  <td className="table-cell text-right font-bold">{item.totalQty}</td>
                  <td className="table-cell text-right">{item.available}</td>
                  <td className="table-cell text-right">{item.reorderLevel}</td>
                  <td className="table-cell text-center">{item.batchCount}</td>
                  <td className="table-cell text-center">
                    {item.expiredBatches > 0 ? <span className="badge-red">{item.expiredBatches}</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="table-cell text-center">
                    {item.nearExpiryBatches > 0 ? <span className="badge-yellow">{item.nearExpiryBatches}</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="table-cell text-center">
                    {item.batchesWithoutDate > 0 ? <span className="badge-orange">{item.batchesWithoutDate}</span> : <span className="text-gray-400">0</span>}
                  </td>
                  <td className="table-cell text-center">
                    {item.isOut ? <span className="badge-red">Out of Stock</span>
                      : item.isLow ? <span className="badge-yellow">Low Stock</span>
                      : <span className="badge-green">OK</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {stockAdjustments.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Recent Adjustments</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Adj #</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Item</th>
                  <th className="px-4 py-3 text-left">Batch</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-right">Before</th>
                  <th className="px-4 py-3 text-right">Adjusted</th>
                  <th className="px-4 py-3 text-right">After</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stockAdjustments.map(adj => (
                  <tr key={adj.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium">{adj.adjustmentNumber}</td>
                    <td className="table-cell">{format(new Date(adj.adjustmentDate), 'dd MMM yyyy')}</td>
                    <td className="table-cell">{adj.itemName}</td>
                    <td className="table-cell font-mono text-xs">{adj.batchId}</td>
                    <td className="table-cell">
                      <span className={adj.adjustmentType === 'Addition' ? 'badge-green' : adj.adjustmentType === 'Deduction' ? 'badge-red' : 'badge-blue'}>
                        {adj.adjustmentType}
                      </span>
                    </td>
                    <td className="table-cell text-right">{adj.quantityBefore}</td>
                    <td className="table-cell text-right font-medium">{adj.quantityAdjusted}</td>
                    <td className="table-cell text-right font-bold">{adj.quantityAfter}</td>
                    <td className="table-cell text-gray-500">{adj.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal isOpen={showAdjustModal} onClose={() => setShowAdjustModal(false)} title="Stock Adjustment" maxWidth="max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Adjustment Date *</label>
            <input type="date" value={adjustForm.adjustmentDate} onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Adjustment Type *</label>
            <select value={adjustForm.adjustmentType} onChange={(e) => setAdjustForm({ ...adjustForm, adjustmentType: e.target.value as typeof adjustForm.adjustmentType })} className="select-field">
              <option value="Addition">Addition</option>
              <option value="Deduction">Deduction</option>
              <option value="Reconciliation">Reconciliation</option>
            </select>
          </div>
          <div>
            <label className="label-field">Item *</label>
            <select value={adjustForm.itemId} onChange={(e) => setAdjustForm({ ...adjustForm, itemId: e.target.value, batchId: '' })} className="select-field">
              <option value="">Select item</option>
              {activeItems.map(i => <option key={i.id} value={i.id}>{i.itemCode} - {i.itemName}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Batch *</label>
            <select value={adjustForm.batchId} onChange={(e) => setAdjustForm({ ...adjustForm, batchId: e.target.value })} className="select-field" disabled={!adjustForm.itemId}>
              <option value="">Select batch</option>
              {selectedItemBatches.map(b => (
                <option key={b.batchId} value={b.batchId}>{b.batchId} (Bal: {b.balance})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Quantity *</label>
            <input type="number" min="1" value={adjustForm.quantityAdjusted || ''} onChange={(e) => setAdjustForm({ ...adjustForm, quantityAdjusted: +e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Approved By</label>
            <input type="text" value={adjustForm.approvedBy} onChange={(e) => setAdjustForm({ ...adjustForm, approvedBy: e.target.value })} className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="label-field">Reason *</label>
            <textarea value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} className="input-field" rows={2} placeholder="Reason for adjustment..." />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowAdjustModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleAdjust} className="btn-primary">Apply Adjustment</button>
        </div>
      </Modal>
    </div>
  );
}
