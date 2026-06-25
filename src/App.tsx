import { useState, useEffect, useRef, lazy, Suspense, Component, type ReactNode } from 'react';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(e: Error) { return { error: e.message + '\n' + e.stack }; }
  render() {
    if (this.state.error) return <pre style={{padding:20,whiteSpace:'pre-wrap',color:'red',background:'#fff',fontSize:14}}>{this.state.error}</pre>;
    return this.props.children;
  }
}
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import LoginPage from './pages/Login';
import PublicStockOutForm from './pages/PublicStockOut';
import { useWMSStore } from './store';

const MasterItems = lazy(() => import('./pages/MasterItems'));
const Employees = lazy(() => import('./pages/Employees'));
const StockIn = lazy(() => import('./pages/StockIn'));
const StockOut = lazy(() => import('./pages/StockOut'));
const BatchLedger = lazy(() => import('./pages/BatchLedger'));
const PPEHistory = lazy(() => import('./pages/PPEHistory'));
const InventoryControl = lazy(() => import('./pages/InventoryControl'));
const ExpiryManagement = lazy(() => import('./pages/ExpiryManagement'));
const Reports = lazy(() => import('./pages/Reports'));
const GlobalSearch = lazy(() => import('./pages/Search'));
const AuditTrail = lazy(() => import('./pages/AuditTrail'));
const Security = lazy(() => import('./pages/Security'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const ArchivedItems = lazy(() => import('./pages/ArchivedItems'));
const PPETracker = lazy(() => import('./pages/PPETracker'));
const StationeryTracker = lazy(() => import('./pages/StationeryTracker'));
const JobMaterialTracker = lazy(() => import('./pages/JobMaterialTracker'));
const QCTracker = lazy(() => import('./pages/QCTracker'));
const InventoryHistory = lazy(() => import('./pages/InventoryHistory'));
const Jobs = lazy(() => import('./pages/Jobs'));
const JobMaterials = lazy(() => import('./pages/JobMaterials'));
const QuarantineMaterials = lazy(() => import('./pages/QuarantineMaterials'));
const QCForm = lazy(() => import('./pages/QCForm'));
const QRCodePage = lazy(() => import('./pages/QRCodePage'));
const FormRequestsSheet = lazy(() => import('./pages/PendingRequests'));

interface User {
  id: string;
  username: string;
  role: string;
  fullName: string;
}

function mergeArrayById<T extends { id: string; updatedAt?: string }>(local: T[], server: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(item.id, item);
  for (const item of server) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
    } else if (item.updatedAt && existing.updatedAt && item.updatedAt > existing.updatedAt) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}

function mergeStockRecords<T extends { id: string; issueNumber?: string; grnNumber?: string; createdAt?: string; updatedAt?: string }>(local: T[], server: T[], key: keyof T): T[] {
  const map = new Map<string, T>();
  for (const item of local) map.set(String(item[key]), item);
  for (const item of server) {
    const existing = map.get(String(item[key]));
    if (!existing) {
      map.set(String(item[key]), item);
    } else if (item.updatedAt && (existing as any).updatedAt && item.updatedAt > (existing as any).updatedAt) {
      map.set(String(item[key]), item);
    }
  }
  return Array.from(map.values());
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
    const s = useWMSStore.getState();
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
        quarantineMaterials: (s as any).quarantineMaterials || [],
        clientMaterials: (s as any).clientMaterials || [],
        alertEmail: s.alertEmail,
        batchSequence: s.batchSequence,
        grnSequence: s.grnSequence,
        issueSequence: s.issueSequence,
        adjustmentSequence: s.adjustmentSequence,
        deletedIds: s.deletedIds || [],
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
        const s = store.getState();
        const deleted = new Set([...(s.deletedIds || []), ...(data.deletedIds || [])]);

        const localItemsFiltered = s.masterItems.filter((i: { id: string }) => !deleted.has(i.id));
        const serverItemsFiltered = (data.masterItems || []).filter((i: { id: string }) => !deleted.has(i.id));
        const newMasterItems = mergeArrayById(localItemsFiltered, serverItemsFiltered);

        const localEmpFiltered = s.employees.filter((e: { id: string }) => !deleted.has(e.id));
        const serverEmpFiltered = (data.employees || []).filter((e: { id: string }) => !deleted.has(e.id));
        const newEmployees = mergeArrayById(localEmpFiltered, serverEmpFiltered);

        const localJobsFiltered = s.jobs.filter((j: { id: string }) => !deleted.has(j.id));
        const serverJobsFiltered = (data.jobs || []).filter((j: { id: string }) => !deleted.has(j.id));
        const newJobs = mergeArrayById(localJobsFiltered, serverJobsFiltered);

        const localStockInFiltered = s.stockInRecords.filter((r: { id: string }) => !deleted.has(r.id));
        const serverStockInFiltered = (data.stockInRecords || []).filter((r: { id: string }) => !deleted.has(r.id));
        const newStockIn = mergeStockRecords(localStockInFiltered, serverStockInFiltered, 'grnNumber');

        const localAdjFiltered = s.stockAdjustments.filter((a: { id: string }) => !deleted.has(a.id));
        const serverAdjFiltered = (data.stockAdjustments || []).filter((a: { id: string }) => !deleted.has(a.id));
        const newStockAdjustments = mergeStockRecords(localAdjFiltered, serverAdjFiltered, 'adjustmentNumber');

        const localBatchFiltered = s.batchLedger.filter((b: { id: string; batchId: string }) => !deleted.has(b.id) && !deleted.has(b.batchId));
        const serverBatchFiltered = (data.batchLedger || []).filter((b: { id: string; batchId: string }) => !deleted.has(b.id) && !deleted.has(b.batchId));
        const newBatchLedger = mergeStockRecords(localBatchFiltered, serverBatchFiltered, 'batchId');

        const existingIssueNums = new Set(s.stockOutRecords.map((r) => r.issueNumber));
        const newServerRecords = (data.stockOutRecords || []).filter((r: { issueNumber: string; id: string }) => !existingIssueNums.has(r.issueNumber) && !deleted.has(r.id));
        for (const r of newServerRecords) {
          const storeItem = s.masterItems.find((i) => i.itemCode === r.itemCode);
          s.applyServerStockOut({ ...r, itemId: storeItem ? storeItem.id : r.itemId });
        }

        const fresh = store.getState();
        const newAuditTrail = mergeStockRecords(fresh.auditTrail, data.auditTrail || [], 'id');
        const stockOutFiltered = fresh.stockOutRecords.filter((r: { id: string }) => !deleted.has(r.id));

        useWMSStore.setState({
          masterItems: newMasterItems,
          employees: newEmployees,
          stockInRecords: newStockIn,
          batchLedger: newBatchLedger,
          jobs: newJobs,
          stockAdjustments: newStockAdjustments,
          stockOutRecords: stockOutFiltered,
          auditTrail: newAuditTrail,
          deletedIds: Array.from(deleted),
          alertEmail: data.alertEmail || fresh.alertEmail,
          batchSequence: Math.max(fresh.batchSequence, data.batchSequence || 1),
          grnSequence: Math.max(fresh.grnSequence, data.grnSequence || 1),
          issueSequence: Math.max(fresh.issueSequence, data.issueSequence || 1),
          adjustmentSequence: Math.max(fresh.adjustmentSequence, data.adjustmentSequence || 1),
          jobMaterials: mergeArrayById(s.jobMaterials || [], data.jobMaterials || []),
          quarantineMaterials: mergeArrayById((s as any).quarantineMaterials || [], data.quarantineMaterials || []),
          clientMaterials: mergeArrayById((s as any).clientMaterials || [], data.clientMaterials || []),
        });
        isPullingRef.current = false;
      })
      .catch(() => { isPullingRef.current = false; });
  };

  useEffect(() => {
    const unsub = useWMSStore.subscribe((state, prevState) => {
      if (isPullingRef.current) return;
      const now = Date.now();
      if (now - lastPushRef.current < 2000) return;
      if (JSON.stringify(state.masterItems) !== JSON.stringify(prevState.masterItems) ||
          JSON.stringify(state.employees) !== JSON.stringify(prevState.employees) ||
          JSON.stringify(state.stockInRecords) !== JSON.stringify(prevState.stockInRecords) ||
          JSON.stringify(state.stockOutRecords) !== JSON.stringify(prevState.stockOutRecords) ||
          JSON.stringify(state.batchLedger) !== JSON.stringify(prevState.batchLedger) ||
          JSON.stringify(state.jobs) !== JSON.stringify(prevState.jobs) ||
          JSON.stringify(state.inventoryBalances) !== JSON.stringify(prevState.inventoryBalances) ||
          JSON.stringify((state as any).quarantineMaterials) !== JSON.stringify((prevState as any).quarantineMaterials) ||
          JSON.stringify((state as any).clientMaterials) !== JSON.stringify((prevState as any).clientMaterials) ||
          JSON.stringify((state as any).jobMaterials) !== JSON.stringify((prevState as any).jobMaterials) ||
          JSON.stringify((state as any).stockAdjustments) !== JSON.stringify((prevState as any).stockAdjustments)) {
        lastPushRef.current = now;
        pushToServer();
      }
    });

    pullFromServer();

    const token = localStorage.getItem('wms_token');
    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    function connectSSE() {
      if (!token) return;
      eventSource = new EventSource(`/api/sse?token=${encodeURIComponent(token)}`);
      eventSource.onmessage = () => {
        pullFromServer();
      };
      eventSource.onerror = () => {
        eventSource?.close();
        eventSource = null;
        reconnectTimer = setTimeout(connectSSE, 3000);
      };
    }
    connectSSE();

    const pushInterval = setInterval(() => {
      pushToServer();
    }, 2000);

    const pullInterval = setInterval(() => {
      pullFromServer();
    }, 3000);

    return () => {
      unsub();
      clearInterval(pushInterval);
      clearInterval(pullInterval);
      eventSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
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
    useWMSStore.getState().setCurrentUser({ id: '', username: '', email: '', role: 'Viewer', status: 'Inactive', createdAt: '' });
    setUser(null);
  };

  if (!user) {
    return (
      <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/request-stock" element={<PublicStockOutForm />} />
          <Route path="*" element={<LoginPage onLogin={handleLogin} />} />
        </Routes>
      </BrowserRouter>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <SyncToServer />
      <Routes>
        <Route path="/request-stock" element={<PublicStockOutForm />} />
        <Route element={<Layout onLogout={handleLogout} currentUser={user} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="*" element={
            <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}>
              <Routes>
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
              </Routes>
            </Suspense>
          } />
        </Route>
      </Routes>
    </BrowserRouter>
    </ErrorBoundary>
  );
}
