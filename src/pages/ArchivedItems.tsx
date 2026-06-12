import { useState, useMemo } from 'react';
import { Search, RotateCcw, Archive } from 'lucide-react';
import { useWMSStore } from '../store';
import { format } from '../utils/helpers';

export default function ArchivedItems() {
  const { masterItems, restoreItem, batchLedger } = useWMSStore();
  const [search, setSearch] = useState('');

  const archived = useMemo(() => {
    return masterItems
      .filter(i => i.status === 'Archived')
      .filter(i => {
        return !search || i.itemCode.toLowerCase().includes(search.toLowerCase()) || i.itemName.toLowerCase().includes(search.toLowerCase());
      });
  }, [masterItems, search]);

  const getBalance = (itemId: string) => batchLedger.filter(b => b.itemId === itemId).reduce((s, b) => s + b.balance, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Archived Items</h1>
        <p className="text-sm text-gray-500 mt-1">Items that have been removed from active inventory</p>
      </div>

      <div className="stat-card">
        <p className="text-xs font-medium text-gray-500 uppercase">Archived Items</p>
        <p className="text-2xl font-bold text-gray-900 mt-1">{archived.length}</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search archived items..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Item Code</th>
                <th className="px-4 py-3 text-left">Item Name</th>
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-right">Last Balance</th>
                <th className="px-4 py-3 text-left">Archived Date</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {archived.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-gray-500">{item.itemCode}</td>
                  <td className="table-cell">{item.itemName}</td>
                  <td className="table-cell">{item.category}</td>
                  <td className="table-cell">{item.location || '-'}</td>
                  <td className="table-cell text-right">{getBalance(item.id)}</td>
                  <td className="table-cell text-gray-500">{format(new Date(item.updatedAt), 'dd MMM yyyy')}</td>
                  <td className="table-cell text-center">
                    <button onClick={() => restoreItem(item.id)} className="btn-success flex items-center gap-1 mx-auto text-xs py-1.5 px-3">
                      <RotateCcw className="w-3.5 h-3.5" /> Restore
                    </button>
                  </td>
                </tr>
              ))}
              {archived.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <Archive className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  No archived items found
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
