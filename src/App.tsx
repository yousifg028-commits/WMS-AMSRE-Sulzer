import { useState, useEffect, useRef } from 'react';
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
import JobMaterials from './pages/JobMaterials';
import QuarantineMaterials from './pages/QuarantineMaterials';
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
  const store = useWMSStore;
  const { masterItems, employees, stockInRecords, stockOutRecords, batchLedger, inventoryBalances, jobs, users, stockAdjustments, auditTrail } = useWMSStore();
  const categories = useWMSStore((s) => (s as any).categories || []);
  const hasPulledRef = useRef(false);

  const pushToServer = () => {
    const token = localStorage.getItem('wms_token');
    if (!token) return;
    const s = store.getState();
    const itemsWithQty = s.masterItems.map((item) => {
      const availableQty = s.batchLedger.filter((b) => b.itemId === item.id).reduce((sum, b) => sum + b.balance, 0);
      return { ...item, _availableQty: availableQty };
    });
    fetch('/api/full-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        masterItems: itemsWithQty,
        employees: s.employees,
        categories: (s as any).categories || ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality'],
        stockInRecords: s.stockInRecords,
        stockOutRecords: s.stockOutRecords,
        batchLedger: s.batchLedger,
        inventoryBalances: s.inventoryBalances,
        jobs: s.jobs,
        users: s.users,
        stockAdjustments: s.stockAdjustments,
        auditTrail: s.auditTrail,
        jobMaterials: s.jobMaterials || [],
        alertEmail: s.alertEmail,
        batchSequence: s.batchSequence,
        grnSequence: s.grnSequence,
        issueSequence: s.issueSequence,
        adjustmentSequence: s.adjustmentSequence,
        extraUsers: (s as any).extraUsers || [],
        publicEmployees: (s as any).publicEmployees || [],
      }),
    }).then((res) => {
      if (res.status === 401) {
        localStorage.removeItem('wms_token');
        localStorage.removeItem('wms_user');
        window.location.reload();
      }
    }).catch(() => {});
  };

  const pullFromServer = () => {
    const token = localStorage.getItem('wms_token');
    if (!token) return;
    fetch('/api/full-sync', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem('wms_token');
          localStorage.removeItem('wms_user');
          window.location.reload();
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data || data.error) return;
        const s = store.getState();
        const isFirstPull = !hasPulledRef.current;
        hasPulledRef.current = true;

        const serverHasData = (data.masterItems || []).length > 0;

        if (isFirstPull && serverHasData) {
          useWMSStore.setState({
            masterItems: data.masterItems || [],
            employees: data.employees || [],
            categories: data.categories || ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality'],
            stockInRecords: data.stockInRecords || [],
            batchLedger: data.batchLedger || [],
            inventoryBalances: data.inventoryBalances || [],
            jobs: data.jobs || [],
            stockAdjustments: data.stockAdjustments || [],
            auditTrail: data.auditTrail || [],
            stockOutRecords: data.stockOutRecords || [],
            jobMaterials: data.jobMaterials || [],
            alertEmail: data.alertEmail || '',
          });
          if (data.batchSequence) useWMSStore.setState({ batchSequence: data.batchSequence });
          if (data.grnSequence) useWMSStore.setState({ grnSequence: data.grnSequence });
          if (data.issueSequence) useWMSStore.setState({ issueSequence: data.issueSequence });
          if (data.adjustmentSequence) useWMSStore.setState({ adjustmentSequence: data.adjustmentSequence });
          return;
        }

        if (data.masterItems && data.masterItems.length > 0) {
          s.masterItems.length === 0 && useWMSStore.setState({ masterItems: data.masterItems });
        }
        if (data.employees && data.employees.length > 0) {
          s.employees.length === 0 && useWMSStore.setState({ employees: data.employees });
        }
        if (data.stockInRecords && data.stockInRecords.length > 0) {
          s.stockInRecords.length === 0 && useWMSStore.setState({ stockInRecords: data.stockInRecords });
        }
        if (data.batchLedger && data.batchLedger.length > 0) {
          s.batchLedger.length === 0 && useWMSStore.setState({ batchLedger: data.batchLedger });
        }
        if (data.inventoryBalances && data.inventoryBalances.length > 0) {
          s.inventoryBalances.length === 0 && useWMSStore.setState({ inventoryBalances: data.inventoryBalances });
        }
        if (data.jobs && data.jobs.length > 0) {
          s.jobs.length === 0 && useWMSStore.setState({ jobs: data.jobs });
        }
        if (data.stockAdjustments && data.stockAdjustments.length > 0) {
          s.stockAdjustments.length === 0 && useWMSStore.setState({ stockAdjustments: data.stockAdjustments });
        }
        if (data.stockOutRecords) {
          const existingIssueNums = new Set(s.stockOutRecords.map((r: any) => r.issueNumber));
          const newRecords = data.stockOutRecords.filter((r: any) => !existingIssueNums.has(r.issueNumber));
          if (newRecords.length > 0) {
            for (const r of newRecords) {
              const storeItem = s.masterItems.find((i: any) => i.itemCode === r.itemCode);
              s.applyServerStockOut({ ...r, itemId: storeItem ? storeItem.id : r.itemId });
            }
          }
          if (s.stockOutRecords.length === 0 && data.stockOutRecords.length > 0) {
            useWMSStore.setState({ stockOutRecords: data.stockOutRecords });
          }
        }
        if (data.auditTrail && data.auditTrail.length > 0) {
          s.auditTrail.length === 0 && useWMSStore.setState({ auditTrail: data.auditTrail });
        }
        if (data.alertEmail) {
          useWMSStore.setState({ alertEmail: data.alertEmail });
        }
        if (data.batchSequence) useWMSStore.setState({ batchSequence: Math.max(s.batchSequence, data.batchSequence) });
        if (data.grnSequence) useWMSStore.setState({ grnSequence: Math.max(s.grnSequence, data.grnSequence) });
        if (data.issueSequence) useWMSStore.setState({ issueSequence: Math.max(s.issueSequence, data.issueSequence) });
        if (data.adjustmentSequence) useWMSStore.setState({ adjustmentSequence: Math.max(s.adjustmentSequence, data.adjustmentSequence) });
      })
      .catch(() => {});
  };

  useEffect(() => {
    pullFromServer();
    pushToServer();
    const interval = setInterval(() => {
      pullFromServer();
      pushToServer();
    }, 5000);
    return () => clearInterval(interval);
  }, [masterItems, employees, stockInRecords, stockOutRecords, batchLedger, inventoryBalances, jobs, users, stockAdjustments, auditTrail, categories]);

  return null;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const setCurrentUser = useWMSStore((s) => s.setCurrentUser);

  useEffect(() => {
    const saved = localStorage.getItem('wms_user');
    const token = localStorage.getItem('wms_token');
    if (saved && token) {
      try {
        const parsed = JSON.parse(saved);
        fetch('/api/me', { headers: { Authorization: `Bearer ${token}` } })
          .then((r) => {
            if (!r.ok) {
              localStorage.removeItem('wms_token');
              localStorage.removeItem('wms_user');
              return null;
            }
            return r.json();
          })
          .then((data) => {
            if (data) {
              setUser(parsed);
              setCurrentUser({ id: parsed.id, username: parsed.username, email: '', role: parsed.role as any, status: 'Active', createdAt: '' });
            }
          })
          .catch(() => { /* keep user logged in if server unreachable */ });
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
          <Route path="/job-materials" element={<JobMaterials />} />
          <Route path="/quarantine-materials" element={<QuarantineMaterials />} />
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
