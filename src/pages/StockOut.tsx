import { useState, useMemo } from 'react';
import { Plus, Search, Eye, AlertTriangle } from 'lucide-react';
import { useWMSStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { format } from 'date-fns';
import { allocateFEFO } from '../utils/fefo';
import { allocateFIFO } from '../utils/fifo';

export default function StockOut() {
  const { masterItems, employees, stockOutRecords, batchLedger, inventoryBalances, createStockOut, jobs } = useWMSStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [selectedBatchInfo, setSelectedBatchInfo] = useState<string>('');
  const [formData, setFormData] = useState({
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    employeeId: '',
    itemId: '',
    quantity: 0,
    jobNumber: '',
    remarks: '',
  });

  const activeItems = masterItems.filter(i => i.status === 'Active');
  const activeEmployees = employees.filter(e => e.status === 'Active');
  const selectedItem = activeItems.find(i => i.id === formData.itemId);
  const selectedEmployee = activeEmployees.find(e => e.id === formData.employeeId);

  const filtered = useMemo(() => {
    return stockOutRecords.filter(r => {
      return !search || r.issueNumber.toLowerCase().includes(search.toLowerCase()) || r.itemName.toLowerCase().includes(search.toLowerCase()) || r.employeeName.toLowerCase().includes(search.toLowerCase());
    });
  }, [stockOutRecords, search]);

  const handleItemChange = (itemId: string) => {
    setFormData({ ...formData, itemId, quantity: 0 });
    setSelectedBatchInfo('');
    const item = activeItems.find(i => i.id === itemId);
    if (item) {
      const batches = batchLedger.filter(b => b.itemId === itemId && b.balance > 0);
      if (item.fefoEnabled && item.batchControlled) {
        const alloc = allocateFEFO(batches, 1);
        if (alloc) {
          setSelectedBatchInfo(`FEFO: Will pick from batch ${alloc[0].batchId} (expires ${alloc[0].expiryDate})`);
        }
      } else if (item.batchControlled) {
        const alloc = allocateFIFO(batches, 1);
        if (alloc) {
          setSelectedBatchInfo(`FIFO: Will pick from batch ${alloc[0].batchId}`);
        }
      }
    }
  };

  const handleSave = () => {
    if (!formData.itemId || !formData.employeeId || formData.quantity <= 0) return;
    const item = activeItems.find(i => i.id === formData.itemId);
    const emp = activeEmployees.find(e => e.id === formData.employeeId);
    if (!item || !emp) return;

    const result = createStockOut({
      issueDate: formData.issueDate,
      employeeId: emp.id,
      employeeName: emp.employeeName,
      department: emp.department,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: formData.quantity,
      jobNumber: formData.jobNumber,
      remarks: formData.remarks,
      createdBy: 'admin',
    });

    if (result) {
      setShowModal(false);
      setFormData({ issueDate: format(new Date(), 'yyyy-MM-dd'), employeeId: '', itemId: '', quantity: 0, jobNumber: '', remarks: '' });
      setSelectedBatchInfo('');
    }
  };

  const detailRecord = stockOutRecords.find(r => r.id === showDetail);
  const availableStock = selectedItem
    ? inventoryBalances.find(b => b.itemId === selectedItem.id)?.availableQuantity || 0
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Out</h1>
          <p className="text-sm text-gray-500 mt-1">Issue stock to employees</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Issue
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Issues</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stockOutRecords.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Issued Qty</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stockOutRecords.reduce((s, r) => s + r.quantity, 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Today's Issues</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stockOutRecords.filter(r => r.issueDate === format(new Date(), 'yyyy-MM-dd')).length}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by issue number, item, or employee..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Issue Number</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Employee</th>
                <th className="px-4 py-3 text-left">Item</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-left">Batch ID</th>
                <th className="px-4 py-3 text-left">Job #</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-blue-600">{record.issueNumber}</td>
                  <td className="table-cell">{format(new Date(record.issueDate), 'dd MMM yyyy')}</td>
                  <td className="table-cell">{record.employeeName}</td>
                  <td className="table-cell">{record.itemName}</td>
                  <td className="table-cell font-medium">{record.quantity}</td>
                  <td className="table-cell font-mono text-xs">{record.batchId}</td>
                  <td className="table-cell">{record.jobNumber}</td>
                  <td className="table-cell text-center">
                    <button onClick={() => setShowDetail(record.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} records</div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Stock Issue" maxWidth="max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Issue Date *</label>
            <input type="date" value={formData.issueDate} onChange={(e) => setFormData({ ...formData, issueDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Employee *</label>
            <select value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} className="select-field">
              <option value="">Select employee</option>
              {activeEmployees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.employeeId} - {emp.employeeName}</option>
              ))}
            </select>
          </div>
          {selectedEmployee && (
            <div className="col-span-2 bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Department:</span> {selectedEmployee.department} |
                <span className="font-medium ml-2">Location:</span> {selectedEmployee.location}
              </p>
            </div>
          )}
          <div>
            <label className="label-field">Item *</label>
            <select value={formData.itemId} onChange={(e) => handleItemChange(e.target.value)} className="select-field">
              <option value="">Select item</option>
              {activeItems.map(item => (
                <option key={item.id} value={item.id}>{item.itemCode} - {item.itemName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Quantity *</label>
            <input type="number" min="1" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: +e.target.value })} className="input-field" />
            {selectedItem && (
              <p className="text-xs text-gray-500 mt-1">Available: {availableStock} {selectedItem.unitOfMeasure}</p>
            )}
          </div>
          {selectedBatchInfo && (
            <div className="col-span-2 bg-blue-50 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0" />
              <p className="text-sm text-blue-700">{selectedBatchInfo}</p>
            </div>
          )}
          {selectedItem && formData.quantity > availableStock && (
            <div className="col-span-2 bg-red-50 rounded-lg p-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <p className="text-sm text-red-700">Insufficient stock. Available: {availableStock}</p>
            </div>
          )}
          <div>
            <label className="label-field">Job Number</label>
            <select value={formData.jobNumber} onChange={(e) => setFormData({ ...formData, jobNumber: e.target.value })} className="select-field">
              <option value="">Select job (optional)</option>
              {jobs.filter(j => j.status === 'Active').map(job => (
                <option key={job.id} value={job.jobNumber}>{job.jobNumber} - {job.jobName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Remarks</label>
            <input type="text" value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className="input-field" />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={!formData.itemId || !formData.employeeId || formData.quantity <= 0 || formData.quantity > availableStock}
          >
            Issue Stock
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Issue Details">
        {detailRecord && (
          <div className="space-y-3">
            {Object.entries({
              'Issue Number': detailRecord.issueNumber,
              'Issue Date': format(new Date(detailRecord.issueDate), 'dd MMM yyyy'),
              'Employee': `${detailRecord.employeeName} (${detailRecord.employeeId})`,
              'Department': detailRecord.department,
              'Item Code': detailRecord.itemCode,
              'Item Name': detailRecord.itemName,
              'Quantity': detailRecord.quantity,
              'Batch ID': detailRecord.batchId,
              'Job Number': detailRecord.jobNumber || '-',
              'Remarks': detailRecord.remarks || '-',
            }).map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
