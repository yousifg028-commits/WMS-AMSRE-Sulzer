import { useState, useMemo } from 'react';
import { Plus, Search, Briefcase, Edit2, Eye, Archive, RotateCcw, Trash2, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { format } from '../utils/helpers';
import type { Job } from '../types';

const statusColors: Record<string, string> = {
  'Active': 'bg-green-100 text-green-800',
  'On Hold': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-blue-100 text-blue-800',
  'Cancelled': 'bg-red-100 text-red-800',
  'Archived': 'bg-gray-100 text-gray-600',
};

export default function Jobs() {
  const { jobs, addJob, updateJob, archiveJob, restoreJob, deleteJob, stockOutRecords } = useWMSStore();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [showCreate, setShowCreate] = useState(false);
  const [editJob, setEditJob] = useState<Job | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    jobNumber: '',
    jobName: '',
    description: '',
    status: 'Active' as Job['status'],
    startDate: '',
    endDate: '',
  });

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      const matchStatus = activeTab === 'archived' ? j.status === 'Archived' : j.status !== 'Archived';
      const matchSearch = !search ||
        j.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        j.jobName.toLowerCase().includes(search.toLowerCase()) ||
        j.description.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchSearch;
    });
  }, [jobs, search, activeTab]);

  const getJobStats = (jobNumber: string) => {
    const records = stockOutRecords.filter(r => r.jobNumber === jobNumber);
    const totalQty = records.reduce((s, r) => s + r.quantity, 0);
    const uniqueItems = new Set(records.map(r => r.itemId)).size;
    return { issues: records.length, items: uniqueItems, totalQty };
  };

  const resetForm = () => {
    setFormData({ jobNumber: '', jobName: '', description: '', status: 'Active', startDate: '', endDate: '' });
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.jobNumber.trim() || !formData.jobName.trim()) return;
    addJob({
      jobNumber: formData.jobNumber.trim(),
      jobName: formData.jobName.trim(),
      description: formData.description.trim(),
      status: formData.status,
      startDate: formData.startDate,
      endDate: formData.endDate,
    });
    resetForm();
    setShowCreate(false);
  };

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editJob) return;
    updateJob(editJob.id, {
      jobName: formData.jobName.trim(),
      description: formData.description.trim(),
      status: formData.status,
      startDate: formData.startDate,
      endDate: formData.endDate,
    });
    setEditJob(null);
    resetForm();
  };

  const openEdit = (job: Job) => {
    setFormData({
      jobNumber: job.jobNumber,
      jobName: job.jobName,
      description: job.description,
      status: job.status,
      startDate: job.startDate,
      endDate: job.endDate,
    });
    setEditJob(job);
  };

  const handleDelete = (job: Job) => {
    if (window.confirm(`Delete job "${job.jobNumber} - ${job.jobName}"?`)) {
      deleteJob(job.id);
    }
  };

  const handlePrint = (job: Job) => {
    const stats = getJobStats(job.jobNumber);
    const records = stockOutRecords.filter(r => r.jobNumber === job.jobNumber);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>Job - ${job.jobNumber}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;}h1{color:#4338ca;border-bottom:2px solid #4338ca;padding-bottom:10px;}.logo{font-size:12px;color:#666;margin-bottom:5px;}table{width:100%;border-collapse:collapse;margin-top:15px;}th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;}th{background:#f3f4f6;font-weight:bold;width:150px;}</style></head><body>
      <div class="logo">AMSER - Sulzer</div><h1>Job Details</h1>
      <table><tr><th>Job Number</th><td>${job.jobNumber}</td></tr><tr><th>Job Name</th><td>${job.jobName}</td></tr>
      <tr><th>Status</th><td>${job.status}</td></tr><tr><th>Start Date</th><td>${job.startDate || '-'}</td></tr>
      <tr><th>End Date</th><td>${job.endDate || '-'}</td></tr><tr><th>Description</th><td>${job.description || '-'}</td></tr>
      <tr><th>Total Issues</th><td>${stats.issues}</td></tr><tr><th>Total Qty</th><td>${stats.totalQty}</td></tr></table>
      ${records.length > 0 ? '<h3 style="margin-top:20px;">Materials Issued</h3><table><thead><tr><th>Date</th><th>Item</th><th>Qty</th><th>Employee</th></tr></thead><tbody>' +
        records.map(r => `<tr><td>${r.issueDate}</td><td>${r.itemCode} - ${r.itemName}</td><td>${r.quantity}</td><td>${r.employeeName}</td></tr>`).join('') + '</tbody></table>' : ''}
      <p style="margin-top:20px;font-size:11px;color:#999;">Printed: ${new Date().toLocaleString()}</p>
      <script>window.onload=function(){window.print();}</script></body></html>`);
    printWindow.document.close();
  };

  const detailJob = jobs.find(j => j.id === showDetail);
  const detailRecords = detailJob ? stockOutRecords.filter(r => r.jobNumber === detailJob.jobNumber) : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
            <p className="text-sm text-gray-500">Manage job numbers and track material allocation</p>
          </div>
        </div>
        <button onClick={() => { resetForm(); setShowCreate(true); }} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Job
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Jobs</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{jobs.filter(j => j.status !== 'Archived').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Active</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{jobs.filter(j => j.status === 'Active').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Completed</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{jobs.filter(j => j.status === 'Completed').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Issues</p>
          <p className="text-2xl font-bold text-orange-600 mt-1">{stockOutRecords.filter(r => r.jobNumber).length}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button onClick={() => setActiveTab('active')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'active' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Active Jobs</button>
        <button onClick={() => setActiveTab('archived')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'archived' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>Archived Jobs</button>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" placeholder="Search by job number or name..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Job Number</th>
                <th className="px-4 py-3 text-left">Job Name</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Issues</th>
                <th className="px-4 py-3 text-center">Items</th>
                <th className="px-4 py-3 text-center">Total Qty</th>
                <th className="px-4 py-3 text-left">Start</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(job => {
                const stats = getJobStats(job.jobNumber);
                return (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="table-cell font-medium text-indigo-600">{job.jobNumber}</td>
                    <td className="table-cell">{job.jobName}</td>
                    <td className="table-cell text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="table-cell text-center">{stats.issues}</td>
                    <td className="table-cell text-center">{stats.items}</td>
                    <td className="table-cell text-center font-bold">{stats.totalQty}</td>
                    <td className="table-cell">{job.startDate || '-'}</td>
                    <td className="table-cell text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setShowDetail(job.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600" title="View">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(job)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {activeTab === 'active' ? (
                          <button onClick={() => archiveJob(job.id)} className="p-1.5 hover:bg-orange-50 rounded-lg text-orange-600" title="Archive">
                            <Archive className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => restoreJob(job.id)} className="p-1.5 hover:bg-yellow-50 rounded-lg text-yellow-600" title="Restore">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(job)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handlePrint(job)} className="p-1.5 hover:bg-green-50 rounded-lg text-green-600" title="Print">
                          <Printer className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} jobs</div>
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Job" maxWidth="max-w-lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label-field">Job Number *</label>
            <input type="text" value={formData.jobNumber} onChange={(e) => setFormData({ ...formData, jobNumber: e.target.value })} className="input-field" placeholder="e.g. JOB-011" required />
          </div>
          <div>
            <label className="label-field">Job Name *</label>
            <input type="text" value={formData.jobName} onChange={(e) => setFormData({ ...formData, jobName: e.target.value })} className="input-field" placeholder="e.g. Annual Maintenance" required />
          </div>
          <div>
            <label className="label-field">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows={3} placeholder="Brief description..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Status</label>
              <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Job['status'] })} className="select-field">
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Start Date</label>
              <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">End Date</label>
              <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary" disabled={!formData.jobNumber.trim() || !formData.jobName.trim()}>Create Job</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editJob} onClose={() => { setEditJob(null); resetForm(); }} title={`Edit ${editJob?.jobNumber}`} maxWidth="max-w-lg">
        <form onSubmit={handleEdit} className="space-y-4">
          <div>
            <label className="label-field">Job Number</label>
            <input type="text" value={formData.jobNumber} className="input-field bg-gray-50" disabled />
          </div>
          <div>
            <label className="label-field">Job Name *</label>
            <input type="text" value={formData.jobName} onChange={(e) => setFormData({ ...formData, jobName: e.target.value })} className="input-field" required />
          </div>
          <div>
            <label className="label-field">Description</label>
            <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field" rows={3} />
          </div>
          <div>
            <label className="label-field">Status</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as Job['status'] })} className="select-field">
              <option value="Active">Active</option>
              <option value="On Hold">On Hold</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label-field">Start Date</label>
              <input type="date" value={formData.startDate} onChange={(e) => setFormData({ ...formData, startDate: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">End Date</label>
              <input type="date" value={formData.endDate} onChange={(e) => setFormData({ ...formData, endDate: e.target.value })} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button type="button" onClick={() => { setEditJob(null); resetForm(); }} className="btn-secondary">Cancel</button>
            <button type="submit" className="btn-primary">Save Changes</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={detailJob ? `${detailJob.jobNumber} - ${detailJob.jobName}` : 'Job Details'} maxWidth="max-w-2xl">
        {detailJob && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                ['Job Number', detailJob.jobNumber],
                ['Status', detailJob.status],
                ['Start Date', detailJob.startDate || '-'],
                ['End Date', detailJob.endDate || '-'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className="text-sm font-medium text-gray-900">{label === 'Status' ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[detailJob.status]}`}>{value}</span>
                  ) : value}</p>
                </div>
              ))}
            </div>
            {detailJob.description && (
              <div>
                <p className="text-xs text-gray-500">Description</p>
                <p className="text-sm text-gray-900">{detailJob.description}</p>
              </div>
            )}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Materials Issued ({detailRecords.length})</h4>
              {detailRecords.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Employee</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {detailRecords.map(r => (
                        <tr key={r.id}>
                          <td className="px-3 py-2 text-xs">{format(new Date(r.issueDate), 'dd MMM yyyy')}</td>
                          <td className="px-3 py-2 text-xs">{r.itemCode} - {r.itemName}</td>
                          <td className="px-3 py-2 text-xs text-right font-bold">{r.quantity}</td>
                          <td className="px-3 py-2 text-xs">{r.employeeName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No materials issued to this job</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
