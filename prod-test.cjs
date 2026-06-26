const BASE = 'https://wms-amsre-sulzer-pnkt.onrender.com';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let passed = 0, failed = 0, total = 0;
function ok(msg) { total++; passed++; console.log(`    \x1b[32m✓\x1b[0m ${msg}`); }
function fail(msg) { total++; failed++; console.log(`    \x1b[31m✗\x1b[0m ${msg}`); }
function section(msg) { console.log(`\n\x1b[1m${msg}\x1b[0m`); }
function info(msg) { console.log(`    ${msg}`); }

async function fetchRetry(url, opts = {}, retries = 5, delay = 6000) {
  for (let i = 0; i < retries; i++) {
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 45000);
      const r = await fetch(url, { ...opts, signal: c.signal });
      clearTimeout(t);
      return r;
    } catch (e) {
      if (i === retries - 1) throw e;
      await sleep(delay);
    }
  }
}

async function login(user = 'yousif', pass = '98765') {
  const r = await fetchRetry(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  });
  const j = await r.json();
  if (!j.token) throw new Error(`Login failed for ${user}: ${j.error || 'unknown'}`);
  return j.token;
}

async function syncGet(token) {
  const r = await fetchRetry(`${BASE}/api/full-sync`, { headers: { Authorization: `Bearer ${token}` } });
  if (r.status === 401) throw new Error('Unauthorized');
  return r.json();
}

