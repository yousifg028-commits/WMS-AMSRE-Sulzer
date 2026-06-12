import { useState, useEffect, useRef } from 'react';
import { Warehouse, CheckCircle, AlertCircle, Search, X } from 'lucide-react';

interface Item {
  id: string;
  itemCode: string;
  itemName: string;
  unit: string;
  trackerGroup: string;
  availableQty: number;
}

interface Employee {
  id: string;
  employeeName: string;
  department: string;
}

interface Job {
  id: string;
  jobNumber: string;
  jobName: string;
  status: string;
}

interface FormData {
  employeeName: string;
  itemId: string;
  quantity: string;
  jobNumber: string;
  remarks: string;
}

export default function PublicStockOutForm() {
  const [items, setItems] = useState<Item[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [formData, setFormData] = useState<FormData>({
    employeeName: '',
    itemId: '',
    quantity: '',
    jobNumber: '',
    remarks: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);

  const [itemSearch, setItemSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [empSearch, setEmpSearch] = useState('');
  const [showEmpDropdown, setShowEmpDropdown] = useState(false);
  const [empHighlightIdx, setEmpHighlightIdx] = useState(-1);
  const empDropdownRef = useRef<HTMLDivElement>(null);
  const empInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/public/stock-data')
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items || []);
        setEmployees(data.employees || []);
        setJobs(data.jobs || []);
      })
      .catch(() => setError('Failed to load data'));
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (empDropdownRef.current && !empDropdownRef.current.contains(e.target as Node)) {
        setShowEmpDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filteredItems = items.filter((item) => {
    if (!itemSearch) return true;
    const q = itemSearch.toLowerCase();
    return item.itemCode.toLowerCase().includes(q) || item.itemName.toLowerCase().includes(q);
  }).filter((item) => item.availableQty > 0);

  const handleItemSelect = (item: Item) => {
    setSelectedItem(item);
    setFormData((prev) => ({ ...prev, itemId: item.id, quantity: '' }));
    setItemSearch(`${item.itemCode} - ${item.itemName}`);
    setShowDropdown(false);
    setHighlightIdx(-1);
  };

  const handleItemKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleItemSelect(filteredItems[highlightIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const clearItem = () => {
    setSelectedItem(null);
    setItemSearch('');
    setFormData((prev) => ({ ...prev, itemId: '', quantity: '' }));
    inputRef.current?.focus();
  };

  const filteredEmployees = employees.filter((emp) => {
    if (!empSearch) return true;
    const q = empSearch.toLowerCase();
    return emp.employeeName.toLowerCase().includes(q) || (emp.department || '').toLowerCase().includes(q);
  });

  const handleEmpSelect = (emp: Employee) => {
    setFormData((prev) => ({ ...prev, employeeName: emp.employeeName }));
    setEmpSearch(emp.employeeName);
    setShowEmpDropdown(false);
    setEmpHighlightIdx(-1);
  };

  const handleEmpKeyDown = (e: React.KeyboardEvent) => {
    if (!showEmpDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setEmpHighlightIdx((prev) => Math.min(prev + 1, filteredEmployees.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setEmpHighlightIdx((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && empHighlightIdx >= 0) {
      e.preventDefault();
      handleEmpSelect(filteredEmployees[empHighlightIdx]);
    } else if (e.key === 'Escape') {
      setShowEmpDropdown(false);
    }
  };

  const clearEmp = () => {
    setFormData((prev) => ({ ...prev, employeeName: '' }));
    setEmpSearch('');
    empInputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const employeeName = formData.employeeName || empSearch;
    if (!employeeName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!formData.itemId) {
      setError('Please select an item');
      return;
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      setError('Please enter a valid quantity');
      return;
    }

    const qty = parseFloat(formData.quantity);
    if (selectedItem && qty > selectedItem.availableQty) {
      setError(`Available quantity is only ${selectedItem.availableQty} ${selectedItem.unit}`);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/public/stock-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            employeeName: employeeName.trim(),
            itemId: formData.itemId,
            quantity: qty,
            jobNumber: formData.jobNumber.trim(),
            remarks: formData.remarks.trim(),
          }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to submit request');
        setLoading(false);
        return;
      }

      setSuccess(true);
      setFormData({ employeeName: '', itemId: '', quantity: '', jobNumber: '', remarks: '' });
      setSelectedItem(null);
      setItemSearch('');
      setEmpSearch('');
    } catch {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-gray-900 to-green-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h1>
            <p className="text-gray-500 mb-6">Your stock out request has been sent for processing.</p>
            <button
              onClick={() => setSuccess(false)}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Submit Another Request
            </button>
          </div>
          <p className="text-gray-500 text-xs mt-4">&copy; 2026 AMSER - Sulzer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Warehouse className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">AMSER - Sulzer</h1>
          <p className="text-gray-400 text-sm mt-1">Stock Out Request</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative" ref={empDropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Your Name *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={empInputRef}
                  type="text"
                  value={empSearch}
                  onChange={(e) => {
                    setEmpSearch(e.target.value);
                    setShowEmpDropdown(true);
                    setEmpHighlightIdx(-1);
                    if (formData.employeeName) {
                      setFormData((prev) => ({ ...prev, employeeName: '' }));
                    }
                  }}
                  onFocus={() => setShowEmpDropdown(true)}
                  onKeyDown={handleEmpKeyDown}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={employees.length > 0 ? "Type to search your name..." : "Enter your full name"}
                  autoComplete="off"
                  required
                />
                {empSearch && (
                  <button type="button" onClick={clearEmp} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              {showEmpDropdown && filteredEmployees.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredEmployees.map((emp, idx) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => handleEmpSelect(emp)}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${
                        idx === empHighlightIdx ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">{emp.employeeName}</div>
                      {emp.department && <div className="text-gray-500 text-xs">{emp.department}</div>}
                    </button>
                  ))}
                </div>
              )}
              {showEmpDropdown && empSearch && filteredEmployees.length === 0 && employees.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-400">
                  No employees found
                </div>
              )}
              {employees.length === 0 && !formData.employeeName && (
                <p className="text-xs text-gray-400 mt-1">No employees in system. You can type your name manually.</p>
              )}
            </div>

            <div className="relative" ref={dropdownRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1">Item *</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={itemSearch}
                  onChange={(e) => {
                    setItemSearch(e.target.value);
                    setShowDropdown(true);
                    setHighlightIdx(-1);
                    if (selectedItem) {
                      setSelectedItem(null);
                      setFormData((prev) => ({ ...prev, itemId: '', quantity: '' }));
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onKeyDown={handleItemKeyDown}
                  className="w-full border border-gray-300 rounded-lg pl-9 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Type to search items..."
                  autoComplete="off"
                />
                {itemSearch && (
                  <button type="button" onClick={clearItem} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              {showDropdown && filteredItems.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredItems.map((item, idx) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemSelect(item)}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 transition-colors border-b border-gray-50 last:border-0 ${
                        idx === highlightIdx ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="font-medium text-gray-900">{item.itemCode}</div>
                      <div className="text-gray-500 text-xs">{item.itemName}</div>
                      <div className="text-xs mt-0.5">
                        <span className="text-blue-600 font-medium">{item.availableQty} {item.unit}</span>
                        {item.trackerGroup && (
                          <span className="ml-2 bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded text-[10px]">{item.trackerGroup}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showDropdown && itemSearch && filteredItems.length === 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-center text-sm text-gray-400">
                  No items found
                </div>
              )}
            </div>

            {selectedItem && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-700">
                  Available: <span className="font-bold">{selectedItem.availableQty} {selectedItem.unit}</span>
                </p>
                {selectedItem.trackerGroup && (
                  <p className="text-xs text-blue-500 mt-1">Tracker: {selectedItem.trackerGroup}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={selectedItem?.availableQty || undefined}
                value={formData.quantity}
                onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter quantity"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Job Number</label>
              {jobs.length > 0 ? (
                <select
                  value={formData.jobNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, jobNumber: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">No job (general use)</option>
                  {jobs.filter((j) => j.status === 'Active').map((job) => (
                    <option key={job.id} value={job.jobNumber}>
                      {job.jobNumber} - {job.jobName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={formData.jobNumber}
                  onChange={(e) => setFormData((prev) => ({ ...prev, jobNumber: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter job number (optional)"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                value={formData.remarks}
                onChange={(e) => setFormData((prev) => ({ ...prev, remarks: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={2}
                placeholder="Optional reason or notes..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                'Submit Request'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-xs mt-4">&copy; 2026 AMSER - Sulzer. All rights reserved.</p>
      </div>
    </div>
  );
}
