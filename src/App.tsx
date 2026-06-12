import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import MasterItems from './pages/MasterItems';
import Employees from './pages/Employees';
import StockIn from './pages/StockIn';
import StockOut from './pages/StockOut';
import BatchLedger from './pages/BatchLedger';
import PPEHistory from './pages/PPEHistory';
import InventoryControl from './pages/InventoryControl';
import ExpiryManagement from './pages/ExpiryManagement';
import Reports from './pages/Reports';
import GlobalSearch from './pages/Search';
import AuditTrail from './pages/AuditTrail';
import Security from './pages/Security';
import SettingsPage from './pages/Settings';
import ArchivedItems from './pages/ArchivedItems';
import PPETracker from './pages/PPETracker';
import StationeryTracker from './pages/StationeryTracker';
import JobMaterialTracker from './pages/JobMaterialTracker';
import QCTracker from './pages/QCTracker';
import InventoryHistory from './pages/InventoryHistory';
import Jobs from './pages/Jobs';
import QCForm from './pages/QCForm';
import QRCodePage from './pages/QRCodePage';
import FormRequestsSheet from './pages/PendingRequests';
import LoginPage from './pages/Login';
import PublicStockOutForm from './pages/PublicStockOut';
import { useWMSStore } from './store';

interface User {
  id: string;
  username: string;
  role: string;
  fullName: string;
}

function SyncToServer() {
  const { masterItems, employees, batchLedger, jobs, users } = useWMSStore();
  useEffect(() => {
    const token = localStorage.getItem('wms_token');
    if (!token) return;
    const itemsWithQty = masterItems.map((item) => {
      const availableQty = batchLedger.filter((b) => b.itemId === item.id).reduce((s, b) => s + b.balance, 0);
      return { ...item, _availableQty: availableQty };
    });
    fetch('/api/public/sync-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ items: itemsWithQty, employees, jobs }),
    }).catch(() => {});
    fetch('/api/public/sync-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ users }),
    }).catch(() => {});
    fetch('/api/server/stockout-records', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((serverRecords) => {
        if (Array.isArray(serverRecords) && serverRecords.length > 0) {
          const state = useWMSStore.getState();
          const existingIssueNumbers = new Set(state.stockOutRecords.map((r: any) => r.issueNumber));
          const newRecords = serverRecords.filter((r: any) => !existingIssueNumbers.has(r.issueNumber));
          const store = useWMSStore.getState();
          for (const r of newRecords) {
            const storeItem = store.masterItems.find((i: any) => i.itemCode === r.itemCode);
            store.applyServerStockOut({ ...r, itemId: storeItem ? storeItem.id : r.itemId });
          }
        }
      })
      .catch(() => {});
  }, [masterItems, employees, batchLedger, jobs, users]);
  return null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const setCurrentUser = useWMSStore((s) => s.setCurrentUser);

  useEffect(() => {
    const saved = localStorage.getItem('wms_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setUser(parsed);
        setCurrentUser({ id: parsed.id, username: parsed.username, email: '', role: parsed.role as any, status: 'Active', createdAt: '' });
      } catch { /* ignore */ }
    }
  }, []);

  const handleLogin = (_token: string, userData: User) => {
    setUser(userData);
    setCurrentUser({ id: userData.id, username: userData.username, email: '', role: userData.role as any, status: 'Active', createdAt: '' });
  };

  const handleLogout = () => {
    localStorage.removeItem('wms_token');
    localStorage.removeItem('wms_user');
    setUser(null);
  };

  if (!user) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/request-stock" element={<PublicStockOutForm />} />
          <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
        </Routes>
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <SyncToServer />
      <Routes>
        <Route path="/request-stock" element={<PublicStockOutForm />} />
        <Route element={<Layout onLogout={handleLogout} currentUser={user} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/items" element={<MasterItems />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/stock-in" element={<StockIn />} />
          <Route path="/stock-out" element={<StockOut />} />
          <Route path="/batch-ledger" element={<BatchLedger />} />
          <Route path="/ppe-history" element={<PPEHistory />} />
          <Route path="/inventory" element={<InventoryControl />} />
          <Route path="/archived-items" element={<ArchivedItems />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/ppe-tracker" element={<PPETracker />} />
          <Route path="/stationery-tracker" element={<StationeryTracker />} />
          <Route path="/job-material-tracker" element={<JobMaterialTracker />} />
          <Route path="/qc-tracker" element={<QCTracker />} />
          <Route path="/qc-form" element={<QCForm />} />
          <Route path="/qr-code" element={<QRCodePage />} />
          <Route path="/pending-requests" element={<FormRequestsSheet />} />
          <Route path="/inventory-history" element={<InventoryHistory />} />
          <Route path="/expiry" element={<ExpiryManagement />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/search" element={<GlobalSearch />} />
          <Route path="/audit" element={<AuditTrail />} />
          <Route path="/security" element={<Security />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
