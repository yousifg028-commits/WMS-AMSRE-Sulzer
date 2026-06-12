import { useState, useMemo } from 'react';
import { Search, AlertTriangle, Clock, Shield, Bell } from 'lucide-react';
import { useWMSStore } from '../store';
import { format as fmt, daysUntilExpiry, getExpiryStatus, getExpiryBadgeClass } from '../utils/helpers';

export default function ExpiryManagement() {
  const { batchLedger } = useWMSStore();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const enriched = useMemo(() => {
    return batchLedger
      .filter(b => b.balance > 0 && b.expiryDate)
      .map(b => ({
        ...b,
        daysLeft: daysUntilExpiry(b.expiryDate),
        expiryStatus: getExpiryStatus(b.expiryDate),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);
  }, [batchLedger]);

  const filtered = useMemo(() => {
    return enriched.filter(b => {
      const matchSearch = !search || b.itemName.toLowerCase().includes(search.toLowerCase()) || b.itemCode.toLowerCase().includes(search.toLowerCase()) || b.batchId.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !filterStatus || b.expiryStatus === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [enriched, search, filterStatus]);

  const summary = useMemo(() => {
    const expired = enriched.filter(b => b.expiryStatus === 'Expired');
    const nearExpiry = enriched.filter(b => b.expiryStatus === 'Near Expiry');
    const warning = enriched.filter(b => b.expiryStatus === 'Warning');
    const healthy = enriched.filter(b => b.expiryStatus === 'Healthy');
    return {
      expiredCount: expired.length,
      expiredQty: expired.reduce((s, b) => s + b.balance, 0),
      nearExpiryCount: nearExpiry.length,
      nearExpiryQty: nearExpiry.reduce((s, b) => s + b.balance, 0),
      warningCount: warning.length,
      warningQty: warning.reduce((s, b) => s + b.balance, 0),
      healthyCount: healthy.length,
      healthyQty: healthy.reduce((s, b) => s + b.balance, 0),
    };
  }, [enriched]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expiry Management</h1>
        <p className="text-sm text-gray-500 mt-1">Monitor and manage product expiry dates</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card border-l-4 border-l-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Expired</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{summary.expiredCount}</p>
              <p className="text-xs text-gray-500">{summary.expiredQty} units</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </div>
        <div className="stat-card border-l-4 border-l-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Near Expiry (≤30d)</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{summary.nearExpiryCount}</p>
              <p className="text-xs text-gray-500">{summary.nearExpiryQty} units</p>
            </div>
            <Clock className="w-8 h-8 text-orange-400" />
          </div>
        </div>
        <div className="stat-card border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Warning (≤90d)</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{summary.warningCount}</p>
              <p className="text-xs text-gray-500">{summary.warningQty} units</p>
            </div>
            <Bell className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        <div className="stat-card border-l-4 border-l-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Healthy</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{summary.healthyCount}</p>
              <p className="text-xs text-gray-500">{summary.healthyQty} units</p>
            </div>
            <Shield className="w-8 h-8 text-green-400" />
          </div>
        </div>
      </div>

      {(summary.expiredCount > 0 || summary.nearExpiryCount > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <div>
              <h4 className="font-medium text-red-800">Attention Required</h4>
              <p className="text-sm text-red-600">
                {summary.expiredCount} batches are expired and {summary.nearExpiryCount} batches are near expiry. 
                Expired stock cannot be issued. Review and take action.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by batch, item code, or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="select-field w-40">
            <option value="">All Status</option>
            <option value="Expired">Expired</option>
            <option value="Near Expiry">Near Expiry</option>
            <option value="Warning">Warning</option>
            <option value="Healthy">Healthy</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Batch ID</th>
                <th className="px-4 py-3 text-left">Item Code</th>
                <th className="px-4 py-3 text-left">Item Name</th>
                <th className="px-4 py-3 text-left">Expiry Date</th>
                <th className="px-4 py-3 text-center">Days Left</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(batch => (
                <tr key={batch.id} className={`hover:bg-gray-50 ${batch.expiryStatus === 'Expired' ? 'bg-red-50' : batch.expiryStatus === 'Near Expiry' ? 'bg-orange-50' : ''}`}>
                  <td className="table-cell font-mono text-xs font-medium">{batch.batchId}</td>
                  <td className="table-cell">{batch.itemCode}</td>
                  <td className="table-cell">{batch.itemName}</td>
                  <td className="table-cell">{fmt(new Date(batch.expiryDate), 'dd MMM yyyy')}</td>
                  <td className="table-cell text-center">
                    <span className={`font-bold ${batch.daysLeft < 0 ? 'text-red-600' : batch.daysLeft <= 30 ? 'text-orange-600' : batch.daysLeft <= 90 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {batch.daysLeft < 0 ? `${Math.abs(batch.daysLeft)}d overdue` : `${batch.daysLeft}d`}
                    </span>
                  </td>
                  <td className="table-cell text-right font-medium">{batch.balance}</td>
                  <td className="table-cell text-center">
                    <span className={getExpiryBadgeClass(batch.expiryStatus)}>{batch.expiryStatus}</span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No batches found</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} batches</div>
      </div>
    </div>
  );
}
