import { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, XCircle, RefreshCw, ExternalLink, Download, FileSpreadsheet, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import { printTable } from '../utils/helpers';

interface PendingRequest {
  id: string;
  requestNumber: string;
  employeeId: string;
  employeeName: string;
  department: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  jobNumber: string;
  remarks: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
}

export default function FormRequestsSheet() {
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const store = useWMSStore();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('wms_token');
      const res = await fetch('/api/pending-requests', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    const token = localStorage.getItem('wms_token');
    if (token) {
      fetch('/api/server/backfill-stockout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then(() => fetchRequests()).catch(() => {});
    }
  }, []);
  useEffect(() => {
    const interval = setInterval(fetchRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (req: PendingRequest) => {
    const token = localStorage.getItem('wms_token');
    try {
      const res = await fetch(`/api/pending-requests/${req.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'Failed to approve request');
        fetchRequests();
        return;
      }

      if (data.stockOut) {
        const storeItem = store.masterItems.find((i) => i.itemCode === req.itemCode);
        const serverRecord = {
          ...data.stockOut,
          itemId: storeItem ? storeItem.id : data.stockOut.itemId,
        };
        store.applyServerStockOut(serverRecord);

        store.addAuditEntry({
          action: 'FORM_REQUEST_APPROVED',
          module: 'Form Requests',
          recordId: req.id,
          beforeValue: JSON.stringify({ status: 'Pending' }),
          afterValue: JSON.stringify({ status: 'Approved', issueNumber: data.stockOut.issueNumber }),
          performedBy: req.approvedBy || 'System',
        });
      }
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      alert('Network error. Please try again.');
    }
    fetchRequests();
  };

  const handleReject = async (req: PendingRequest) => {
    const token = localStorage.getItem('wms_token');
    await fetch(`/api/pending-requests/${req.id}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    store.addAuditEntry({
      action: 'FORM_REQUEST_REJECTED',
      module: 'Form Requests',
      recordId: req.id,
      beforeValue: JSON.stringify({ status: 'Pending' }),
      afterValue: JSON.stringify({ status: 'Rejected' }),
      performedBy: 'System',
    });
    fetchRequests();
  };

  const filtered = requests.filter((r) => {
    if (tab === 'all') return true;
    return r.status.toLowerCase() === tab;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === 'Pending').length,
    approved: requests.filter((r) => r.status === 'Approved').length,
    rejected: requests.filter((r) => r.status === 'Rejected').length,
  };

  const exportCSV = () => {
    const headers = ['Request #', 'Date', 'Employee', 'Department', 'Item Code', 'Item Name', 'Qty', 'Unit', 'Status', 'Remarks'];
    const rows = requests.map((r) => [
      r.requestNumber, new Date(r.createdAt).toLocaleString(), r.employeeName, r.department,
      r.itemCode, r.itemName, r.quantity, r.unit, r.status, r.remarks,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `form-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const headers = ['Request #', 'Date', 'Employee', 'Department', 'Item Code', 'Item Name', 'Qty', 'Unit', 'Status', 'Remarks'];
    const rows = filtered.map(r => [
      r.requestNumber, new Date(r.createdAt).toLocaleString(), r.employeeName, r.department,
      r.itemCode, r.itemName, r.quantity, r.unit, r.status, r.remarks || '-',
    ]);
    printTable('Form Requests', headers, rows);
  };

  const formUrl = window.location.origin + '/request-stock';

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-8 h-8 text-green-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Form Requests Sheet</h1>
            <p className="text-sm text-gray-500">All stock out requests submitted via Google Form</p>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={formUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            <ExternalLink className="w-4 h-4" /> Open Form
          </a>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
            <Printer className="w-4 h-4" /> Print
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={fetchRequests} className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-blue-700 font-medium mb-1">Google Form Link:</p>
        <p className="text-blue-600 font-mono text-sm break-all">{formUrl}</p>
        <p className="text-xs text-blue-500 mt-1">Share this link with employees or use the QR Code page to print it</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <button onClick={() => setTab('all')} className={`p-3 rounded-xl border-2 text-center transition-colors ${tab === 'all' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total</p>
        </button>
        <button onClick={() => setTab('pending')} className={`p-3 rounded-xl border-2 text-center transition-colors ${tab === 'pending' ? 'border-yellow-500 bg-yellow-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
          <p className="text-xs text-gray-500">Pending</p>
        </button>
        <button onClick={() => setTab('approved')} className={`p-3 rounded-xl border-2 text-center transition-colors ${tab === 'approved' ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          <p className="text-xs text-gray-500">Approved</p>
        </button>
        <button onClick={() => setTab('rejected')} className={`p-3 rounded-xl border-2 text-center transition-colors ${tab === 'rejected' ? 'border-red-500 bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
          <p className="text-xs text-gray-500">Rejected</p>
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
          <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-lg">No requests found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Request #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Employee</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Department</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Item</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Qty</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Remarks</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-blue-600">{req.requestNumber}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(req.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{req.employeeName}</td>
                  <td className="px-4 py-3 text-gray-500">{req.department}</td>
                  <td className="px-4 py-3">
                    <span className="text-gray-900 font-medium">{req.itemCode}</span>
                    <span className="text-gray-400 ml-1">{req.itemName}</span>
                  </td>
                  <td className="px-4 py-3 text-center font-medium">{req.quantity} {req.unit}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                      req.status === 'Approved' ? 'bg-green-100 text-green-700' :
                      req.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>{req.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs max-w-[200px] truncate">{req.remarks || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    {req.status === 'Pending' && (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleApprove(req)} className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-700 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => handleReject(req)} className="bg-red-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-red-700 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Reject
                        </button>
                      </div>
                    )}
                    {req.status === 'Approved' && (
                      <span className="text-xs text-green-600 font-medium">By {req.approvedBy}</span>
                    )}
                    {req.status === 'Rejected' && (
                      <span className="text-xs text-red-600 font-medium">By {req.rejectedBy}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
