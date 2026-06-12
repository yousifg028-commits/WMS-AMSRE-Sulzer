import { useState, useMemo } from 'react';
import { Plus, Edit2, Search } from 'lucide-react';
import { useWMSStore } from '../store';
import type { Employee } from '../types';
import { Modal } from '../components/ui/Modal';

const departments = ['Operations', 'Quality', 'Maintenance', 'Logistics', 'Admin'];

const emptyEmp: Omit<Employee, 'id' | 'createdAt' | 'updatedAt'> = {
  employeeId: '', employeeName: '', department: '', position: '', location: '', hireDate: '', status: 'Active',
};

export default function Employees() {
  const { employees, addEmployee, updateEmployee, stockOutRecords } = useWMSStore();
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [formData, setFormData] = useState(emptyEmp);

  const filtered = useMemo(() => {
    return employees.filter(emp => {
      const matchSearch = !search || emp.employeeId.toLowerCase().includes(search.toLowerCase()) || emp.employeeName.toLowerCase().includes(search.toLowerCase());
      const matchDept = !filterDept || emp.department === filterDept;
      return matchSearch && matchDept;
    });
  }, [employees, search, filterDept]);

  const getEmpIssueCount = (empId: string) => stockOutRecords.filter(r => r.employeeId === empId).length;

  const openCreate = () => {
    setEditEmp(null);
    setFormData(emptyEmp);
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditEmp(emp);
    setFormData({ ...emp });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.employeeId || !formData.employeeName) return;
    if (editEmp) {
      updateEmployee(editEmp.id, formData);
    } else {
      addEmployee(formData);
    }
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employee Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage warehouse employees</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Employees</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{employees.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Active</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{employees.filter(e => e.status === 'Active').length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Departments</p>
          <p className="text-2xl font-bold text-blue-600 mt-1">{new Set(employees.map(e => e.department)).size}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-medium text-gray-500 uppercase">Total Issues</p>
          <p className="text-2xl font-bold text-purple-600 mt-1">{stockOutRecords.length}</p>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ID or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="select-field w-40">
            <option value="">All Departments</option>
            {departments.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left">Emp ID</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Department</th>
                <th className="px-4 py-3 text-left">Position</th>
                <th className="px-4 py-3 text-left">Location</th>
                <th className="px-4 py-3 text-left">Hire Date</th>
                <th className="px-4 py-3 text-center">Issues</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="table-cell font-medium text-blue-600">{emp.employeeId}</td>
                  <td className="table-cell">{emp.employeeName}</td>
                  <td className="table-cell">{emp.department}</td>
                  <td className="table-cell">{emp.position}</td>
                  <td className="table-cell">{emp.location}</td>
                  <td className="table-cell">{emp.hireDate}</td>
                  <td className="table-cell text-center">
                    <span className="badge-blue">{getEmpIssueCount(emp.id)}</span>
                  </td>
                  <td className="table-cell text-center">
                    <span className={emp.status === 'Active' ? 'badge-green' : 'badge-gray'}>{emp.status}</span>
                  </td>
                  <td className="table-cell text-center">
                    <button onClick={() => openEdit(emp)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600">
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-500">Showing {filtered.length} of {employees.length} employees</div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editEmp ? 'Edit Employee' : 'Add Employee'}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-field">Employee ID *</label>
            <input type="text" value={formData.employeeId} onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })} className="input-field" placeholder="e.g. EMP-007" />
          </div>
          <div>
            <label className="label-field">Employee Name *</label>
            <input type="text" value={formData.employeeName} onChange={(e) => setFormData({ ...formData, employeeName: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Department</label>
            <select value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} className="select-field">
              <option value="">Select</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label-field">Position</label>
            <input type="text" value={formData.position} onChange={(e) => setFormData({ ...formData, position: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Location</label>
            <input type="text" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} className="input-field" placeholder="e.g. Warehouse A" />
          </div>
          <div>
            <label className="label-field">Hire Date</label>
            <input type="date" value={formData.hireDate} onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })} className="input-field" />
          </div>
          <div>
            <label className="label-field">Status</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })} className="select-field">
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
          <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
          <button onClick={handleSave} className="btn-primary">{editEmp ? 'Update' : 'Add'}</button>
        </div>
      </Modal>
    </div>
  );
}
