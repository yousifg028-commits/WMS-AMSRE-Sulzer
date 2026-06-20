import { useState, useMemo } from 'react';
import { Search, Clock } from 'lucide-react';
import { useWMSStore } from '../store';
import { formatDateTime } from '../utils/helpers';

export default function AuditTrail() {
  const { auditTrail } = useWMSStore();
  const [search, setSearch] = useState('');
  const [filterModule, setFilterModule] = useState('');

  const modules = useMemo(() => [...new Set(auditTrail.map(a => a.module))], [auditTrail]);

  const filtered = useMemo(() => {
    return auditTrail
      .filter(entry => {
        const matchSearch = !search ||
          entry.action.toLowerCase().includes(search.toLowerCase()) ||
          entry.module.toLowerCase().includes(search.toLowerCase()) ||
          entry.performedBy.toLowerCase().includes(search.toLowerCase());
        const matchModule = !filterModule || entry.module === filterModule;
        return matchSearch && matchModule;
      })
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
  }, [auditTrail, search, filterModule]);

  const getActionColor = (action: string) => {
    if (action.includes('Create') || action.includes('Add')) return 'badge-green';
    if (action.includes('Update') || action.includes('Edit')) return 'badge-blue';
    if (action.includes('Delete') || action.includes('Archive')) return 'badge-red';
    return 'badge-gray';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-sm text-gray-500 mt-1">Track all system changes and modifications</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search audit entries..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
          <select value={filterModule} onChange={(e) => setFilterModule(e.target.value)} className="select-field w-40">
            <option value="">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      <div className="card">
        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map(entry => (
              <div key={entry.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className={getActionColor(entry.action)}>{entry.action}</span>
                    <span className="text-sm font-medium text-gray-700">{entry.module}</span>
                  </div>
                  <span className="text-xs text-gray-500">{formatDateTime(entry.performedAt)}</span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">By:</span> {entry.performedBy}
                  {entry.ipAddress && <span className="ml-3 text-gray-400">IP: {entry.ipAddress}</span>}
                </div>
                {(entry.beforeValue || entry.afterValue) && (
                  <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                    {entry.beforeValue && (
                      <div className="bg-red-50 rounded p-2">
                        <span className="font-medium text-red-700">Before:</span>
                        <p className="text-red-600 mt-1 whitespace-pre-wrap">{entry.beforeValue}</p>
                      </div>
                    )}
                    {entry.afterValue && (
                      <div className="bg-green-50 rounded p-2">
                        <span className="font-medium text-green-700">After:</span>
                        <p className="text-green-600 mt-1 whitespace-pre-wrap">{entry.afterValue}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {auditTrail.length === 0
                ? 'No audit entries yet. Changes will be logged here.'
                : 'No entries match your search criteria.'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
