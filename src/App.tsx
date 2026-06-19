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
  const tokenRef = useRef<string | null>(null);
  const isPullingRef = useRef(false);
  const lastPushRef = useRef(0);

  useEffect(() => {
    const token = localStorage.getItem('wms_token');
    tokenRef.current = token;
  }, []);

  const pushToServer = () => {
    const token = tokenRef.current || localStorage.getItem('wms_token');
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
    const token = tokenRef.current || localStorage.getItem('wms_token');
    if (!token) return;
    isPullingRef.current = true;
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
        if (!data || data.error) { isPullingRef.current = false; return; }

        const serverMasterItems = data.masterItems || [];
        const serverEmployees = data.employees || [];
        const serverStockIn = data.stockInRecords || [];
        const serverStockOut = data.stockOutRecords || [];
        const serverBatchLedger = data.batchLedger || [];
        const serverInvBalances = data.inventoryBalances || [];
        const serverJobs = data.jobs || [];
        const serverStockAdj = data.stockAdjustments || [];
        const serverAudit = data.auditTrail || [];
        const serverJobMaterials = data.jobMaterials || [];
        const serverQuarantine = data.quarantineMaterials || [];
        const serverClientMaterials = data.clientMaterials || [];

        const hasServerData = serverMasterItems.length > 0 || serverEmployees.length > 0;

        if (hasServerData) {
          useWMSStore.setState({
            masterItems: serverMasterItems,
            employees: serverEmployees,
            categories: data.categories || ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality'],
            stockInRecords: serverStockIn,
            batchLedger: serverBatchLedger,
            inventoryBalances: serverInvBalances,
            jobs: serverJobs,
            stockAdjustments: serverStockAdj,
            auditTrail: serverAudit,
            jobMaterials: serverJobMaterials,
            quarantineMaterials: serverQuarantine,
            clientMaterials: serverClientMaterials,
            alertEmail: data.alertEmail || '',
          });
          if (data.batchSequence) useWMSStore.setState({ batchSequence: data.batchSequence });
          if (data.grnSequence) useWMSStore.setState({ grnSequence: data.grnSequence });
          if (data.issueSequence) useWMSStore.setState({ issueSequence: data.issueSequence });
          if (data.adjustmentSequence) useWMSStore.setState({ adjustmentSequence: data.adjustmentSequence });

          if (serverStockOut.length > 0) {
            useWMSStore.setState({ stockOutRecords: serverStockOut });
          }
        } else {
          const s = store.getState();
          if (serverStockOut.length > 0) {
            const existingIssueNums = new Set(s.stockOutRecords.map((r: any) => r.issueNumber));
            const newRecords = serverStockOut.filter((r: any) => !existingIssueNums.has(r.issueNumber));
            if (newRecords.length > 0) {
              for (const r of newRecords) {
                const storeItem = s.masterItems.find((i: any) => i.itemCode === r.itemCode);
                s.applyServerStockOut({ ...r, itemId: storeItem ? storeItem.id : r.itemId });
              }
            }
          }
        }
        isPullingRef.current = false;
      })
      .catch(() => { isPullingRef.current = false; });
  };

  useEffect(() => {
    const unsub = useWMSStore.subscribe((state, prevState) => {
      if (isPullingRef.current) return;
      const now = Date.now();
      if (now - lastPushRef.current < 8000) return;
      if (JSON.stringify(state.masterItems) !== JSON.stringify(prevState.masterItems) ||
          JSON.stringify(state.employees) !== JSON.stringify(prevState.employees) ||
          JSON.stringify(state.stockInRecords) !== JSON.stringify(prevState.stockInRecords) ||
          JSON.stringify(state.stockOutRecords) !== JSON.stringify(prevState.stockOutRecords) ||
          JSON.stringify(state.batchLedger) !== JSON.stringify(prevState.batchLedger) ||
          JSON.stringify(state.jobs) !== JSON.stringify(prevState.jobs) ||
          JSON.stringify(state.inventoryBalances) !== JSON.stringify(prevState.inventoryBalances)) {
        lastPushRef.current = now;
        pushToServer();
      }
    });

    pullFromServer();
    const pullInterval = setInterval(pullFromServer, 5000);

    return () => { unsub(); clearInterval(pullInterval); };
  }, []);

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
