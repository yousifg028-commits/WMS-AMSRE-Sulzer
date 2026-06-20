import { useState } from 'react';
import { Warehouse, LogIn } from 'lucide-react';

interface LoginPageProps {
  onLogin: (token: string, user: { id: string; username: string; role: string; fullName: string }) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      localStorage.setItem('wms_token', data.token);
      localStorage.setItem('wms_user', JSON.stringify(data.user));
      onLogin(data.token, data.user);
    } catch {
      // Fallback for dev mode (no server)
      const devUsers: Record<string, { id: string; role: string; fullName: string }> = {
        yousif: { id: '0', role: 'Administrator', fullName: 'Yousif' },
        admin: { id: '1', role: 'Administrator', fullName: 'System Admin' },
        manager: { id: '2', role: 'Warehouse Manager', fullName: 'Warehouse Manager' },
        supervisor: { id: '3', role: 'Warehouse Supervisor', fullName: 'Warehouse Supervisor' },
        storekeeper: { id: '4', role: 'Storekeeper', fullName: 'Store Keeper' },
        viewer: { id: '5', role: 'Viewer', fullName: 'Read Only User' },
      };
      const devPasswords: Record<string, string> = {
        yousif: '98765',
        admin: 'admin123',
        manager: 'manager123',
        supervisor: 'super123',
        storekeeper: 'store123',
        viewer: 'view123',
      };

      if (devUsers[username] && devPasswords[username] === password) {
        const token = 'dev-token-' + Date.now();
        const user = { username, ...devUsers[username] };
        localStorage.setItem('wms_token', token);
        localStorage.setItem('wms_user', JSON.stringify(user));
        onLogin(token, user);
      } else {
        setError('Invalid username or password');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Warehouse className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">AMSER - Sulzer</h1>
          <p className="text-gray-400 mt-2">Warehouse Management System</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="label-field">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="Enter username"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="label-field">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Enter password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3 flex items-center justify-center gap-2 text-base"
            >
              {loading ? (
                <span className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>
        <p className="text-center text-gray-500 text-xs mt-6">
          &copy; 2026 AMSER - Sulzer. All rights reserved.
        </p>
      </div>
    </div>
  );
}
