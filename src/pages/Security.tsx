import { useState, useEffect } from 'react';
import { Users, Check, X, Pencil, Trash2, Save, XCircle, Printer } from 'lucide-react';
import { useWMSStore } from '../store';
import type { UserRole, Permission } from '../types';
import { ROLE_PERMISSIONS } from '../types';

const permissionGroups = [
  { label: 'Dashboard', perms: ['dashboard.view'] },
  { label: 'Items', perms: ['items.view', 'items.create', 'items.edit', 'items.archive', 'items.import', 'items.export'] },
  { label: 'Employees', perms: ['employees.view', 'employees.create', 'employees.edit'] },
  { label: 'Stock In', perms: ['stockin.view', 'stockin.create'] },
  { label: 'Stock Out', perms: ['stockout.view', 'stockout.create'] },
  { label: 'Batch', perms: ['batch.view'] },
  { label: 'Inventory', perms: ['inventory.view', 'inventory.adjust', 'inventory.count'] },
  { label: 'Expiry', perms: ['expiry.view'] },
  { label: 'Reports', perms: ['reports.view', 'reports.export'] },
  { label: 'Audit', perms: ['audit.view'] },
  { label: 'Users', perms: ['users.view', 'users.create', 'users.edit'] },
  { label: 'Settings', perms: ['settings.view', 'settings.edit'] },
];

const roles: UserRole[] = ['Administrator', 'Warehouse Manager', 'Warehouse Supervisor', 'Storekeeper', 'Viewer'];

const roleColors: Record<UserRole, string> = {
  'Administrator': 'bg-red-100 text-red-800',
  'Warehouse Manager': 'bg-blue-100 text-blue-800',
  'Warehouse Supervisor': 'bg-purple-100 text-purple-800',
  'Storekeeper': 'bg-emerald-100 text-emerald-800',
  'Viewer': 'bg-gray-100 text-gray-800',
};

