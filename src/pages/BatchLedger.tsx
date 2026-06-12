import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { useWMSStore } from '../store';
import { format as fmt, getExpiryStatus, daysUntilExpiry, getExpiryBadgeClass } from '../utils/helpers';

export default function BatchLedger() {
  const { batchLedger, masterItems } = useWMSStore();
  const [search, setSearch] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const enriched = useMemo(() => {
    return batchLedger.map(b => ({
      ...b,
      expiryStatus: getExpiryStatus(b.expiryDate),
      daysLeft: daysUntilExpiry(b.expiryDate),
    }));
  }, [batchLedger]);

  const filtered = useMemo(() => {
    return enriched.filter(b => {
      const matchSearch = !search || b.batchId.toLowerCase().includes(search.toLowerCase()) || b.itemName.toLowerCase().includes(search.toLowerCase()) || b.itemCode.toLowerCase().includes(search.toLowerCase());
      const matchItem = !filterItem || b.itemId === filterItem;
      const matchStatus = !filterStatus || b.status === filterStatus;
      return matchSearch && matchItem && matchStatus;
    });
  }, [enriched, search, filterItem, filterStatus]);

  const summaryStats = useMemo(() => {
    const active = enriched.filter(b => b.status === 'Active' && b.balance > 0).length;
    const nearExpiry = enriched.filter(b => b.expiryStatus === 'Near Expiry' && b.balance > 0).length;
    const expired = enriched.filter(b => b.expiryStatus === 'Expired' && b.balance > 0).length;
    const depleted = enriched.filter(b => b.balance === 0).length;
    const totalBalance = enriched.reduce((s, b) => s + b.balance, 0);
    return { active, nearExpiry, expired, depleted, totalBalance };
  }, [enriched]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Batch Ledger</h1>
        <p className="text-sm text-gray-500 mt-1">Track every batch separately</p>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Batches</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{enriched.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{summaryStats.active}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Near Expiry</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{summaryStats.nearExpiry}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Expired</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{summaryStats.expired}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Balance</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{summaryStats.totalBalance}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by batch ID, item code, or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={filterItem} onChange={(e) => setFilterItem(e.target.value)} className="select-field w-48">
            <option value="">All Items</option>
            {masterItems.filter(i => i.status === 'Active').map(i => (
              <option key={i.id} value={i.id}>{i.itemCode} - {i.itemName}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select-field w-36">
            <option value="">All Status</option>
            <option value="Active">Active</option>
            <option value="Near Expiry">Near Expiry</option>
            <option value="Expired">Expired</option>
            <option value="Depleted">Depleted</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Batch ID</th>
                <th className="px-4 py-3 text-left">Item Code</th>
                <th className="px-4 py-3 text-left">Item Name</th>
                <th className="px-4 py-3 text-left">DOM</th>
                <th className="px-4 py-3 text-left">BBD</th>
                <th className="px-4 py-3 text-left">Expiry</th>
                <th className="px-4 py-3 text-right">Qty In</th>
                <th className="px-4 py-3 text-right">Qty Out</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Expiry Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(batch => (
                <tr key={batch.id} className="hover:bg-gray-50">
                  <td className="table-cell font-mono text-xs font-medium">{batch.batchId}</td>
                  <td className="table-cell">{batch.itemCode}</td>
                  <td className="table-cell">{batch.itemName}</td>
                  <td className="table-cell">{batch.dom ? fmt(new Date(batch.dom), 'dd MMM yy') : '-'}</td>
                  <td className="table-cell">{batch.bbd ? fmt(new Date(batch.bbd), 'dd MMM yy') : '-'}</td>
                  <td className="table-cell">{batch.expiryDate ? fmt(new Date(batch.expiryDate), 'dd MMM yy') : '-'}</td>
                  <td className="table-cell text-right font-medium text-emerald-600">{batch.quantityIn}</td>
                  <td className="table-cell text-right font-medium text-blue-600">{batch.quantityOut}</td>
                  <td className="table-cell text-right font-bold">{batch.balance}</td>
                  <td className="table-cell text-center">
                    <span className={getExpiryBadgeClass(batch.status)}>{batch.status}</span>
                  </td>
                  <td className="table-cell text-center">
                    <span className={getExpiryBadgeClass(batch.expiryStatus)}>
                      {batch.expiryStatus}
                      {batch.daysLeft >= 0 && ` (${batch.daysLeft}d)`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} batches</div>
      </div>
    </div>
  );
}
