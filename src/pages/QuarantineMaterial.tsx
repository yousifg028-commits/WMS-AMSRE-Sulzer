import { useState, useMemo } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, Shield, CheckCircle } from 'lucide-react';
import { useWMSStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { format } from '../utils/helpers';
import type { QuarantineMaterial } from '../types';

const CATEGORIES = ['Chemical', 'Equipment', 'Consumable', 'PPE', 'QC Material', 'Other'];
const UNITS = ['Box', 'Piece', 'Kg', 'Liter', 'Meter', 'Set', 'Kit', 'Other'];
const SOURCES = ['Stock In', 'Form Request', 'Client Return', 'Other'];
const ISSUE_SOURCES = ['Stock Out', 'Form Request'];
const STATUS_OPTIONS: QuarantineMaterial['status'][] = ['Under Review', 'Released', 'Rejected', 'Returned', 'Disposed'];
const RELEASE_ACTIONS: QuarantineMaterial['status'][] = ['Released', 'Rejected', 'Returned', 'Disposed'];

function generateCode(existing: QuarantineMaterial[]): string {
  const max = existing.reduce((m, r) => {
    const n = parseInt(r.code.replace('QRT-', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `QRT-${String(max + 1).padStart(3, '0')}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'Under Review': return 'badge-yellow';
    case 'Released': return 'badge-green';
    case 'Rejected': return 'badge-red';
    case 'Returned': return 'badge-blue';
    case 'Disposed': return 'badge-red';
    default: return 'badge-gray';
  }
}

export default function QuarantineMaterialPage() {
  const {
    quarantineMaterials,
    addQuarantineMaterial,
    updateQuarantineMaterial,
    deleteQuarantineMaterial,
    issueQuarantineMaterial,
    releaseQuarantineMaterial,
  } = useWMSStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<QuarantineMaterial | null>(null);
  const [issuingRecord, setIssuingRecord] = useState<QuarantineMaterial | null>(null);
  const [releasingRecord, setReleasingRecord] = useState<QuarantineMaterial | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    itemName: '',
    description: '',
    category: 'Other',
    unit: 'Piece',
    reason: '',
    source: 'Stock In',
    receivedDate: format(new Date(), 'yyyy-MM-dd'),
    quarantineDate: format(new Date(), 'yyyy-MM-dd'),
    quantityIn: 0,
    location: '',
    inspector: '',
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

  const [releaseData, setReleaseData] = useState({
    action: 'Released' as QuarantineMaterial['status'],
    inspectionResult: '',
    releaseDate: format(new Date(), 'yyyy-MM-dd'),
    issuedTo: '',
    remarks: '',
  });

  const filtered = useMemo(() => {
    return quarantineMaterials.filter(r => {
      const matchSearch = !search ||
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        r.itemName.toLowerCase().includes(search.toLowerCase()) ||
        r.reason.toLowerCase().includes(search.toLowerCase()) ||
        (r.inspector && r.inspector.toLowerCase().includes(search.toLowerCase()));
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [quarantineMaterials, search, statusFilter]);

  const stats = useMemo(() => ({
    total: quarantineMaterials.length,
    underReview: quarantineMaterials.filter(r => r.status === 'Under Review').length,
    released: quarantineMaterials.filter(r => r.status === 'Released').length,
    rejected: quarantineMaterials.filter(r => r.status === 'Rejected').length,
  }), [quarantineMaterials]);

  const openAddModal = () => {
    setEditingRecord(null);
    setFormData({
      code: generateCode(quarantineMaterials),
      itemName: '',
      description: '',
      category: 'Other',
      unit: 'Piece',
      reason: '',
      source: 'Stock In',
      receivedDate: format(new Date(), 'yyyy-MM-dd'),
      quarantineDate: format(new Date(), 'yyyy-MM-dd'),
      quantityIn: 0,
      location: '',
      inspector: '',
      remarks: '',
    });
    setShowModal(true);
  };

  const openEditModal = (record: QuarantineMaterial) => {
    setEditingRecord(record);
    setFormData({
      code: record.code,
      itemName: record.itemName,
      description: record.description,
      category: record.category,
      unit: record.unit,
      reason: record.reason,
      source: record.source,
      receivedDate: record.receivedDate,
      quarantineDate: record.quarantineDate,
      quantityIn: record.quantityIn,
      location: record.location,
      inspector: record.inspector,
      remarks: record.remarks,
    });
    setShowModal(true);
  };

  const openIssueModal = (record: QuarantineMaterial) => {
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

  const openReleaseModal = (record: QuarantineMaterial) => {
    setReleasingRecord(record);
    setReleaseData({
      action: 'Released',
      inspectionResult: '',
      releaseDate: format(new Date(), 'yyyy-MM-dd'),
      issuedTo: '',
      remarks: '',
    });
    setShowReleaseModal(true);
  };

  const handleSave = () => {
    if (!formData.itemName || !formData.reason || formData.quantityIn <= 0) return;

    if (editingRecord) {
      updateQuarantineMaterial(editingRecord.id, {
        itemName: formData.itemName,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        reason: formData.reason,
        source: formData.source,
        receivedDate: formData.receivedDate,
        quarantineDate: formData.quarantineDate,
        quantityIn: formData.quantityIn,
        location: formData.location,
        inspector: formData.inspector,
        remarks: formData.remarks,
      });
    } else {
      addQuarantineMaterial({
        code: formData.code,
        itemName: formData.itemName,
        description: formData.description,
        category: formData.category,
        unit: formData.unit,
        reason: formData.reason,
        source: formData.source,
        receivedDate: formData.receivedDate,
        quarantineDate: formData.quarantineDate,
        releaseDate: '',
        quantityIn: formData.quantityIn,
        quantityOut: 0,
        balance: formData.quantityIn,
        location: formData.location,
        status: 'Under Review',
        inspector: formData.inspector,
        inspectionResult: '',
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

    issueQuarantineMaterial(
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

  const handleRelease = () => {
    if (!releasingRecord || !releaseData.inspectionResult) return;

    releaseQuarantineMaterial(
      releasingRecord.id,
      releaseData.action,
      releaseData.inspectionResult,
      releaseData.releaseDate,
      releaseData.issuedTo,
      releaseData.remarks,
    );
    setShowReleaseModal(false);
    setReleasingRecord(null);
  };

  const handleDelete = (record: QuarantineMaterial) => {
    if (window.confirm(`Delete "${record.code} - ${record.itemName}"?`)) {
      deleteQuarantineMaterial(record.id);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const rows = filtered.map(r =>
      `<tr>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.code}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.itemName}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.reason}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">${r.quantityIn} ${r.unit}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">${r.quantityOut} ${r.unit}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right;font-weight:bold">${r.balance} ${r.unit}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.inspector || '-'}</td>
        <td style="padding:6px 8px;border:1px solid #e5e7eb">${r.status}</td>
      </tr>`
    ).join('');

    printWindow.document.write(`
      <html><head><title>Quarantine Materials Report</title></head>
      <body>
        <h2 style="text-align:center;margin-bottom:4px">Quarantine Materials Report</h2>
        <p style="text-align:center;color:#6b7280;margin-top:0">Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}</p>
        <table style="width:100%;border-collapse:collapse;font-size:12px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Code</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Item Name</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Reason</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">Qty In</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">Qty Out</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:right">Balance</th>
              <th style="padding:6px 8px;border:1px solid #e5e7eb;text-align:left">Inspector</th>
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

  const detailRecord = quarantineMaterials.find(r => r.id === showDetail);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Shield className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Quarantine Materials</h1>
            <p className="text-sm text-gray-500">Manage items under quarantine and review</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Quarantine Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Items</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Under Review</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.underReview}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Released</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.released}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Rejected</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code, item, reason, or inspector..."
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
                <th className="px-4 py-3 text-left">Reason</th>
                <th className="px-4 py-3 text-right">Qty In</th>
                <th className="px-4 py-3 text-right">Qty Out</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-left">Inspector</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-blue-600">{record.code}</td>
                  <td className="table-cell">{record.itemName}</td>
                  <td className="table-cell text-sm text-gray-600 max-w-[200px] truncate" title={record.reason}>{record.reason}</td>
                  <td className="table-cell text-right">{record.quantityIn} {record.unit}</td>
                  <td className="table-cell text-right">{record.quantityOut} {record.unit}</td>
                  <td className="table-cell text-right font-bold">{record.balance} {record.unit}</td>
                  <td className="table-cell">{record.inspector || '-'}</td>
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
                      {record.status === 'Under Review' && record.balance > 0 && (
                        <>
                          <button onClick={() => openIssueModal(record)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title="Issue from Quarantine">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => openReleaseModal(record)} className="p-1.5 hover:bg-purple-50 rounded-lg text-purple-600" title="Release / Reject">
                            <Shield className="w-4 h-4" />
                          </button>
                        </>
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
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No quarantine materials found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} of {quarantineMaterials.length} records</div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingRecord(null); }}
        title={editingRecord ? `Edit Quarantine Item - ${editingRecord.code}` : 'New Quarantine Item'}
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
          <div className="col-span-2">
            <label className="label-field">Reason for Quarantine *</label>
            <textarea
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              className="input-field"
              rows={2}
              placeholder="Describe why this item is quarantined..."
            />
          </div>
          <div>
            <label className="label-field">Source</label>
            <select
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              className="select-field"
            >
              {SOURCES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
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
            <label className="label-field">Quarantine Date</label>
            <input
              type="date"
              value={formData.quarantineDate}
              onChange={(e) => setFormData({ ...formData, quarantineDate: e.target.value })}
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
              placeholder="e.g. Q-01-01"
            />
          </div>
          <div>
            <label className="label-field">Inspector Name</label>
            <input
              type="text"
              value={formData.inspector}
              onChange={(e) => setFormData({ ...formData, inspector: e.target.value })}
              className="input-field"
              placeholder="Inspector name"
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
            disabled={!formData.itemName || !formData.reason || formData.quantityIn <= 0}
          >
            {editingRecord ? 'Update' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showIssueModal}
        onClose={() => { setShowIssueModal(false); setIssuingRecord(null); }}
        title={`Issue from Quarantine - ${issuingRecord?.code || ''}`}
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
                {ISSUE_SOURCES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
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

      <Modal
        isOpen={showReleaseModal}
        onClose={() => { setShowReleaseModal(false); setReleasingRecord(null); }}
        title={`Release / Reject - ${releasingRecord?.code || ''}`}
        maxWidth="max-w-lg"
      >
        {releasingRecord && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Item:</span> {releasingRecord.itemName} |
                <span className="font-medium ml-2">Balance:</span> {releasingRecord.balance} {releasingRecord.unit}
              </p>
            </div>
            <div>
              <label className="label-field">Action *</label>
              <select
                value={releaseData.action}
                onChange={(e) => setReleaseData({ ...releaseData, action: e.target.value as QuarantineMaterial['status'] })}
                className="select-field"
              >
                {RELEASE_ACTIONS.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Inspection Result *</label>
              <textarea
                value={releaseData.inspectionResult}
                onChange={(e) => setReleaseData({ ...releaseData, inspectionResult: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Describe the inspection result and findings..."
              />
            </div>
            <div>
              <label className="label-field">Release Date</label>
              <input
                type="date"
                value={releaseData.releaseDate}
                onChange={(e) => setReleaseData({ ...releaseData, releaseDate: e.target.value })}
                className="input-field"
              />
            </div>
            {(releaseData.action === 'Released' || releaseData.action === 'Returned') && (
              <div>
                <label className="label-field">Issued To</label>
                <input
                  type="text"
                  value={releaseData.issuedTo}
                  onChange={(e) => setReleaseData({ ...releaseData, issuedTo: e.target.value })}
                  className="input-field"
                  placeholder="Person or department"
                />
              </div>
            )}
            <div>
              <label className="label-field">Remarks</label>
              <input
                type="text"
                value={releaseData.remarks}
                onChange={(e) => setReleaseData({ ...releaseData, remarks: e.target.value })}
                className="input-field"
              />
            </div>
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => { setShowReleaseModal(false); setReleasingRecord(null); }} className="btn-secondary">Cancel</button>
          <button
            onClick={handleRelease}
            className="btn-primary"
            disabled={!releasingRecord || !releaseData.inspectionResult}
          >
            Confirm {releaseData.action}
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Quarantine Material Details">
        {detailRecord && (
          <div className="space-y-3">
            {Object.entries({
              'Code': detailRecord.code,
              'Item Name': detailRecord.itemName,
              'Description': detailRecord.description || '-',
              'Category': detailRecord.category,
              'Unit': detailRecord.unit,
              'Reason for Quarantine': detailRecord.reason,
              'Source': detailRecord.source,
              'Received Date': format(new Date(detailRecord.receivedDate), 'dd MMM yyyy'),
              'Quarantine Date': detailRecord.quarantineDate ? format(new Date(detailRecord.quarantineDate), 'dd MMM yyyy') : '-',
              'Quantity In': `${detailRecord.quantityIn} ${detailRecord.unit}`,
              'Quantity Out': `${detailRecord.quantityOut} ${detailRecord.unit}`,
              'Balance': `${detailRecord.balance} ${detailRecord.unit}`,
              'Location': detailRecord.location || '-',
              'Inspector': detailRecord.inspector || '-',
              'Inspection Result': detailRecord.inspectionResult || '-',
              'Status': detailRecord.status,
              'Release Date': detailRecord.releaseDate ? format(new Date(detailRecord.releaseDate), 'dd MMM yyyy') : '-',
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
