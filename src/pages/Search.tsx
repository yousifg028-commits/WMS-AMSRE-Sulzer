import { useState, useMemo } from 'react';
import { Search as SearchIcon, Package, Users, ClipboardList, FileText } from 'lucide-react';
import { useWMSStore } from '../store';
import { format as fmt } from '../utils/helpers';

type SearchCategory = 'all' | 'items' | 'employees' | 'batches' | 'transactions';

export default function GlobalSearch() {
  const { masterItems, employees, batchLedger, stockInRecords, stockOutRecords } = useWMSStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchCategory>('all');

  const results = useMemo(() => {
    if (!query.trim()) return { items: [], employees: [], batches: [], transactions: [] };

    const q = query.toLowerCase();

    const items = category === 'all' || category === 'items'
      ? masterItems.filter(i =>
          i.itemCode.toLowerCase().includes(q) ||
          i.itemName.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          i.supplier.toLowerCase().includes(q)
        ) : [];

    const emps = category === 'all' || category === 'employees'
      ? employees.filter(e =>
          e.employeeId.toLowerCase().includes(q) ||
          e.employeeName.toLowerCase().includes(q) ||
          e.department.toLowerCase().includes(q)
        ) : [];

    const batches = category === 'all' || category === 'batches'
      ? batchLedger.filter(b =>
          b.batchId.toLowerCase().includes(q) ||
          b.itemCode.toLowerCase().includes(q) ||
          b.itemName.toLowerCase().includes(q)
        ) : [];

    const txns = category === 'all' || category === 'transactions'
      ? [
          ...stockInRecords.filter(r =>
            r.grnNumber.toLowerCase().includes(q) ||
            r.itemName.toLowerCase().includes(q) ||
            r.batchId.toLowerCase().includes(q)
          ).map(r => ({ type: 'Stock In', ref: r.grnNumber, item: r.itemName, date: r.receiptDate, qty: r.quantity })),
          ...stockOutRecords.filter(r =>
            r.issueNumber.toLowerCase().includes(q) ||
            r.itemName.toLowerCase().includes(q) ||
            r.employeeName.toLowerCase().includes(q) ||
            (r.jobNumber && r.jobNumber.toLowerCase().includes(q))
          ).map(r => ({ type: 'Stock Out', ref: r.issueNumber, item: r.itemName, date: r.issueDate, qty: r.quantity })),
        ]
      : [];

    return { items, employees: emps, batches, transactions: txns };
  }, [query, category, masterItems, employees, batchLedger, stockInRecords, stockOutRecords]);

  const totalResults = results.items.length + results.employees.length + results.batches.length + results.transactions.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Global Search</h1>
        <p className="text-sm text-gray-500 mt-1">Search across all modules</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search items, employees, batches, GRN, job numbers..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="input-field pl-11 py-3 text-base"
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          {(['all', 'items', 'employees', 'batches', 'transactions'] as SearchCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                category === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="ml-auto text-sm text-gray-500 self-center">{totalResults} results</span>
        </div>
      </div>

      {query && (
        <div className="space-y-6">
          {results.items.length > 0 && (
            <div className="card">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                <Package className="w-4 h-4 text-blue-500" /> Items ({results.items.length})
              </h3>
              <div className="divide-y divide-gray-100">
                {results.items.map(item => (
                  <div key={item.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-blue-600">{item.itemCode}</p>
                      <p className="text-sm text-gray-600">{item.itemName} | {item.category} | {item.supplier}</p>
                    </div>
                    <span className={item.status === 'Active' ? 'badge-green' : 'badge-gray'}>{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.employees.length > 0 && (
            <div className="card">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                <Users className="w-4 h-4 text-emerald-500" /> Employees ({results.employees.length})
              </h3>
              <div className="divide-y divide-gray-100">
                {results.employees.map(emp => (
                  <div key={emp.id} className="py-3">
                    <p className="font-medium text-blue-600">{emp.employeeId}</p>
                    <p className="text-sm text-gray-600">{emp.employeeName} | {emp.department} | {emp.position}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.batches.length > 0 && (
            <div className="card">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                <ClipboardList className="w-4 h-4 text-purple-500" /> Batches ({results.batches.length})
              </h3>
              <div className="divide-y divide-gray-100">
                {results.batches.map(batch => (
                  <div key={batch.id} className="py-3">
                    <p className="font-mono text-sm font-medium text-blue-600">{batch.batchId}</p>
                    <p className="text-sm text-gray-600">{batch.itemCode} - {batch.itemName} | Bal: {batch.balance} | Exp: {batch.expiryDate ? fmt(new Date(batch.expiryDate), 'dd MMM yyyy') : 'N/A'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.transactions.length > 0 && (
            <div className="card">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                <FileText className="w-4 h-4 text-orange-500" /> Transactions ({results.transactions.length})
              </h3>
              <div className="divide-y divide-gray-100">
                {results.transactions.map((tx, i) => (
                  <div key={i} className="py-3 flex items-center justify-between">
                    <div>
                      <span className={tx.type === 'Stock In' ? 'badge-green' : 'badge-blue'}>{tx.type}</span>
                      <span className="ml-2 font-medium">{tx.ref}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm">{tx.item} | Qty: {tx.qty}</p>
                      <p className="text-xs text-gray-500">{fmt(new Date(tx.date), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {totalResults === 0 && (
            <div className="card text-center py-12">
              <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No results found for "{query}"</p>
            </div>
          )}
        </div>
      )}

      {!query && (
        <div className="card text-center py-12">
          <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Enter a search query to find items, employees, batches, or transactions</p>
        </div>
      )}
    </div>
  );
}
