import { useState, useMemo } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, Upload } from 'lucide-react';
import { useWMSStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { format } from 'date-fns';
import type { StockInRecord } from '../types';

export default function StockIn() {
  const { masterItems, stockInRecords, createStockIn, deleteStockIn, updateStockIn } = useWMSStore();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<StockInRecord | null>(null);
  const [formData, setFormData] = useState({
    receiptDate: format(new Date(), 'yyyy-MM-dd'),
    itemId: '',
    quantity: 0,
    dom: '',
    bbd: '',
    expiryDate: '',
    supplier: '',
    warehouseLocation: '',
    purchaseOrder: '',
    referenceNumber: '',
    poFileName: '',
    remarks: '',
  });

  const activeItems = masterItems.filter(i => i.status === 'Active');

  const selectedItem = useMemo(() => activeItems.find(i => i.id === formData.itemId), [activeItems, formData.itemId]);

  const filtered = useMemo(() => {
    return stockInRecords.filter(r => {
      return !search || r.grnNumber.toLowerCase().includes(search.toLowerCase()) || r.itemName.toLowerCase().includes(search.toLowerCase()) || r.itemCode.toLowerCase().includes(search.toLowerCase()) || (r.purchaseOrder && r.purchaseOrder.toLowerCase().includes(search.toLowerCase()));
    });
  }, [stockInRecords, search]);

  const handleSave = () => {
    if (!formData.itemId || formData.quantity <= 0) return;
    const item = activeItems.find(i => i.id === formData.itemId);
    if (!item) return;

    createStockIn({
      receiptDate: formData.receiptDate,
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      quantity: formData.quantity,
      unit: item.unitOfMeasure,
      dom: formData.dom,
      bbd: formData.bbd,
      expiryDate: formData.expiryDate,
      supplier: formData.supplier || item.supplier,
      warehouseLocation: formData.warehouseLocation,
      purchaseOrder: formData.purchaseOrder,
      referenceNumber: formData.referenceNumber,
      remarks: formData.remarks,
      createdBy: 'admin',
    });
    setShowModal(false);
    setFormData({
      receiptDate: format(new Date(), 'yyyy-MM-dd'),
      itemId: '', quantity: 0, dom: '', bbd: '', expiryDate: '',
      supplier: '', warehouseLocation: '', purchaseOrder: '', referenceNumber: '', poFileName: '', remarks: '',
    });
  };

  const handleDelete = (record: StockInRecord) => {
    if (window.confirm(`Delete receipt "${record.grnNumber}"? This will reverse the batch and inventory balance.`)) {
      deleteStockIn(record.id);
    }
  };

  const handleEdit = (record: StockInRecord) => {
    setEditingRecord(record);
  };

  const handleUpdate = () => {
    if (!editingRecord) return;
    updateStockIn(editingRecord.id, {
      receiptDate: formData.receiptDate,
      supplier: formData.supplier,
      warehouseLocation: formData.warehouseLocation,
      purchaseOrder: formData.purchaseOrder,
      referenceNumber: formData.referenceNumber,
      remarks: formData.remarks,
      dom: formData.dom,
      bbd: formData.bbd,
      expiryDate: formData.expiryDate,
      quantity: formData.quantity,
    });
    setEditingRecord(null);
    setShowModal(false);
  };

  const openEditModal = (record: StockInRecord) => {
    setFormData({
      receiptDate: record.receiptDate,
      itemId: record.itemId,
      quantity: record.quantity,
      dom: record.dom || '',
      bbd: record.bbd || '',
      expiryDate: record.expiryDate || '',
      supplier: record.supplier,
      warehouseLocation: record.warehouseLocation,
      purchaseOrder: record.purchaseOrder || '',
      referenceNumber: record.referenceNumber || '',
      poFileName: (record as any).poFileName || '',
      remarks: record.remarks || '',
    });
    handleEdit(record);
  };

  const detailRecord = stockInRecords.find(r => r.id === showDetail);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock In</h1>
          <p className="text-sm text-gray-500 mt-1">Receive inventory into warehouse</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Receipt
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Receipts</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stockInRecords.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Received Qty</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stockInRecords.reduce((s, r) => s + r.quantity, 0)}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Today's Receipts</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stockInRecords.filter(r => r.receiptDate === format(new Date(), 'yyyy-MM-dd')).length}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by GRN, item code, name, or PO number..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">GRN Number</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Item Code</th>
                <th className="px-4 py-3 text-left">Item Name</th>
                <th className="px-4 py-3 text-left">Qty</th>
                <th className="px-4 py-3 text-left">Batch ID</th>
                <th className="px-4 py-3 text-left">Supplier</th>
                <th className="px-4 py-3 text-left">PO Number</th>
                <th className="px-4 py-3 text-left">Reference Number</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-blue-600">{record.grnNumber}</td>
                  <td className="table-cell">{format(new Date(record.receiptDate), 'dd MMM yyyy')}</td>
                  <td className="table-cell">{record.itemCode}</td>
                  <td className="table-cell">{record.itemName}</td>
                  <td className="table-cell font-medium">{record.quantity} {record.unit}</td>
                  <td className="table-cell font-mono text-xs">{record.batchId}</td>
                  <td className="table-cell">{record.supplier}</td>
                  <td className="table-cell">{record.purchaseOrder || '-'}</td>
                  <td className="table-cell">{record.referenceNumber || '-'}</td>
                  <td className="table-cell text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setShowDetail(record.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditModal(record)} className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(record)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} records</div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="New Stock Receipt" maxWidth="max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Receipt Date *</label>
            <input type="date" value={formData.receiptDate} onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Item *</label>
            <select value={formData.itemId} onChange={(e) => setFormData({ ...formData, itemId: e.target.value })} className="select-field">
              <option value="">Select item</option>
              {activeItems.map(item => (
                <option key={item.id} value={item.id}>{item.itemCode} - {item.itemName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Quantity *</label>
            <input type="number" min="1" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: +e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Supplier</label>
            <input type="text" value={formData.supplier || selectedItem?.supplier || ''} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">DOM (Date of Manufacture)</label>
            <input type="date" value={formData.dom} onChange={(e) => setFormData({ ...formData, dom: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">BBD (Best Before Date)</label>
            <input type="date" value={formData.bbd} onChange={(e) => setFormData({ ...formData, bbd: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Expiry Date</label>
            <input type="date" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Warehouse Location</label>
            <input type="text" value={formData.warehouseLocation} onChange={(e) => setFormData({ ...formData, warehouseLocation: e.target.value })} className="input-field" placeholder="e.g. A-01-01" />
          </div>
          <div>
            <label className="label-field">PO Number</label>
            <input type="text" value={formData.purchaseOrder} onChange={(e) => setFormData({ ...formData, purchaseOrder: e.target.value })} className="input-field" placeholder="Purchase order number" />
          </div>
          <div>
            <label className="label-field">Reference Number</label>
            <input type="text" value={formData.referenceNumber} onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })} className="input-field" placeholder="Reference number" />
          </div>
          <div className="col-span-2">
            <label className="label-field">PO File</label>
            <div className="flex items-center gap-3">
              <label className="input-field flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{formData.poFileName || 'Choose file (PDF, JPG, PNG)'}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setFormData({ ...formData, poFileName: file.name });
                }} />
              </label>
              {formData.poFileName && (
                <button type="button" onClick={() => setFormData({ ...formData, poFileName: '' })} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <label className="label-field">Remarks</label>
            <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className="input-field" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary">Receive Stock</button>
        </div>
      </Modal>

      <Modal isOpen={!!editingRecord} onClose={() => { setEditingRecord(null); }} title={`Edit Receipt - ${editingRecord?.grnNumber || ''}`} maxWidth="max-w-3xl">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Receipt Date</label>
            <input type="date" value={formData.receiptDate} onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Item</label>
            <input type="text" disabled value={editingRecord?.itemName || ''} className="input-field bg-gray-50" />
          </div>
          <div>
            <label className="label-field">Quantity</label>
            <input type="number" min="1" value={formData.quantity || ''} onChange={(e) => setFormData({ ...formData, quantity: +e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Supplier</label>
            <input type="text" value={formData.supplier} onChange={(e) => setFormData({ ...formData, supplier: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">DOM</label>
            <input type="date" value={formData.dom} onChange={(e) => setFormData({ ...formData, dom: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">BBD</label>
            <input type="date" value={formData.bbd} onChange={(e) => setFormData({ ...formData, bbd: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Expiry Date</label>
            <input type="date" value={formData.expiryDate} onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Location</label>
            <input type="text" value={formData.warehouseLocation} onChange={(e) => setFormData({ ...formData, warehouseLocation: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">PO Number</label>
            <input type="text" value={formData.purchaseOrder} onChange={(e) => setFormData({ ...formData, purchaseOrder: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Reference Number</label>
            <input type="text" value={formData.referenceNumber} onChange={(e) => setFormData({ ...formData, referenceNumber: e.target.value })} className="input-field" />
          </div>
          <div className="col-span-2">
            <label className="label-field">PO File</label>
            <div className="flex items-center gap-3">
              <label className="input-field flex items-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-500">{formData.poFileName || 'Choose file (PDF, JPG, PNG)'}</span>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setFormData({ ...formData, poFileName: file.name });
                }} />
              </label>
              {formData.poFileName && (
                <button type="button" onClick={() => setFormData({ ...formData, poFileName: '' })} className="text-xs text-red-500 hover:text-red-700">Remove</button>
              )}
            </div>
          </div>
          <div className="col-span-2">
            <label className="label-field">Remarks</label>
            <textarea value={formData.remarks} onChange={(e) => setFormData({ ...formData, remarks: e.target.value })} className="input-field" rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => { setEditingRecord(null); }} className="btn-secondary">Cancel</button>
          <button onClick={handleUpdate} className="btn-primary">Update Receipt</button>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Receipt Details">
        {detailRecord && (
          <div className="space-y-3">
            {Object.entries({
              'GRN Number': detailRecord.grnNumber,
              'Receipt Date': format(new Date(detailRecord.receiptDate), 'dd MMM yyyy'),
              'Item Code': detailRecord.itemCode,
              'Item Name': detailRecord.itemName,
              'Quantity': `${detailRecord.quantity} ${detailRecord.unit}`,
              'Batch ID': detailRecord.batchId,
              'DOM': detailRecord.dom ? format(new Date(detailRecord.dom), 'dd MMM yyyy') : '-',
              'BBD': detailRecord.bbd ? format(new Date(detailRecord.bbd), 'dd MMM yyyy') : '-',
              'Expiry Date': detailRecord.expiryDate ? format(new Date(detailRecord.expiryDate), 'dd MMM yyyy') : '-',
              'Supplier': detailRecord.supplier,
              'PO Number': (detailRecord as any).purchaseOrder || '-',
              'Reference Number': (detailRecord as any).referenceNumber || '-',
              'Location': detailRecord.warehouseLocation,
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
