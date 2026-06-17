import { useState, useMemo } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, Package, Upload, Download, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { format } from '../utils/helpers';
import type { ClientMaterial } from '../types';

const CATEGORIES = ['Chemical', 'Equipment', 'Consumable', 'PPE', 'Other'];
const UNITS = ['Box', 'Piece', 'Kg', 'Liter', 'Meter', 'Set', 'Other'];
const STATUS_OPTIONS: ClientMaterial['status'][] = ['In Stock', 'Issued', 'Returned', 'Expired'];

function generateCode(existing: ClientMaterial[]): string {
  const max = existing.reduce((m, r) => {
    const n = parseInt(r.code.replace('CLT-', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `CLT-${String(max + 1).padStart(3, '0')}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'In Stock': return 'badge-green';
    case 'Issued': return 'badge-yellow';
    case 'Returned': return 'badge-blue';
    case 'Expired': return 'badge-red';
    default: return 'badge-gray';
  }
}

export default function ClientMaterialPage() {
  const {
    clientMaterials,
    addClientMaterial,
    updateClientMaterial,
    deleteClientMaterial,
    issueClientMaterial,
    returnClientMaterial,
  } = useWMSStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ClientMaterial | null>(null);
  const [issuingRecord, setIssuingRecord] = useState<ClientMaterial | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    itemName: '',
    description: '',
    category: 'Other',
    unit: 'Piece',
    clientName: '',
    projectNumber: '',
    receivedDate: format(new Date(), 'yyyy-MM-dd'),
    expectedReturnDate: '',
    quantityIn: 0,
    location: '',
    remarks: '',
  });

  const [issueData, setIssueData] = useState({
    quantity: 0,
    issuedTo: '',
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    source: 'Stock Out',
    jobNumber: '',
    remarks: '',
  });

  const filtered = useMemo(() => {
    return clientMaterials.filter(r => {
      const matchSearch = !search ||
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        r.itemName.toLowerCase().includes(search.toLowerCase()) ||
        r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.projectNumber.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [clientMaterials, search, statusFilter]);

  const stats = useMemo(() => ({
    total: clientMaterials.length,
    totalIn: clientMaterials.reduce((s, r) => s + r.quantityIn, 0),
    totalOut: clientMaterials.reduce((s, r) => s + r.quantityOut, 0),
    withClients: clientMaterials.filter(r => r.status === 'Issued').length,
  }), [clientMaterials]);

  const openAddModal = () => {
    setEditingRecord(null);
    setFormData({
      code: generateCode(clientMaterials),
      itemName: '',
      description: '',
      category: 'Other',
      unit: 'Piece',
      clientName: '',
      projectNumber: '',
      receivedDate: format(new Date(), 'yyyy-MM-dd'),
      expectedReturnDate: '',
      quantityIn: 0,
      location: '',
      remarks: '',
    });
    setShowModal(true);
  };

  const openEditModal = (record: ClientMaterial) => {
    setEditingRecord(record);
    setFormData({
      code: record.code,
      itemName: record.itemName,
      description: record.description,
      category: record.category,
      unit: record.unit,
      clientName: record.clientName,
      projectNumber: record.projectNumber,
      receivedDate: record.receivedDate,
      expectedReturnDate: record.expectedReturnDate,
      quantityIn: record.quantityIn,
      location: record.location,
      remarks: record.remarks,
    });
    setShowModal(true);
  };

  const openIssueModal = (record: ClientMaterial) => {
    setIssuingRecord(record);
    setIssueData({
      quantity: 0,
      issuedTo: '',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      source: 'Stock Out',
      jobNumber: '',
      remarks: '',
    });
    setShowIssueModal(true);
  };

  const handleSave = () => {
    if (!formData.itemName || !formData.clientName || formData.quantityIn <= 0) return;

    if (editingRecord) {
      updateClientMaterial(editingRecord.id, {
        itemName: formData.itemName,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        clientName: formData.clientName,
        projectNumber: formData.projectNumber,
        receivedDate: formData.receivedDate,
        expectedReturnDate: formData.expectedReturnDate,
        quantityIn: formData.quantityIn,
        location: formData.location,
        remarks: formData.remarks,
      });
    } else {
      addClientMaterial({
        code: formData.code,
        itemName: formData.itemName,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        clientName: formData.clientName,
        projectNumber: formData.projectNumber,
        receivedDate: formData.receivedDate,
        expectedReturnDate: formData.expectedReturnDate,
        quantityIn: formData.quantityIn,
        quantityOut: 0,
        balance: formData.quantityIn,
        location: formData.location,
        status: 'In Stock',
        issuedTo: '',
        issuedDate: '',
        remarks: formData.remarks,
        createdBy: 'admin',
      });
    }
    setShowModal(false);
    setEditingRecord(null);
  };

  const handleIssue = () => {
    if (!issuingRecord || issueData.quantity <= 0 || !issueData.issuedTo) return;
    if (issueData.quantity > issuingRecord.balance) return;

    issueClientMaterial(
      issuingRecord.id,
      issueData.quantity,
      issueData.issuedTo,
      issueData.issueDate,
      issueData.source,
      issueData.jobNumber,
      issueData.remarks,
    );
    setShowIssueModal(false);
    setIssuingRecord(null);
  };

  const handleReturn = (record: ClientMaterial) => {
    if (window.confirm(`Return all remaining ${record.balance} ${record.unit} of "${record.itemName}" from ${record.clientName}?`)) {
      returnClientMaterial(record.id, record.balance);
    }
  };

  const handleDelete = (record: ClientMaterial) => {
    if (window.confirm(`Delete "${record.code} - ${record.itemName}"?`)) {
      deleteClientMaterial(record.id);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const rows = filtered.map(r =>
      `<tr>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.code}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.itemName}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.clientName}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.projectNumber || '-'}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">${r.quantityIn} ${r.unit}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">${r.quantityOut} ${r.unit}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${r.balance} ${r.unit}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.expectedReturnDate ? format(new Date(r.expectedReturnDate), 'dd MMM yyyy') : '-'}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.status}</td>
      </tr>`
    ).join('');

    printWindow.document.write(`
      <html><head><title>Client Materials Report</title></head>
      <body>
        <h2 style="text-align:center;margin-bottom:4px">Client Materials Report</h2>
        <p style="text-align:center;color:#6b7280;margin-top:0">Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Code</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Item Name</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Client</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Project#</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">Qty In</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">Qty Out</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">Balance</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Exp. Return</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Status</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="text-align:center;margin-top:16px;color:#6b7280;font-size:11px">&copy; 2026 AMSER - Sulzer</p>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const detailRecord = clientMaterials.find(r => r.id === showDetail);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Client Materials</h1>
            <p className="text-sm text-gray-500">Manage items temporarily held by clients</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Client Material
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total In</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.totalIn}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Out</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalOut}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Currently With Clients</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.withClients}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code, item, client, or project..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field w-44"
          >
            <option value="">All Status</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Item Name</th>
                <th className="px-4 py-3 text-left">Client Name</th>
                <th className="px-4 py-3 text-left">Project#</th>
                <th className="px-4 py-3 text-right">Qty In</th>
                <th className="px-4 py-3 text-right">Qty Out</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-left">Exp. Return Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-blue-600">{record.code}</td>
                  <td className="table-cell">{record.itemName}</td>
                  <td className="table-cell">{record.clientName}</td>
                  <td className="table-cell">{record.projectNumber || '-'}</td>
                  <td className="table-cell text-right">{record.quantityIn} {record.unit}</td>
                  <td className="table-cell text-right">{record.quantityOut} {record.unit}</td>
                  <td className="table-cell text-right font-bold">{record.balance} {record.unit}</td>
                  <td className="table-cell">
                    {record.expectedReturnDate ? format(new Date(record.expectedReturnDate), 'dd MMM yyyy') : '-'}
                  </td>
                  <td className="table-cell">
                    <span className={`${getStatusBadge(record.status)} inline-block`}>{record.status}</span>
                  </td>
                  <td className="table-cell text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setShowDetail(record.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => openEditModal(record)} className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      {record.status === 'In Stock' && record.balance > 0 && (
                        <button onClick={() => openIssueModal(record)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title="Issue">
                          <Upload className="w-4 h-4" />
                        </button>
                      )}
                      {record.status === 'Issued' && record.balance > 0 && (
                        <button onClick={() => handleReturn(record)} className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-600" title="Return">
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleDelete(record)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">No client materials found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} of {clientMaterials.length} records</div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingRecord(null); }}
        title={editingRecord ? `Edit Client Material - ${editingRecord.code}` : 'New Client Material'}
        maxWidth="max-w-3xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Code</label>
            <input
              type="text"
              value={formData.code}
              disabled
              className="input-field bg-gray-50"
            />
          </div>
          <div>
            <label className="label-field">Item Name *</label>
            <input
              type="text"
              value={formData.itemName}
              onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
              className="input-field"
              placeholder="Enter item name"
            />
          </div>
          <div className="col-span-2">
            <label className="label-field">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input-field"
              rows={2}
              placeholder="Item description"
            />
          </div>
          <div>
            <label className="label-field">Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="select-field"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Unit</label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="select-field"
            >
              {UNITS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Client Name *</label>
            <input
              type="text"
              value={formData.clientName}
              onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
              className="input-field"
              placeholder="Client name"
            />
          </div>
          <div>
            <label className="label-field">Project Number</label>
            <input
              type="text"
              value={formData.projectNumber}
              onChange={(e) => setFormData({ ...formData, projectNumber: e.target.value })}
              className="input-field"
              placeholder="Project number"
            />
          </div>
          <div>
            <label className="label-field">Received Date *</label>
            <input
              type="date"
              value={formData.receivedDate}
              onChange={(e) => setFormData({ ...formData, receivedDate: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Expected Return Date</label>
            <input
              type="date"
              value={formData.expectedReturnDate}
              onChange={(e) => setFormData({ ...formData, expectedReturnDate: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Quantity In *</label>
            <input
              type="number"
              min="1"
              value={formData.quantityIn || ''}
              onChange={(e) => setFormData({ ...formData, quantityIn: +e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="input-field"
              placeholder="e.g. A-01-01"
            />
          </div>
          <div className="col-span-2">
            <label className="label-field">Remarks</label>
            <textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="input-field"
              rows={2}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => { setShowModal(false); setEditingRecord(null); }} className="btn-secondary">Cancel</button>
          <button
            onClick={handleSave}
            className="btn-primary"
            disabled={!formData.itemName || !formData.clientName || formData.quantityIn <= 0}
          >
            {editingRecord ? 'Update' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showIssueModal}
        onClose={() => { setShowIssueModal(false); setIssuingRecord(null); }}
        title={`Issue Material - ${issuingRecord?.code || ''}`}
        maxWidth="max-w-lg"
      >
        {issuingRecord && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Item:</span> {issuingRecord.itemName} |
                <span className="font-medium ml-2">Available:</span> {issuingRecord.balance} {issuingRecord.unit}
              </p>
            </div>
            <div>
              <label className="label-field">Quantity to Issue *</label>
              <input
                type="number"
                min="1"
                max={issuingRecord.balance}
                value={issueData.quantity || ''}
                onChange={(e) => setIssueData({ ...issueData, quantity: +e.target.value })}
                className="input-field"
              />
              {issueData.quantity > issuingRecord.balance && (
                <p className="text-xs text-red-500 mt-1">Cannot exceed available balance of {issuingRecord.balance}</p>
              )}
            </div>
            <div>
              <label className="label-field">Issued To *</label>
              <input
                type="text"
                value={issueData.issuedTo}
                onChange={(e) => setIssueData({ ...issueData, issuedTo: e.target.value })}
                className="input-field"
                placeholder="Person or department"
              />
            </div>
            <div>
              <label className="label-field">Issue Date</label>
              <input
                type="date"
                value={issueData.issueDate}
                onChange={(e) => setIssueData({ ...issueData, issueDate: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="label-field">Source</label>
              <select
                value={issueData.source}
                onChange={(e) => setIssueData({ ...issueData, source: e.target.value })}
                className="select-field"
              >
                <option value="Stock Out">Stock Out</option>
                <option value="Form Request">Form Request</option>
              </select>
            </div>
            <div>
              <label className="label-field">Job Number</label>
              <input
                type="text"
                value={issueData.jobNumber}
                onChange={(e) => setIssueData({ ...issueData, jobNumber: e.target.value })}
                className="input-field"
                placeholder="Job number"
              />
            </div>
            <div>
              <label className="label-field">Remarks</label>
              <input
                type="text"
                value={issueData.remarks}
                onChange={(e) => setIssueData({ ...issueData, remarks: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => { setShowIssueModal(false); setIssuingRecord(null); }} className="btn-secondary">Cancel</button>
          <button
            onClick={handleIssue}
            className="btn-primary"
            disabled={!issuingRecord || issueData.quantity <= 0 || !issueData.issuedTo || issueData.quantity > (issuingRecord?.balance || 0)}
          >
            Issue
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Client Material Details">
        {detailRecord && (
          <div className="space-y-3">
            {Object.entries({
              'Code': detailRecord.code,
              'Item Name': detailRecord.itemName,
              'Description': detailRecord.description || '-',
              'Category': detailRecord.category,
              'Unit': detailRecord.unit,
              'Client Name': detailRecord.clientName,
              'Project Number': detailRecord.projectNumber || '-',
              'Received Date': format(new Date(detailRecord.receivedDate), 'dd MMM yyyy'),
              'Expected Return Date': detailRecord.expectedReturnDate ? format(new Date(detailRecord.expectedReturnDate), 'dd MMM yyyy') : '-',
              'Quantity In': `${detailRecord.quantityIn} ${detailRecord.unit}`,
              'Quantity Out': `${detailRecord.quantityOut} ${detailRecord.unit}`,
              'Balance': `${detailRecord.balance} ${detailRecord.unit}`,
              'Location': detailRecord.location || '-',
              'Status': detailRecord.status,
              'Issued To': detailRecord.issuedTo || '-',
              'Issued Date': detailRecord.issuedDate ? format(new Date(detailRecord.issuedDate), 'dd MMM yyyy') : '-',
              'Remarks': detailRecord.remarks || '-',
            }).map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-medium text-gray-900">{label === 'Status' ? <span className={getStatusBadge(String(value))}>{value}</span> : value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
