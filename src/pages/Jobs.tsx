import { useState, useMemo } from 'react';
import { Plus, Search, Briefcase, Edit2, Eye } from 'lucide-react';
import { useWMSStore } from '../store';
import { Modal } from '../components/ui/Modal';
import { format } from '../utils/helpers';
import type { Job } from '../types';

const statusColors: Record<Job['status'], string> = {
  'Active': 'bg-green-100 text-green-800',
  'On Hold': 'bg-yellow-100 text-yellow-800',
  'Completed': 'bg-blue-100 text-blue-800',
  'Cancelled': 'bg-red-100 text-red-800',
};

export default function Jobs() {
  const { jobs, addJob, updateJob, stockOutRecords } = useWMSStore();
  const [search, setSearch] = useState('');
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
      return !search ||
        j.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        j.jobName.toLowerCase().includes(search.toLowerCase()) ||
        j.description.toLowerCase().includes(search.toLowerCase());
    });
  }, [jobs, search]);

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
          <p className="text-2xl font-bold text-gray-900 mt-1">{jobs.length}</p>
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
                        <button onClick={() => setShowDetail(job.id)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(job)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600">
                          <Edit2 className="w-4 h-4" />
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