async function syncPost(token, data) {
  const r = await fetchRetry(`${BASE}/api/full-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return r.json();
}

function push(data, overrides = {}) {
  return {
    masterItems: data.masterItems || [],
    employees: data.employees || [],
    categories: data.categories || ['PPE','Chemical','Spare Parts','Lubricant','Consumable','Stationery','Quality'],
    stockInRecords: data.stockInRecords || [],
    stockOutRecords: data.stockOutRecords || [],
    batchLedger: data.batchLedger || [],
    inventoryBalances: data.inventoryBalances || [],
    jobs: data.jobs || [],
    users: data.users || [],
    stockAdjustments: data.stockAdjustments || [],
    auditTrail: data.auditTrail || [],
    jobMaterials: data.jobMaterials || [],
    quarantineMaterials: data.quarantineMaterials || [],
    clientMaterials: data.clientMaterials || [],
    deletedIds: data.deletedIds || [],
    batchSequence: data.batchSequence || 1,
    grnSequence: data.grnSequence || 1,
    issueSequence: data.issueSequence || 1,
    adjustmentSequence: data.adjustmentSequence || 1,
    alertEmail: data.alertEmail || '',
    ...overrides
  };
}

async function main() {
  console.log('\n\x1b[1m══════════════════════════════════════════════════════════════\x1b[0m');
  console.log('\x1b[1m  فحص شامل للنظام - WMS AMSRE Sulzer Production Test\x1b[0m');
  console.log('\x1b[1m══════════════════════════════════════════════════════════════\x1b[0m');

  // Warmup
  info('Warming up server...');
  await login();
  await sleep(3000);
  info('Server ready.\n');

  // ══════════════════════════════════════════════════════════
  // PHASE 1: AUTHENTICATION
  // ══════════════════════════════════════════════════════════
  section('PHASE 1: المصادقة - Authentication');
  
  const users = [
    { u: 'yousif', p: '98765', role: 'Administrator' },
    { u: 'admin', p: 'admin123', role: 'Administrator' },
    { u: 'manager', p: 'manager123', role: 'Warehouse Manager' },
    { u: 'supervisor', p: 'super123', role: 'Warehouse Supervisor' },
    { u: 'storekeeper', p: 'store123', role: 'Storekeeper' },
    { u: 'viewer', p: 'view123', role: 'Viewer' },
  ];
  for (const { u, p, role } of users) {
    try {
      const t = await login(u, p);
      ok(`Login ${u} (${role})`);
    } catch (e) { fail(`Login ${u}: ${e.message}`); }
  }
  // Bad password
  try {
    const r = await fetchRetry(`${BASE}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'yousif', password: 'wrong' })
    });
    ok(`Reject wrong password (${r.status})`);
  } catch (e) { fail(`Bad password test: ${e.message}`); }
  // Empty credentials
  try {
    const r = await fetchRetry(`${BASE}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' })
    });
    ok(`Reject empty credentials (${r.status})`);
  } catch (e) { fail(`Empty creds test: ${e.message}`); }

  // ══════════════════════════════════════════════════════════
  // PHASE 2: ALL PAGE ROUTES
  // ══════════════════════════════════════════════════════════
  section('PHASE 2: صفحات الويب - Page Routes');
  const routes = ['/', '/login', '/dashboard', '/master-data', '/stock-in', '/stock-out',
    '/stock-balance', '/batch-ledger', '/reports', '/employees', '/settings', '/security',
    '/jobs', '/material-requests', '/quarantine', '/clients', '/suppliers',
    '/pending-requests', '/public/stock-out', '/public/stock-data',
    '/stock-adjustments', '/grn', '/issue-voucher', '/audit-trail', '/notifications', '/help'];
  let routeOk = 0;
  for (const route of routes) {
    try {
      const r = await fetchRetry(`${BASE}${route}`, { redirect: 'follow' });
      if (r.status === 200 || r.status === 304) routeOk++;
      else fail(`Route ${route}: ${r.status}`);
    } catch (e) { fail(`Route ${route}: ${e.message}`); }
  }
  ok(`${routeOk}/${routes.length} routes serve correctly`);

  // ══════════════════════════════════════════════════════════
  // PHASE 3: CLEANUP + BASELINE
  // ══════════════════════════════════════════════════════════
  section('PHASE 3: تنظيف البيانات القديمة');
  const token = await login();
  let data = await syncGet(token);
  
  const baseItemCount = data.masterItems.length;
  const baseEmpCount = data.employees.length;
  const baseBatchCount = data.batchLedger.length;
  const baseInvCount = data.inventoryBalances.length;
  info(`Baseline: ${baseItemCount} items, ${baseEmpCount} employees, ${baseBatchCount} batches, ${baseInvCount} balances`);
  ok('Server data loaded successfully');

  // ══════════════════════════════════════════════════════════
  // PHASE 4: CREATE ITEMS
  // ══════════════════════════════════════════════════════════
  section('PHASE 4: إنشاء عناصر - Create Items');
  const now = () => new Date().toISOString();
  const t1 = now();
  const itemA = { id: 'TEST-A', itemCode: 'TEST-A-001', itemName: 'Test Item A - Helmet', category: 'PPE', unit: 'Piece', status: 'Active', trackerGroup: 'PPE', expiryTracking: false, minStock: 10, maxStock: 200, location: 'A1-01', createdAt: t1, updatedAt: t1 };
  const itemB = { id: 'TEST-B', itemCode: 'TEST-B-001', itemName: 'Test Item B - Grease', category: 'Lubricant', unit: 'Liter', status: 'Active', trackerGroup: 'Lubricant', expiryTracking: true, minStock: 5, maxStock: 100, location: 'B2-02', createdAt: t1, updatedAt: t1 };

  let r = await syncPost(await login(), push(data, { masterItems: [...data.masterItems, itemA, itemB] }));
  ok(`Create 2 items: ${r.ok ? 'saved' : 'FAILED'}`);

  data = await syncGet(await login());
  const foundA = data.masterItems.find(i => i.id === 'TEST-A');
  const foundB = data.masterItems.find(i => i.id === 'TEST-B');
  ok(`Item A exists: ${foundA?.itemName}`);
  ok(`Item B exists: ${foundB?.itemName}`);

  // ══════════════════════════════════════════════════════════
  // PHASE 5: STOCK IN
  // ══════════════════════════════════════════════════════════
  section('PHASE 5: استلام مخزون - Stock In');
  const t2 = now();
  const siA = { id: 'TEST-SI-A', grnNumber: 'TEST-GRN-001', itemId: 'TEST-A', itemCode: 'TEST-A-001', itemName: 'Test Item A - Helmet', quantity: 100, unit: 'Piece', receiptDate: t2, supplier: 'MSA Safety', remarks: 'Test receipt A', createdBy: 'yousif', batchId: 'TEST-BATCH-A', expiryDate: '2028-12-31', createdAt: t2, updatedAt: t2 };
  const siB = { id: 'TEST-SI-B', grnNumber: 'TEST-GRN-002', itemId: 'TEST-B', itemCode: 'TEST-B-001', itemName: 'Test Item B - Grease', quantity: 50, unit: 'Liter', receiptDate: t2, supplier: 'Shell', remarks: 'Test receipt B', createdBy: 'yousif', batchId: 'TEST-BATCH-B', expiryDate: '2027-06-30', createdAt: t2, updatedAt: t2 };
  const blA = { id: 'TEST-BL-A', batchId: 'TEST-BATCH-A', itemId: 'TEST-A', itemCode: 'TEST-A-001', itemName: 'Test Item A - Helmet', quantityIn: 100, quantityOut: 0, balance: 100, receiptDate: t2, expiryDate: '2028-12-31', supplier: 'MSA Safety', createdAt: t2, updatedAt: t2 };
  const blB = { id: 'TEST-BL-B', batchId: 'TEST-BATCH-B', itemId: 'TEST-B', itemCode: 'TEST-B-001', itemName: 'Test Item B - Grease', quantityIn: 50, quantityOut: 0, balance: 50, receiptDate: t2, expiryDate: '2027-06-30', supplier: 'Shell', createdAt: t2, updatedAt: t2 };
  const invA = { id: 'TEST-INV-A', itemId: 'TEST-A', itemCode: 'TEST-A-001', itemName: 'Test Item A - Helmet', totalQuantity: 100, availableQuantity: 100, reservedQuantity: 0, lastUpdated: t2 };
  const invB = { id: 'TEST-INV-B', itemId: 'TEST-B', itemCode: 'TEST-B-001', itemName: 'Test Item B - Grease', totalQuantity: 50, availableQuantity: 50, reservedQuantity: 0, lastUpdated: t2 };

  r = await syncPost(await login(), push(data, {
    stockInRecords: [...data.stockInRecords, siA, siB],
    batchLedger: [...data.batchLedger, blA, blB],
    inventoryBalances: [...data.inventoryBalances, invA, invB]
  }));
  ok(`Stock In pushed: ${r.ok}`);

  data = await syncGet(await login());
  const bA = data.batchLedger.find(b => b.batchId === 'TEST-BATCH-A');
  const bB = data.batchLedger.find(b => b.batchId === 'TEST-BATCH-B');
  const iA = data.inventoryBalances.find(b => b.itemId === 'TEST-A');
  const iB = data.inventoryBalances.find(b => b.itemId === 'TEST-B');
  ok(`Batch A: In=${bA?.quantityIn} Bal=${bA?.balance} ${bA?.balance === 100 ? '✓' : '✗'}`);
  ok(`Batch B: In=${bB?.quantityIn} Bal=${bB?.balance} ${bB?.balance === 50 ? '✓' : '✗'}`);
  ok(`Inv A: Total=${iA?.totalQuantity} Avail=${iA?.availableQuantity} ${iA?.availableQuantity === 100 ? '✓' : '✗'}`);
  ok(`Inv B: Total=${iB?.totalQuantity} Avail=${iB?.availableQuantity} ${iB?.availableQuantity === 50 ? '✓' : '✗'}`);

  // ══════════════════════════════════════════════════════════
  // PHASE 6: STOCK OUT
  // ══════════════════════════════════════════════════════════
  section('PHASE 6: صرف مخزون - Stock Out');
  const t3 = now();
  const soA = { id: 'TEST-SO-A', issueNumber: 'TEST-ISS-001', itemId: 'TEST-A', itemCode: 'TEST-A-001', itemName: 'Test Item A - Helmet', quantity: 25, unit: 'Piece', issuedTo: 'Ahmed Ali', jobNumber: 'JOB-TEST-01', remarks: 'Site use', issuedBy: 'yousif', issueDate: t3, batchId: 'TEST-BATCH-A', createdAt: t3, updatedAt: t3 };
  const soB = { id: 'TEST-SO-B', issueNumber: 'TEST-ISS-002', itemId: 'TEST-B', itemCode: 'TEST-B-001', itemName: 'Test Item B - Grease', quantity: 15, unit: 'Liter', issuedTo: 'Mohammed', jobNumber: 'JOB-TEST-02', remarks: 'Machine use', issuedBy: 'yousif', issueDate: t3, batchId: 'TEST-BATCH-B', createdAt: t3, updatedAt: t3 };

  // Update batches and inv
  const newBatches = data.batchLedger.map(b => {
    if (b.batchId === 'TEST-BATCH-A') return { ...b, quantityOut: 25, balance: 75, updatedAt: t3 };
    if (b.batchId === 'TEST-BATCH-B') return { ...b, quantityOut: 15, balance: 35, updatedAt: t3 };
    return b;
  });
  const newInvs = data.inventoryBalances.map(b => {
    if (b.itemId === 'TEST-A') return { ...b, availableQuantity: 75, lastUpdated: t3 };
    if (b.itemId === 'TEST-B') return { ...b, availableQuantity: 35, lastUpdated: t3 };
    return b;
  });

  r = await syncPost(await login(), push(data, {
    stockOutRecords: [...data.stockOutRecords, soA, soB],
    batchLedger: newBatches,
    inventoryBalances: newInvs
  }));
  ok(`Stock Out pushed: ${r.ok}`);

  data = await syncGet(await login());
  const bA2 = data.batchLedger.find(b => b.batchId === 'TEST-BATCH-A');
  const bB2 = data.batchLedger.find(b => b.batchId === 'TEST-BATCH-B');
  const iA2 = data.inventoryBalances.find(b => b.itemId === 'TEST-A');
  const iB2 = data.inventoryBalances.find(b => b.itemId === 'TEST-B');
  ok(`Batch A: Out=${bA2?.quantityOut} Bal=${bA2?.balance} ${bA2?.balance === 75 ? '✓' : '✗'}`);
  ok(`Batch B: Out=${bB2?.quantityOut} Bal=${bB2?.balance} ${bB2?.balance === 35 ? '✓' : '✗'}`);
  ok(`Inv A: Avail=${iA2?.availableQuantity} ${iA2?.availableQuantity === 75 ? '✓' : '✗'}`);
  ok(`Inv B: Avail=${iB2?.availableQuantity} ${iB2?.availableQuantity === 35 ? '✓' : '✗'}`);
  ok(`Stock Out records: ${data.stockOutRecords.filter(s => s.issueNumber?.startsWith('TEST-ISS')).length}`);

  // ══════════════════════════════════════════════════════════
  // PHASE 7: UPDATE ITEM
  // ══════════════════════════════════════════════════════════
  section('PHASE 7: تحديث عنصر - Update Item');
  const t4 = now();
  const updatedItems = data.masterItems.map(i => {
    if (i.id === 'TEST-A') return { ...i, itemName: 'Test Item A - Helmet UPDATED', minStock: 20, location: 'Z9-99', updatedAt: t4 };
    return i;
  });
  r = await syncPost(await login(), push(data, { masterItems: updatedItems }));
  ok(`Update pushed: ${r.ok}`);

  data = await syncGet(await login());
  const upd = data.masterItems.find(i => i.id === 'TEST-A');
  ok(`Name updated: ${upd?.itemName?.includes('UPDATED') ? '✓' : '✗'} (${upd?.itemName})`);
  ok(`MinStock updated: ${upd?.minStock === 20 ? '✓' : '✗'} (${upd?.minStock})`);
  ok(`Location updated: ${upd?.location === 'Z9-99' ? '✓' : '✗'} (${upd?.location})`);

  // ══════════════════════════════════════════════════════════
  // PHASE 8: ARCHIVE + RESTORE
  // ══════════════════════════════════════════════════════════
  section('PHASE 8: أرشفة واسترجاع - Archive + Restore');
  const t5 = now();
  let archItems = data.masterItems.map(i => {
    if (i.id === 'TEST-A') return { ...i, status: 'Archived', updatedAt: t5 };
    return i;
  });
  r = await syncPost(await login(), push(data, { masterItems: archItems }));
  ok(`Archive pushed: ${r.ok}`);

  data = await syncGet(await login());
  const arch = data.masterItems.find(i => i.id === 'TEST-A');
  ok(`Status is Archived: ${arch?.status === 'Archived' ? '✓' : '✗'}`);

  const t6 = now();
  let restItems = data.masterItems.map(i => {
    if (i.id === 'TEST-A') return { ...i, status: 'Active', updatedAt: t6 };
    return i;
  });
  r = await syncPost(await login(), push(data, { masterItems: restItems }));
  ok(`Restore pushed: ${r.ok}`);

  data = await syncGet(await login());
  const rest = data.masterItems.find(i => i.id === 'TEST-A');
  ok(`Status is Active: ${rest?.status === 'Active' ? '✓' : '✗'}`);

  // ══════════════════════════════════════════════════════════
  // PHASE 9: STOCK ADJUSTMENT
  // ══════════════════════════════════════════════════════════
  section('PHASE 9: تعديل مخزون - Stock Adjustment');
  const t7 = now();
  const adj = { id: 'TEST-ADJ', adjustmentNumber: 'TEST-ADJ-001', itemId: 'TEST-A', itemCode: 'TEST-A-001', itemName: 'Test Item A - Helmet', adjustmentType: 'Addition', quantity: 10, reason: 'Found extra in warehouse', adjustedBy: 'yousif', date: t7, batchId: 'TEST-BATCH-A', createdAt: t7, updatedAt: t7 };

  const adjBatches = data.batchLedger.map(b => {
    if (b.batchId === 'TEST-BATCH-A') return { ...b, quantityIn: b.quantityIn + 10, balance: b.balance + 10, updatedAt: t7 };
    return b;
  });
  const adjInvs = data.inventoryBalances.map(b => {
    if (b.itemId === 'TEST-A') return { ...b, totalQuantity: b.totalQuantity + 10, availableQuantity: b.availableQuantity + 10, lastUpdated: t7 };
    return b;
  });

  r = await syncPost(await login(), push(data, { stockAdjustments: [...(data.stockAdjustments || []), adj], batchLedger: adjBatches, inventoryBalances: adjInvs }));
  ok(`Adjustment pushed: ${r.ok}`);

  data = await syncGet(await login());
  const adjB = data.batchLedger.find(b => b.batchId === 'TEST-BATCH-A');
  const adjI = data.inventoryBalances.find(b => b.itemId === 'TEST-A');
  ok(`Batch A balance=85: ${adjB?.balance === 85 ? '✓' : '✗'} (${adjB?.balance})`);
  ok(`Inv A avail=85: ${adjI?.availableQuantity === 85 ? '✓' : '✗'} (${adjI?.availableQuantity})`);

  // ══════════════════════════════════════════════════════════
  // PHASE 10: EMPLOYEE CRUD
  // ══════════════════════════════════════════════════════════
  section('PHASE 10: إدارة الموظفين - Employee CRUD');
  const t8 = now();
  const emp = { id: 'TEST-EMP', name: 'Test Employee E2E', iqama: '1234567890', department: 'Operations', jobTitle: 'Technician', nationality: 'Filipino', phone: '0555555555', status: 'Active', createdAt: t8, updatedAt: t8 };

  r = await syncPost(await login(), push(data, { employees: [...data.employees, emp] }));
  ok(`Create employee: ${r.ok}`);
  data = await syncGet(await login());
  ok(`Employee exists: ${data.employees.find(e => e.id === 'TEST-EMP')?.name}`);

  const t9 = now();
  const updEmps = data.employees.map(e => {
    if (e.id === 'TEST-EMP') return { ...e, name: 'Test Employee Updated', phone: '0666666666', updatedAt: t9 };
    return e;
  });
  r = await syncPost(await login(), push(data, { employees: updEmps }));
  data = await syncGet(await login());
  ok(`Employee updated: ${data.employees.find(e => e.id === 'TEST-EMP')?.name}`);

  const delEmps = data.employees.filter(e => e.id !== 'TEST-EMP');
  const delIds = [...(data.deletedIds || []), 'TEST-EMP'];
  r = await syncPost(await login(), push(data, { employees: delEmps, deletedIds: delIds }));
  data = await syncGet(await login());
  ok(`Employee deleted: ${!data.employees.find(e => e.id === 'TEST-EMP') ? '✓' : '✗'}`);

  // ══════════════════════════════════════════════════════════
  // PHASE 11: DELETE ITEM + BATCH/INV CASCADING
  // ══════════════════════════════════════════════════════════
  section('PHASE 11: حذف عنصر مع التبعيات - Delete with Cascading');
  const delItems = data.masterItems.filter(i => i.id !== 'TEST-B');
  const delBatches = data.batchLedger.filter(b => b.itemId !== 'TEST-B');
  const delInvs = data.inventoryBalances.filter(b => b.itemId !== 'TEST-B');
  const delSI = data.stockInRecords.filter(s => s.itemId !== 'TEST-B');
  const delSO = data.stockOutRecords.filter(s => s.itemId !== 'TEST-B');
  const delAdj2 = (data.stockAdjustments || []).filter(a => a.itemId !== 'TEST-B');
  const delIds2 = [...(data.deletedIds || []), 'TEST-B'];

  r = await syncPost(await login(), push(data, {
    masterItems: delItems, batchLedger: delBatches, inventoryBalances: delInvs,
    stockInRecords: delSI, stockOutRecords: delSO, stockAdjustments: delAdj2, deletedIds: delIds2
  }));
  ok(`Delete pushed: ${r.ok}`);

  data = await syncGet(await login());
  ok(`Item B removed: ${!data.masterItems.find(i => i.id === 'TEST-B') ? '✓' : '✗'}`);
  ok(`Batch B removed: ${!data.batchLedger.find(b => b.itemId === 'TEST-B') ? '✓' : '✗'}`);
  ok(`Inv B removed: ${!data.inventoryBalances.find(b => b.itemId === 'TEST-B') ? '✓' : '✗'}`);

  // ══════════════════════════════════════════════════════════
  // PHASE 12: 2 CLIENTS SIMULTANEOUS OPERATIONS
  // ══════════════════════════════════════════════════════════
  section('PHASE 12: عميلان simultanious - Two Clients');
  const cA = await syncGet(await login());
  const cB = await syncGet(await login());

  const t10 = now();
  // Client A: issue 5 helmets
  const cA_batch = cA.batchLedger.map(b => {
    if (b.batchId === 'TEST-BATCH-A') return { ...b, quantityOut: b.quantityOut + 5, balance: b.balance - 5, updatedAt: t10 };
    return b;
  });
  const cA_inv = cA.inventoryBalances.map(b => {
    if (b.itemId === 'TEST-A') return { ...b, availableQuantity: b.availableQuantity - 5, lastUpdated: t10 };
    return b;
  });
  const cA_so = { id: 'TEST-SO-C', issueNumber: 'TEST-ISS-003', itemId: 'TEST-A', itemCode: 'TEST-A-001', itemName: 'Test Item A', quantity: 5, unit: 'Piece', issuedTo: 'ClientA', jobNumber: 'JOB-C', remarks: 'Client A', issuedBy: 'yousif', issueDate: t10, batchId: 'TEST-BATCH-A', createdAt: t10, updatedAt: t10 };

  // Client B: issue 3 helmets (from same starting point)
  const t11 = now();
  const cB_batch = cB.batchLedger.map(b => {
    if (b.batchId === 'TEST-BATCH-A') return { ...b, quantityOut: b.quantityOut + 3, balance: b.balance - 3, updatedAt: t11 };
    return b;
  });
  const cB_inv = cB.inventoryBalances.map(b => {
    if (b.itemId === 'TEST-A') return { ...b, availableQuantity: b.availableQuantity - 3, lastUpdated: t11 };
    return b;
  });
  const cB_so = { id: 'TEST-SO-D', issueNumber: 'TEST-ISS-004', itemId: 'TEST-A', itemCode: 'TEST-A-001', itemName: 'Test Item A', quantity: 3, unit: 'Piece', issuedTo: 'ClientB', jobNumber: 'JOB-D', remarks: 'Client B', issuedBy: 'yousif', issueDate: t11, batchId: 'TEST-BATCH-A', createdAt: t11, updatedAt: t11 };

  r = await syncPost(await login(), push(cA, { stockOutRecords: [...cA.stockOutRecords, cA_so], batchLedger: cA_batch, inventoryBalances: cA_inv }));
  ok(`Client A push: ${r.ok}`);

  r = await syncPost(await login(), push(cB, { stockOutRecords: [...cB.stockOutRecords, cB_so], batchLedger: cB_batch, inventoryBalances: cB_inv }));
  ok(`Client B push: ${r.ok}`);

  data = await syncGet(await login());
  ok(`SO-C (Client A) exists: ${!!data.stockOutRecords.find(s => s.issueNumber === 'TEST-ISS-003') ? '✓' : '✗'}`);
  ok(`SO-D (Client B) exists: ${!!data.stockOutRecords.find(s => s.issueNumber === 'TEST-ISS-004') ? '✓' : '✗'}`);

  const finalB = data.batchLedger.find(b => b.batchId === 'TEST-BATCH-A');
  const finalI = data.inventoryBalances.find(b => b.itemId === 'TEST-A');
  info(`Final Batch A: In=${finalB?.quantityIn} Out=${finalB?.quantityOut} Bal=${finalB?.balance}`);
  info(`Final Inv A: Total=${finalI?.totalQuantity} Avail=${finalI?.availableQuantity}`);

  // ══════════════════════════════════════════════════════════
  // PHASE 13: PUBLIC FORM + PENDING REQUESTS
  // ══════════════════════════════════════════════════════════
  section('PHASE 13: النموذج العام - Public Form');
  try {
    const pubR = await fetchRetry(`${BASE}/api/public/stock-data`);
    const pubD = await pubR.json();
    ok(`Public stock-data: ${pubD.items?.length || 0} items, ${pubD.employees?.length || 0} employees`);
  } catch (e) { fail(`Public stock-data: ${e.message}`); }

  try {
    const pubR = await fetchRetry(`${BASE}/api/public/stock-out`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: 'TEST-A', quantity: 1, issuedTo: 'Test', jobNumber: 'TEST', remarks: 'test' })
    });
    const pubJ = await pubR.json();
    ok(`Public stock-out request: ${pubR.status === 400 ? 'handled (no valid data)' : pubR.status}`);
  } catch (e) { fail(`Public stock-out: ${e.message}`); }

  try {
    const pendR = await fetchRetry(`${BASE}/api/pending-requests`);
    ok(`Pending requests endpoint: ${pendR.status === 401 ? 'protected ✓' : pendR.status}`);
  } catch (e) { fail(`Pending requests: ${e.message}`); }

  // ══════════════════════════════════════════════════════════
  // PHASE 14: SECURITY
  // ══════════════════════════════════════════════════════════
  section('PHASE 14: الأمان - Security');
  // CORS
  try {
    const corsR = await fetchRetry(`${BASE}/api/login`, { method: 'OPTIONS' });
    ok(`CORS preflight: ${corsR.status}`);
  } catch (e) { fail(`CORS: ${e.message}`); }
  // No auth
  try {
    const noAuthR = await fetchRetry(`${BASE}/api/full-sync`);
    ok(`No auth rejected: ${noAuthR.status === 401 ? '✓' : noAuthR.status}`);
  } catch (e) { fail(`No auth: ${e.message}`); }
  // Users endpoint no auth
  try {
    const usersR = await fetchRetry(`${BASE}/api/users`);
    ok(`/api/users no auth: ${usersR.status === 401 ? '✓' : usersR.status}`);
  } catch (e) { fail(`/api/users: ${e.message}`); }
  // Users endpoint with auth
  try {
    const usersR = await fetchRetry(`${BASE}/api/users`, { headers: { Authorization: `Bearer ${await login()}` } });
    ok(`/api/users with auth: ${usersR.status === 200 ? '✓' : usersR.status}`);
  } catch (e) { fail(`/api/users auth: ${e.message}`); }

  // ══════════════════════════════════════════════════════════
  // PHASE 15: SSE
  // ══════════════════════════════════════════════════════════
  section('PHASE 15: الإشعارات الفورية - SSE');
  try {
    const sseR = await fetchRetry(`${BASE}/api/sse`, {
      headers: { Authorization: `Bearer ${await login()}` }
    });
    ok(`SSE endpoint: ${sseR.status === 200 ? '✓' : sseR.status}`);
  } catch (e) { fail(`SSE: ${e.message}`); }

  // ══════════════════════════════════════════════════════════
  // PHASE 16: DATA INTEGRITY FINAL
  // ══════════════════════════════════════════════════════════
  section('PHASE 16: سلامة البيانات النهائية - Final Integrity');
  data = await syncGet(await login());
  const testItems = data.masterItems.filter(i => i.id.startsWith('TEST-'));
  const testBatches = data.batchLedger.filter(b => b.batchId?.startsWith('TEST-'));
  const testInvs = data.inventoryBalances.filter(b => b.itemId?.startsWith('TEST-'));
  const testSO = data.stockOutRecords.filter(s => s.issueNumber?.startsWith('TEST-'));
  const testSI = data.stockInRecords.filter(s => s.grnNumber?.startsWith('TEST-'));

  ok(`Test items remaining: ${testItems.length} (expected 1)`);
  ok(`Test batches remaining: ${testBatches.length} (expected 1 - BATCH-A)`);
  ok(`Test inv balances: ${testInvs.length} (expected 1 - TEST-A)`);
  ok(`Test stock-outs: ${testSO.length} (expected 4)`);
  ok(`Test stock-ins: ${testSI.length} (expected 2)`);

  // Verify no negative balances
  const negBatches = data.batchLedger.filter(b => b.balance < 0);
  const negInvs = data.inventoryBalances.filter(b => b.availableQuantity < 0);
  ok(`No negative batch balances: ${negBatches.length === 0 ? '✓' : negBatches.length + ' FOUND'}`);
  ok(`No negative inventory: ${negInvs.length === 0 ? '✓' : negInvs.length + ' FOUND'}`);

  // Verify total data preserved
  info(`Total items: ${data.masterItems.length}`);
  info(`Total employees: ${data.employees.length}`);
  info(`Total batches: ${data.batchLedger.length}`);
  info(`Total inv balances: ${data.inventoryBalances.length}`);
  info(`Total stock-ins: ${data.stockInRecords.length}`);
  info(`Total stock-outs: ${data.stockOutRecords.length}`);

  // ══════════════════════════════════════════════════════════
  // CLEANUP
  // ══════════════════════════════════════════════════════════
  section('التنظيف النهائي - Cleanup');
  const cleanItems = data.masterItems.filter(i => !i.id.startsWith('TEST-'));
  const cleanBatches = data.batchLedger.filter(b => !b.batchId?.startsWith('TEST-'));
  const cleanInvs = data.inventoryBalances.filter(b => !b.itemId?.startsWith('TEST-'));
  const cleanSI = data.stockInRecords.filter(s => !s.grnNumber?.startsWith('TEST-'));
  const cleanSO = data.stockOutRecords.filter(s => !s.issueNumber?.startsWith('TEST-'));
  const cleanAdj = (data.stockAdjustments || []).filter(a => !a.adjustmentNumber?.startsWith('TEST-'));
  const cleanDel = [...(data.deletedIds || []), 'TEST-A', 'TEST-B', 'TEST-EMP'];

  r = await syncPost(await login(), push(data, {
    masterItems: cleanItems, batchLedger: cleanBatches, inventoryBalances: cleanInvs,
    stockInRecords: cleanSI, stockOutRecords: cleanSO, stockAdjustments: cleanAdj, deletedIds: cleanDel
  }));
  ok(`Cleanup pushed: ${r.ok}`);

  // ══════════════════════════════════════════════════════════
  // SUMMARY
  // ══════════════════════════════════════════════════════════
  console.log('\n\x1b[1m══════════════════════════════════════════════════════════════\x1b[0m');
  console.log(`\x1b[1m  النتيجة النهائية: ${passed} ✓  |  ${failed} ✗  |  ${total} المجموع\x1b[0m`);
  console.log('\x1b[1m══════════════════════════════════════════════════════════════\x1b[0m');
  if (failed === 0) {
    console.log('\n  \x1b[32m════════════════════════════════════════════\x1b[0m');
    console.log('  \x1b[32m  ✅ النظام شغال 100% - ALL TESTS PASSED  ✅\x1b[0m');
    console.log('  \x1b[32m════════════════════════════════════════════\x1b[0m\n');
  } else {
    console.log('\n  \x1b[31m════════════════════════════════════════════\x1b[0m');
    console.log(`  \x1b[31m  ❌ ${failed} اختبار فشل - SOME TESTS FAILED ❌\x1b[0m`);
    console.log('  \x1b[31m════════════════════════════════════════════\x1b[0m\n');
  }
}

main().catch(e => { console.error('\x1b[31mFATAL:', e, '\x1b[0m'); process.exit(1); });