export default function Security() {
  const currentUser = useWMSStore((s) => s.currentUser);
  const addUser = useWMSStore((s) => s.addUser);
  const addAuditEntry = useWMSStore((s) => s.addAuditEntry);
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser.role);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Viewer');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('Viewer');
  const [serverUsers, setServerUsers] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('wms_token');
    fetch('/api/users', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => { if (data.users) setServerUsers(data.users); })
      .catch(() => {});
  }, []);

  const allUsers = [...serverUsers];

  const getLoggedUser = () => {
    try {
      const saved = localStorage.getItem('wms_user');
      if (saved) return JSON.parse(saved);
    } catch {}
    return currentUser;
  };
  const loggedUser = getLoggedUser();
  const isAdmin = loggedUser.role === 'Administrator' && loggedUser.username === 'yousif';

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Trash2 className="w-16 h-16 text-gray-300 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-gray-900 mb-1">Access Denied</h2>
          <p className="text-gray-500">Only administrators can access this page.</p>
        </div>
      </div>
    );
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    const token = localStorage.getItem('wms_token');
    let serverOk = false;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: newUsername.trim(),
          password: newPassword || newUsername.trim(),
          role: newRole,
          fullName: newUsername.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to create user');
        return;
      }
      serverOk = true;
    } catch { /* server unavailable, continue with store only */ }
    addUser({
      id: serverOk ? undefined : String(Date.now()),
      username: newUsername.trim(),
      email: `${newUsername.trim()}@wms.local`,
      role: newRole,
      status: 'Active',
      _rawPassword: newPassword || newUsername.trim(),
    } as any);
    addAuditEntry({
      action: 'USER_CREATED',
      module: 'Security',
      recordId: newUsername.trim(),
      beforeValue: '',
      afterValue: JSON.stringify({ username: newUsername.trim(), role: newRole }),
      performedBy: loggedUser.username,
    });
    setNewUsername('');
    setNewPassword('');
    setNewRole('Viewer');
  };

  const handleStartEdit = (user: any) => {
    setEditingId(user.id);
    setEditUsername(user.username);
    setEditPassword('');
    setEditRole(user.role);
  };

  const handleSaveEdit = async (user: any) => {
    const token = localStorage.getItem('wms_token');
    try {
      const body: Record<string, string> = { role: editRole };
      if (editUsername.trim() && editUsername !== user.username) body.username = editUsername.trim();
      if (editPassword.trim()) body.password = editPassword.trim();
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) { /* server unavailable or user not found, continue with store */ }
    } catch { /* server unavailable, continue with store */ }

    const store = useWMSStore.getState();
    const updatedUsers = store.users.map((u) =>
      u.id === user.id ? { ...u, role: editRole, username: editUsername.trim() || u.username } : u
    );
    useWMSStore.setState({ users: updatedUsers });
    addAuditEntry({
      action: 'USER_UPDATED',
      module: 'Security',
      recordId: user.id,
      beforeValue: JSON.stringify({ username: user.username, role: user.role }),
      afterValue: JSON.stringify({ username: editUsername.trim(), role: editRole }),
      performedBy: loggedUser.username,
    });
    setEditingId(null);
  };

  const handleDeleteUser = async (user: any) => {
    if (user.username === 'yousif') return;
    const token = localStorage.getItem('wms_token');
    try {
      await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch { /* ignore */ }
    const store = useWMSStore.getState();
    const updatedUsers = store.users.filter((u) => u.id !== user.id);
    useWMSStore.setState({ users: updatedUsers });
    setServerUsers(prev => prev.filter(u => u.id !== user.id));
    addAuditEntry({
      action: 'USER_DELETED',
      module: 'Security',
      recordId: user.id,
      beforeValue: JSON.stringify({ username: user.username, role: user.role }),
      afterValue: '',
      performedBy: loggedUser.username,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security & Roles</h1>
        <p className="text-sm text-gray-500 mt-1">Manage users, roles and permissions</p>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Current Session</h3>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900">{currentUser.username}</p>
          </div>
          <div className="ml-auto">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleColors[currentUser.role]}`}>
              {currentUser.role}
            </span>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">User Management</h3>
        <form onSubmit={handleCreateUser} className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="label-field">Username</label>
            <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="input-field" placeholder="Enter username" required />
          </div>
          <div>
            <label className="label-field">Password</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="input-field" placeholder="Enter password" />
          </div>
          <div>
            <label className="label-field">Role</label>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className="select-field">
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <button type="submit" className="btn-primary">Create User</button>
        </form>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allUsers.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {editingId === user.id ? (
                      <input type="text" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-40" />
                    ) : user.username}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    {editingId === user.id ? (
                      <select value={editRole} onChange={(e) => setEditRole(e.target.value as UserRole)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm">
                        {roles.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[user.role as UserRole] || 'bg-gray-100 text-gray-800'}`}>
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {editingId === user.id ? (
                      <div className="flex gap-1 justify-center">
                        <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} className="border border-gray-300 rounded-lg px-2 py-1 text-sm w-32" placeholder="New password" />
                        <button onClick={() => handleSaveEdit(user)} className="p-1.5 bg-green-100 text-green-600 rounded-lg hover:bg-green-200" title="Save">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={() => window.print()} className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="Print">
                          <Printer className="w-4 h-4" />
                        </button>

                        <button onClick={() => setEditingId(null)} className="p-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200" title="Cancel">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleStartEdit(user)} className="p-1.5 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {user.id !== currentUser.id && user.username !== 'admin' && (
                          <button
                            onClick={() => { if (confirm('Delete user "' + user.username + '"?')) handleDeleteUser(user); }}
                            className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Roles</h3>
            <div className="space-y-2">
              {roles.map(role => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                    selectedRole === role ? 'bg-blue-50 border-2 border-blue-200' : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{role}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleColors[role]}`}>
                      {(ROLE_PERMISSIONS[role] || []).length} perms
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">
              Permissions for <span className="text-blue-600">{selectedRole}</span>
            </h3>
            <div className="space-y-4">
              {permissionGroups.map(group => {
                const rolePerms = ROLE_PERMISSIONS[selectedRole] || [];
                return (
                  <div key={group.label} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">{group.label}</h4>
                    <div className="flex flex-wrap gap-2">
                      {group.perms.map(perm => {
                        const hasPerm = rolePerms.includes(perm as Permission);
                        return (
                          <span
                            key={perm}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${
                              hasPerm ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-400'
                            }`}
                          >
                            {hasPerm ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            {perm.split('.')[1]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
