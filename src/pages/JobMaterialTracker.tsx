import { useState, useMemo } from 'react';
import { Search, Wrench, Eye, ChevronLeft, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { format, printTable } from '../utils/helpers';

export default function JobMaterialTracker() {
  const { stockOutRecords, jobs, batchLedger } = useWMSStore();
  const [search, setSearch] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);

  const jobMaterialRecords = useMemo(() => {
    return stockOutRecords.filter(r => {
      return r.jobNumber && r.jobNumber.trim() !== '';
    });
  }, [stockOutRecords]);

  const jobSummary = useMemo(() => {
    return jobs.map(job => {
      const records = jobMaterialRecords.filter(r => r.jobNumber === job.jobNumber);
      const totalQty = records.reduce((s, r) => s + r.quantity, 0);
      const uniqueItems = [...new Set(records.map(r => r.itemId))];
      const employees = [...new Set(records.map(r => r.employeeName))];
      return {
        ...job,
        totalIssues: records.length,
        totalQty,
        uniqueItemCount: uniqueItems.length,
        employeeCount: employees.length,
        employees,
        records,
      };
    });
  }, [jobs, jobMaterialRecords]);

  const filteredJobs = useMemo(() => {
    return jobSummary.filter(j => {
      return !search ||
        j.jobNumber.toLowerCase().includes(search.toLowerCase()) ||
        j.jobName.toLowerCase().includes(search.toLowerCase());
    });
  }, [jobSummary, search]);

  const selectedJobData = jobs.find(j => j.id === selectedJob);
  const selectedJobRecords = selectedJobData
    ? jobMaterialRecords.filter(r => r.jobNumber === selectedJobData.jobNumber)
    : [];

  const itemSummary = useMemo(() => {
    if (!selectedJobData) return [];
    const items: Record<string, { itemId: string; itemCode: string; itemName: string; totalQty: number; batches: string[]; employees: Set<string>; dates: string[] }> = {};
    selectedJobRecords.forEach(r => {
      if (!items[r.itemId]) {
        items[r.itemId] = { itemId: r.itemId, itemCode: r.itemCode, itemName: r.itemName, totalQty: 0, batches: [], employees: new Set(), dates: [] };
      }
      items[r.itemId].totalQty += r.quantity;
      if (!items[r.itemId].batches.includes(r.batchId)) items[r.itemId].batches.push(r.batchId);
      items[r.itemId].employees.add(r.employeeName);
      if (!items[r.itemId].dates.includes(r.issueDate)) items[r.itemId].dates.push(r.issueDate);
    });
    return Object.values(items).map(item => {
      const batchInfo = item.batches.map(bId => {
        const batch = batchLedger.find(b => b.batchId === bId);
        return batch ? { batchId: bId, balance: batch.balance } : { batchId: bId, balance: 0 };
      });
      return { ...item, batchInfo };
    }).sort((a, b) => b.totalQty - a.totalQty);
  }, [selectedJobData, selectedJobRecords, batchLedger]);

  const detailRecord = jobMaterialRecords.find(r => r.id === showDetail);

  const handlePrint = () => {
    const headers = ['Job #', 'Job Name', 'Status', 'Issues', 'Total Qty', 'Items', 'Employees'];
    const rows = filteredJobs.map(j => [
      j.jobNumber, j.jobName, j.status, j.totalIssues, j.totalQty, j.uniqueItemCount, j.employeeCount,
    ]);
    printTable('Job Material Tracker', headers, rows);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
            <Wrench className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Job Material Tracker</h1>
            <p className="text-sm text-gray-500">Track materials issued against each job</p>
          </div>
        </div>
        <button onClick={handlePrint} className="btn-secondary flex items-center gap-2">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {!selectedJob ? (
        <>
          <div className="grid grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-xs font-medium text-gray-500 uppercase">Total Jobs</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{jobs.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-medium text-gray-500 uppercase">Active Jobs</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{jobs.filter(j => j.status === 'Active').length}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-medium text-gray-500 uppercase">Total Issues</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{jobMaterialRecords.filter(r => r.jobNumber).length}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-medium text-gray-500 uppercase">Total Qty Issued</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{jobMaterialRecords.filter(r => r.jobNumber).reduce((s, r) => s + r.quantity, 0)}</p>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="Search jobs..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredJobs.map(job => (
                <div key={job.id} onClick={() => setSelectedJob(job.id)} className="border border-gray-200 rounded-xl p-4 hover:border-orange-300 hover:shadow-md transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-indigo-600">{job.jobNumber}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      job.status === 'Active' ? 'bg-green-100 text-green-800' :
                      job.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                      job.status === 'On Hold' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>{job.status}</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{job.jobName}</h3>
                  {job.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{job.description}</p>}
                  <div className="grid grid-cols-2 gap-2 text-center border-t pt-3">
                    <div>
                      <p className="text-lg font-bold text-orange-600">{job.totalIssues}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Issues</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-blue-600">{job.totalQty}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Total Qty</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{job.uniqueItemCount}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Items</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-900">{job.employeeCount}</p>
                      <p className="text-[10px] text-gray-500 uppercase">Employees</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-500">Showing {filteredJobs.length} jobs</div>
          </div>
        </>
      ) : selectedJobData && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedJob(null)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{selectedJobData.jobNumber} — {selectedJobData.jobName}</h2>
              <p className="text-sm text-gray-500">{selectedJobData.description || 'No description'} · <span className={`font-medium ${
                selectedJobData.status === 'Active' ? 'text-green-600' : 'text-blue-600'
              }`}>{selectedJobData.status}</span></p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-xs font-medium text-gray-500 uppercase">Total Issues</p>
              <p className="text-2xl font-bold text-orange-600 mt-1">{selectedJobRecords.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-medium text-gray-500 uppercase">Unique Items</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{itemSummary.length}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-medium text-gray-500 uppercase">Total Qty</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{selectedJobRecords.reduce((s, r) => s + r.quantity, 0)}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs font-medium text-gray-500 uppercase">Employees</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{[...new Set(selectedJobRecords.map(r => r.employeeName))].length}</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Materials by Item</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left">Item Code</th>
                    <th className="px-4 py-3 text-left">Item Name</th>
                    <th className="px-4 py-3 text-right">Total Qty Issued</th>
                    <th className="px-4 py-3 text-center">Issues Count</th>
                    <th className="px-4 py-3 text-left">Batches</th>
                    <th className="px-4 py-3 text-center">Employees</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itemSummary.map(item => (
                    <tr key={item.itemId} className="hover:bg-gray-50">
                      <td className="table-cell font-medium text-indigo-600">{item.itemCode}</td>
                      <td className="table-cell">{item.itemName}</td>
                      <td className="table-cell text-right font-bold">{item.totalQty}</td>
                      <td className="table-cell text-center">{item.dates.length}</td>
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1">
                          {item.batchInfo.map(b => (
                            <span key={b.batchId} className={`text-[10px] px-1.5 py-0.5 rounded ${b.balance > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {b.batchId.slice(-6)} (bal: {b.balance})
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="table-cell text-center text-xs">{item.employees.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Issue History ({selectedJobRecords.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left">Issue #</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-left">Item</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-left">Batch</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedJobRecords.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()).map(record => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="table-cell font-medium text-blue-600">{record.issueNumber}</td>
                      <td className="table-cell">{format(new Date(record.issueDate), 'dd MMM yyyy')}</td>
                      <td className="table-cell">{record.employeeName}</td>
                      <td className="table-cell">{record.itemCode} - {record.itemName}</td>
                      <td className="table-cell text-right font-bold">{record.quantity}</td>
                      <td className="table-cell font-mono text-xs">{record.batchId}</td>
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
          </div>
        </>
      )}

      {showDetail && detailRecord && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-semibold">Material Issue Detail</h3>
              <button onClick={() => setShowDetail(null)} className="text-gray-400 hover:text-gray-600">X</button>
            </div>
            <div className="px-6 py-4 space-y-3">
              {Object.entries({
                'Issue #': detailRecord.issueNumber,
                'Date': format(new Date(detailRecord.issueDate), 'dd MMM yyyy'),
                'Job #': detailRecord.jobNumber || '-',
                'Employee': detailRecord.employeeName,
                'Department': detailRecord.department,
                'Item': `${detailRecord.itemCode} - ${detailRecord.itemName}`,
                'Qty': detailRecord.quantity,
                'Batch': detailRecord.batchId,
                'Remarks': detailRecord.remarks || '-',
              }).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">{k}</span>
                  <span className="text-sm font-medium text-gray-900">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
