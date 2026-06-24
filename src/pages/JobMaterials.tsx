import { useState, useMemo } from 'react';
import { Plus, Search, Eye, Pencil, Trash2, Wrench, Upload, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { format, printTable } from '../utils/helpers';
import type { JobMaterial } from '../types';

const CATEGORIES = ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality', 'Other'];
const STATUS_OPTIONS: JobMaterial['status'][] = ['Pending', 'Issued', 'Cancelled'];

function generateCode(existing: JobMaterial[]): string {
  const max = existing.reduce((m, r) => {
    const n = parseInt(r.code.replace('JM-', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return `JM-${String(max + 1).padStart(3, '0')}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'Pending': return 'badge-yellow';
    case 'Issued': return 'badge-green';
    case 'Cancelled': return 'badge-red';
    default: return 'badge-gray';
  }
}

export default function JobMaterialsPage() {
  const {
    jobMaterials,
    addJobMaterial,
    updateJobMaterial,
    deleteJobMaterial,
    issueJobMaterial,
    jobs,
  } = useWMSStore();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<JobMaterial | null>(null);
  const [issuingRecord, setIssuingRecord] = useState<JobMaterial | null>(null);

  const [formData, setFormData] = useState({
    code: '',
    itemName: '',
    category: 'PPE',
    quantity: 0,
    jobNumber: '',
    jobName: '',
    remarks: '',
  });

  const [issueData, setIssueData] = useState({
    quantity: 0,
    issuedTo: '',
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    remarks: '',
  });

  const filtered = useMemo(() => {
    return jobMaterials.filter(r => {
      const matchSearch = !search ||
        r.code.toLowerCase().includes(search.toLowerCase()) ||
        r.itemName.toLowerCase().includes(search.toLowerCase()) ||
        r.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        r.jobName.toLowerCase().includes(search.toLowerCase());
      const matchStatus = !statusFilter || r.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [jobMaterials, search, statusFilter]);

  const stats = useMemo(() => ({
    total: jobMaterials.length,
    pending: jobMaterials.filter(r => r.status === 'Pending').length,
    issued: jobMaterials.filter(r => r.status === 'Issued').length,
    totalQty: jobMaterials.reduce((s, r) => s + r.quantity, 0),
  }), [jobMaterials]);

  const openAddModal = () => {
    setEditingRecord(null);
    setFormData({
      code: generateCode(jobMaterials),
      itemName: '',
      category: 'PPE',
      quantity: 0,
      jobNumber: '',
      jobName: '',
      remarks: '',
    });
    setShowModal(true);
  };

  const openEditModal = (record: JobMaterial) => {
    setEditingRecord(record);
    setFormData({
      code: record.code,
      itemName: record.itemName,
      category: record.category,
      quantity: record.quantity,
      jobNumber: record.jobNumber,
      jobName: record.jobName,
      remarks: record.remarks,
    });
    setShowModal(true);
  };

  const openIssueModal = (record: JobMaterial) => {
    setIssuingRecord(record);
    setIssueData({
      quantity: 0,
      issuedTo: '',
      issueDate: format(new Date(), 'yyyy-MM-dd'),
      remarks: '',
    });
    setShowIssueModal(true);
  };

  const handleSave = () => {
    if (!formData.itemName || !formData.jobNumber || formData.quantity <= 0) return;

    if (editingRecord) {
      updateJobMaterial(editingRecord.id, {
        itemName: formData.itemName,
        category: formData.category,
        quantity: formData.quantity,
        jobNumber: formData.jobNumber,
        jobName: formData.jobName,
        remarks: formData.remarks,
      });
    } else {
      const selectedJob = jobs.find(j => j.jobNumber === formData.jobNumber);
      addJobMaterial({
        code: formData.code,
        itemName: formData.itemName,
        category: formData.category,
        quantity: formData.quantity,
        jobNumber: formData.jobNumber,
        jobName: formData.jobName || selectedJob?.jobName || '',
        status: 'Pending',
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
    if (issueData.quantity > issuingRecord.quantity) return;

    issueJobMaterial(
      issuingRecord.id,
      issueData.quantity,
      issueData.issuedTo,
      issueData.issueDate,
      issueData.remarks,
    );
    setShowIssueModal(false);
    setIssuingRecord(null);
  };

  const handleDelete = (record: JobMaterial) => {
    if (window.confirm(`Delete "${record.code} - ${record.itemName}"?`)) {
      deleteJobMaterial(record.id);
    }
  };

  const handlePrint = () => {
    printTable(
      'Job Materials',
      ['Code', 'Item Name', 'Category', 'Qty', 'Job #', 'Job Name', 'Status'],
      filtered.map(r => [r.code, r.itemName, r.category, r.quantity, r.jobNumber, r.jobName, r.status])
    );
  };

  const detailRecord = jobMaterials.find(r => r.id === showDetail);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Wrench className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Materials</h1>
            <p className="text-sm text-gray-500">Manage materials assigned to jobs - Issue registers in Stock Out & Job Tracker</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={openAddModal} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Job Material
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Materials</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Pending</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Issued</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.issued}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Qty</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalQty}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code, item, job number..."
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
                <th className="px-4 py-3 text-left">Category</th>
                <th className="px-4 py-3 text-right">Quantity</th>
                <th className="px-4 py-3 text-left">Job #</th>
                <th className="px-4 py-3 text-left">Job Name</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-blue-600">{record.code}</td>
                  <td className="table-cell">{record.itemName}</td>
                  <td className="table-cell">{record.category}</td>
                  <td className="table-cell text-right">{record.quantity}</td>
                  <td className="table-cell font-medium">{record.jobNumber}</td>
                  <td className="table-cell">{record.jobName}</td>
                  <td className="table-cell">
                    <span className={`${getStatusBadge(record.status)} inline-block`}>{record.status}</span>
                  </td>
                  <td className="table-cell text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => setShowDetail(record.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      {record.status === 'Pending' && (
                        <>
                          <button onClick={() => openEditModal(record)} className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => openIssueModal(record)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600" title="Issue (Stock Out)">
                            <Upload className="w-4 h-4" />
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
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">No job materials found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} of {jobMaterials.length} records</div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingRecord(null); }}
        title={editingRecord ? `Edit Job Material - ${editingRecord.code}` : 'New Job Material'}
        maxWidth="max-w-2xl"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Code</label>
            <input type="text" value={formData.code} disabled className="input-field bg-gray-50" />
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
            <label className="label-field">Quantity *</label>
            <input
              type="number"
              min="1"
              value={formData.quantity || ''}
              onChange={(e) => setFormData({ ...formData, quantity: +e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="label-field">Job Number *</label>
            <select
              value={formData.jobNumber}
              onChange={(e) => {
                const job = jobs.find(j => j.jobNumber === e.target.value);
                setFormData({ ...formData, jobNumber: e.target.value, jobName: job?.jobName || '' });
              }}
              className="select-field"
            >
              <option value="">Select Job</option>
              {jobs.map(j => (
                <option key={j.jobNumber} value={j.jobNumber}>{j.jobNumber} - {j.jobName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Job Name</label>
            <input type="text" value={formData.jobName} disabled className="input-field bg-gray-50" />
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
            disabled={!formData.itemName || !formData.jobNumber || formData.quantity <= 0}
          >
            {editingRecord ? 'Update' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={showIssueModal}
        onClose={() => { setShowIssueModal(false); setIssuingRecord(null); }}
        title={`Issue to Stock Out - ${issuingRecord?.code || ''}`}
        maxWidth="max-w-lg"
      >
        {issuingRecord && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm text-gray-600">
                <span className="font-medium">Item:</span> {issuingRecord.itemName} |
                <span className="font-medium ml-2">Available:</span> {issuingRecord.quantity} |
                <span className="font-medium ml-2">Job:</span> {issuingRecord.jobNumber}
              </p>
            </div>
            <div>
              <label className="label-field">Quantity to Issue *</label>
              <input
                type="number"
                min="1"
                max={issuingRecord.quantity}
                value={issueData.quantity || ''}
                onChange={(e) => setIssueData({ ...issueData, quantity: +e.target.value })}
                className="input-field"
              />
              {issueData.quantity > issuingRecord.quantity && (
                <p className="text-xs text-red-500 mt-1">Cannot exceed available quantity of {issuingRecord.quantity}</p>
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
            disabled={!issuingRecord || issueData.quantity <= 0 || !issueData.issuedTo || issueData.quantity > (issuingRecord?.quantity || 0)}
          >
            Issue (Stock Out)
          </button>
        </div>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title="Job Material Details">
        {detailRecord && (
          <div className="space-y-3">
            {Object.entries({
              'Code': detailRecord.code,
              'Item Name': detailRecord.itemName,
              'Category': detailRecord.category,
              'Quantity': detailRecord.quantity,
              'Job Number': detailRecord.jobNumber,
              'Job Name': detailRecord.jobName || '-',
              'Status': detailRecord.status,
              'Issued To': detailRecord.issuedTo || '-',
              'Issued Date': detailRecord.issuedDate ? format(new Date(detailRecord.issuedDate), 'dd MMM yyyy') : '-',
              'Remarks': detailRecord.remarks || '-',
              'Created By': detailRecord.createdBy,
              'Created At': format(new Date(detailRecord.createdAt), 'dd MMM yyyy HH:mm'),
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
