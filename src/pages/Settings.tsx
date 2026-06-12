import { useState } from 'react';
import { Settings as SettingsIcon, Save, Bell, Database, Globe, Mail } from 'lucide-react';
import { useWMSStore } from '../store';

export default function SettingsPage() {
  const { alertEmail, setAlertEmail } = useWMSStore();
  const [settings, setSettings] = useState({
    companyName: 'AMSER - Sulzer',
    warehouseName: 'Main Warehouse',
    nearExpiryDays: 30,
    warningDays: 90,
    emailAlerts: false,
    autoBatchGeneration: true,
    fefoPriority: true,
    negativeStockPrevention: true,
    auditLogRetention: 365,
    dateFormat: 'dd/MM/yyyy',
    timezone: 'UTC',
    maxSearchResults: 100,
  });

  const [emailConfig, setEmailConfig] = useState({
    email: alertEmail || '',
    appPassword: '',
  });
  const [emailStatus, setEmailStatus] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleEmailConfig = async () => {
    if (!emailConfig.email || !emailConfig.appPassword) return;
    setEmailLoading(true);
    setEmailStatus('');
    try {
      const token = localStorage.getItem('wms_token');
      const res = await fetch('/api/email-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(emailConfig),
      });
      const data = await res.json();
      if (res.ok) {
        setEmailStatus('Email configured successfully!');
        setAlertEmail(emailConfig.email);
      } else {
        setEmailStatus(data.error || 'Failed to configure email');
      }
    } catch {
      setEmailStatus('Server not available');
    }
    setEmailLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">System configuration</p>
        </div>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2">
          <Save className="w-4 h-4" /> {saved ? 'Saved!' : 'Save Settings'}
        </button>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700 font-medium">Settings saved successfully.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
            <Globe className="w-4 h-4" /> General
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label-field">Company Name</label>
              <input type="text" value={settings.companyName} onChange={(e) => setSettings({ ...settings, companyName: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Warehouse Name</label>
              <input type="text" value={settings.warehouseName} onChange={(e) => setSettings({ ...settings, warehouseName: e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Date Format</label>
              <select value={settings.dateFormat} onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })} className="select-field">
                <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                <option value="yyyy-MM-dd">YYYY-MM-DD</option>
              </select>
            </div>
            <div>
              <label className="label-field">Timezone</label>
              <select value={settings.timezone} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} className="select-field">
                <option value="UTC">UTC</option>
                <option value="Asia/Muscat">Asia/Muscat (GMT+4)</option>
                <option value="Asia/Dubai">Asia/Dubai (GMT+4)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (GMT+3)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
            <Bell className="w-4 h-4" /> Expiry Settings
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label-field">Near Expiry Threshold (days)</label>
              <input type="number" value={settings.nearExpiryDays} onChange={(e) => setSettings({ ...settings, nearExpiryDays: +e.target.value })} className="input-field" />
              <p className="text-xs text-gray-500 mt-1">Items within this many days of expiry are flagged as "Near Expiry"</p>
            </div>
            <div>
              <label className="label-field">Warning Threshold (days)</label>
              <input type="number" value={settings.warningDays} onChange={(e) => setSettings({ ...settings, warningDays: +e.target.value })} className="input-field" />
              <p className="text-xs text-gray-500 mt-1">Items within this many days of expiry show a warning</p>
            </div>
            <div>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={settings.emailAlerts} onChange={(e) => setSettings({ ...settings, emailAlerts: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm font-medium text-gray-700">Enable Email Alerts</span>
              </label>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
            <Mail className="w-4 h-4" /> Email Alert Configuration
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label-field">Alert Email Address</label>
              <input type="email" value={emailConfig.email} onChange={(e) => setEmailConfig({ ...emailConfig, email: e.target.value })} className="input-field" placeholder="yousifg028@gmail.com" />
              <p className="text-xs text-gray-500 mt-1">Alerts for low stock, stock issued, out of stock will be sent here</p>
            </div>
            <div>
              <label className="label-field">Gmail App Password</label>
              <input type="password" value={emailConfig.appPassword} onChange={(e) => setEmailConfig({ ...emailConfig, appPassword: e.target.value })} className="input-field" placeholder="Enter Gmail App Password" />
              <p className="text-xs text-gray-500 mt-1">Generate from Google Account &gt; Security &gt; 2FA &gt; App Passwords</p>
            </div>
            <button onClick={handleEmailConfig} disabled={emailLoading || !emailConfig.email || !emailConfig.appPassword} className="btn-primary flex items-center gap-2">
              <Mail className="w-4 h-4" />
              {emailLoading ? 'Configuring...' : 'Save Email Config'}
            </button>
            {emailStatus && (
              <p className={`text-sm ${emailStatus.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{emailStatus}</p>
            )}
          </div>
        </div>

        <div className="card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
            <Database className="w-4 h-4" /> Business Rules
          </h3>
          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={settings.fefoPriority} onChange={(e) => setSettings({ ...settings, fefoPriority: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm font-medium text-gray-700">FEFO has priority over FIFO</span>
              </label>
            </div>
            <div>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={settings.negativeStockPrevention} onChange={(e) => setSettings({ ...settings, negativeStockPrevention: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm font-medium text-gray-700">Prevent negative stock</span>
              </label>
            </div>
            <div>
              <label className="flex items-center gap-3">
                <input type="checkbox" checked={settings.autoBatchGeneration} onChange={(e) => setSettings({ ...settings, autoBatchGeneration: e.target.checked })} className="rounded border-gray-300" />
                <span className="text-sm font-medium text-gray-700">Auto-generate batch IDs</span>
              </label>
            </div>
            <div>
              <label className="label-field">Audit Log Retention (days)</label>
              <input type="number" value={settings.auditLogRetention} onChange={(e) => setSettings({ ...settings, auditLogRetention: +e.target.value })} className="input-field" />
            </div>
            <div>
              <label className="label-field">Max Search Results</label>
              <input type="number" value={settings.maxSearchResults} onChange={(e) => setSettings({ ...settings, maxSearchResults: +e.target.value })} className="input-field" />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
            <SettingsIcon className="w-4 h-4" /> System Info
          </h3>
          <div className="space-y-3">
            {[
              ['Version', '1.0.0'],
              ['Build', '2026.06.11'],
              ['Framework', 'React + TypeScript'],
              ['UI', 'Tailwind CSS'],
              ['State', 'Zustand'],
              ['Charts', 'Recharts'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-500">{label}</span>
                <span className="text-sm font-medium text-gray-900">{value}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-400 text-center">
              &copy; 2026 AMSER - Sulzer. All rights reserved.
            </p>
            <p className="text-[10px] text-gray-300 text-center mt-1">
              Warehouse Management System v1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
