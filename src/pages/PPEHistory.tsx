import { useState, useMemo } from 'react';
import { User, Clock, Package, AlertTriangle } from 'lucide-react';
import { useWMSStore } from '../store';
import { format } from 'date-fns';

export default function PPEHistory() {
  const { employees, stockOutRecords, masterItems } = useWMSStore();
  const [selectedEmpId, setSelectedEmpId] = useState('');

  const selectedEmployee = useMemo(() => employees.find(e => e.id === selectedEmpId), [employees, selectedEmpId]);
  const ppeHistory = useMemo(() => {
    if (!selectedEmpId) return [];
    return stockOutRecords
      .filter(r => r.employeeId === selectedEmpId)
      .sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
  }, [stockOutRecords, selectedEmpId]);

  const ppeItems = useMemo(() => {
    const items: Record<string, { name: string; qty: number; lastDate: string }> = {};
    ppeHistory.forEach(record => {
      const item = masterItems.find(i => i.id === record.itemId);
      if (item?.trackerGroup === 'PPE') {
        if (!items[record.itemId]) {
          items[record.itemId] = { name: record.itemName, qty: 0, lastDate: record.issueDate };
        }
        items[record.itemId].qty += record.quantity;
      }
    });
    return Object.values(items);
  }, [ppeHistory, masterItems]);

  const totalItemsIssued = ppeHistory.reduce((s, r) => s + r.quantity, 0);
  const lastIssueDate = ppeHistory.length > 0 ? ppeHistory[0].issueDate : null;
  const issueFrequency = useMemo(() => {
    if (ppeHistory.length < 2) return 'N/A';
    const dates = ppeHistory.map(r => new Date(r.issueDate).getTime()).sort((a, b) => b - a);
    const avgDays = (dates[0] - dates[dates.length - 1]) / (dates.length - 1) / (1000 * 60 * 60 * 24);
    if (avgDays <= 7) return 'Weekly';
    if (avgDays <= 14) return 'Bi-weekly';
    if (avgDays <= 35) return 'Monthly';
    return 'Quarterly';
  }, [ppeHistory]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Employee PPE Issue History</h1>
        <p className="text-sm text-gray-500 mt-1">Track all PPE issued per employee</p>
      </div>

      <div className="card">
        <label className="label-field">Select Employee</label>
        <select
          value={selectedEmpId}
          onChange={(e) => setSelectedEmpId(e.target.value)}
          className="select-field max-w-md"
        >
          <option value="">-- Select an employee --</option>
          {employees.filter(e => e.status === 'Active').map(emp => (
            <option key={emp.id} value={emp.id}>{emp.employeeId} - {emp.employeeName}</option>
          ))}
        </select>
      </div>

      {selectedEmployee && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{selectedEmployee.employeeName}</h2>
                <p className="text-sm text-gray-500">{selectedEmployee.employeeId} | {selectedEmployee.department} | {selectedEmployee.position}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase">Total Items Issued</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{totalItemsIssued}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase">Last Issue Date</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{lastIssueDate ? format(new Date(lastIssueDate), 'dd MMM yyyy') : 'N/A'}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase">Issue Frequency</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{issueFrequency}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-4 h-4 text-purple-500" />
                  <span className="text-xs font-medium text-gray-500 uppercase">Unique PPE Items</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{ppeItems.length}</p>
              </div>
            </div>
          </div>

          {ppeItems.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">PPE Consumption Summary</h3>
              <div className="grid grid-cols-3 gap-4">
                {ppeItems.map((item, i) => (
                  <div key={i} className="bg-gray-50 rounded-lg p-4">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{item.qty}</p>
                    <p className="text-xs text-gray-500">Last issued: {format(new Date(item.lastDate), 'dd MMM yyyy')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Issue History</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left">Issue Date</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-left">Quantity</th>
                    <th className="px-4 py-3 text-left">Batch ID</th>
                    <th className="px-4 py-3 text-left">Job Number</th>
                    <th className="px-4 py-3 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ppeHistory.map(record => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="table-cell">{format(new Date(record.issueDate), 'dd MMM yyyy')}</td>
                      <td className="table-cell font-medium">{record.itemName}</td>
                      <td className="table-cell">{record.quantity}</td>
                      <td className="table-cell font-mono text-xs">{record.batchId}</td>
                      <td className="table-cell">{record.jobNumber || '-'}</td>
                      <td className="table-cell text-gray-500">{record.remarks || '-'}</td>
                    </tr>
                  ))}
                  {ppeHistory.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No issue history found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {!selectedEmployee && (
        <div className="card text-center py-12">
          <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Select an employee to view their PPE issue history</p>
        </div>
      )}
    </div>
  );
}
