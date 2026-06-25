const BASE = 'https://wms-amsre-sulzer-pnkt.onrender.com';

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url, opts = {}, retries = 5, delay = 8000) {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const r = await fetch(url, { ...opts, signal: controller.signal });
      clearTimeout(timeout);
      return r;
    } catch (e) {
      if (i === retries - 1) throw e;
      console.log(`  Retry ${i + 1}/${retries} for ${url.split('/').pop()}...`);
      await sleep(delay);
    }
  }
}

async function login(user = 'yousif', pass = '98765') {
  const r = await fetchWithRetry(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass })
  });
  const j = await r.json();
  return j.token;
}

async function syncGet(token) {
  const r = await fetchWithRetry(`${BASE}/api/full-sync`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return r.json();
}

async function syncPost(token, data) {
  const r = await fetchWithRetry(`${BASE}/api/full-sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(data)
  });
  return r.json();
}

const now = () => new Date().toISOString();
const ok = (msg) => console.log(`  \x1b[32m[OK]\x1b[0m ${msg}`);
const fail = (msg) => console.log(`  \x1b[31m[FAIL]\x1b[0m ${msg}`);
const info = (msg) => console.log(`  ${msg}`);

function makePush(data, overrides = {}) {
  return {
    masterItems: data.masterItems,
    employees: data.employees,
    categories: data.categories || ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality'],
    stockInRecords: data.stockInRecords,
    stockOutRecords: data.stockOutRecords,
    batchLedger: data.batchLedger,
    inventoryBalances: data.inventoryBalances,
    jobs: data.jobs,
    users: data.users,
    stockAdjustments: data.stockAdjustments,
    auditTrail: data.auditTrail,
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

let passed = 0, failed = 0;
function check(name, condition) {
  if (condition) { passed++; ok(name); }
  else { failed++; fail(name); }
}

async function main() {
  console.log('\n========================================');
  console.log('  FULL E2E TEST - ALL OPERATIONS');
  console.log('========================================\n');

  // Warm up server
  console.log('Warming up server...');
  await login();
  await sleep(2000);
  console.log('Server warm.\n');

  // ===== PHASE 1: LOGIN =====
  console.log('PHASE 1: ALL USER LOGINS');
  const users = [
    ['yousif', '98765'], ['admin', 'admin123'], ['manager', 'manager123'],
    ['supervisor', 'super123'], ['storekeeper', 'store123'], ['viewer', 'view123']
  ];
  for (const [u, p] of users) {
    try {
      const t = await login(u, p);
      check(`Login ${u}`, !!t);
    } catch (e) { failed++; fail(`Login ${u}: ${e.message}`); }
  }
  // Reject bad passwords
  try {
    const r = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'yousif', password: 'wrong' }) });
    check('Reject wrong password', r.status === 401);
  } catch (e) { failed++; fail(`Bad login: ${e.message}`); }

  // ===== PHASE 2: CREATE ITEMS =====
  console.log('\nPHASE 2: CREATE 2 NEW ITEMS');
  let token = await login();
  let data = await syncGet(token);
  const t2 = now();

  const newItem1 = { id: 'E2E-A', itemCode: 'PPE-TEST-A', itemName: 'Test Item A', category: 'PPE', unit: 'Piece', status: 'Active', trackerGroup: 'PPE', expiryTracking: false, minStock: 5, maxStock: 100, location: 'T1-01', createdAt: t2, updatedAt: t2 };
  const newItem2 = { id: 'E2E-B', itemCode: 'LUB-TEST-B', itemName: 'Test Item B', category: 'Lubricant', unit: 'Liter', status: 'Active', trackerGroup: 'Lubricant', expiryTracking: true, minStock: 3, maxStock: 50, location: 'T2-02', createdAt: t2, updatedAt: t2 };

  let r1 = await syncPost(await login(), makePush(data, { masterItems: [...data.masterItems, newItem1, newItem2] }));
  check('Push create items', r1.ok);

  data = await syncGet(await login());
  const itemsA = data.masterItems.filter(i => i.id === 'E2E-A' || i.id === 'E2E-B');
  check('Items A and B exist', itemsA.length === 2);
  info(`Items: ${itemsA.map(i => i.itemCode + ': ' + i.itemName).join(', ')}`);

  // ===== PHASE 3: STOCK IN =====
  console.log('\nPHASE 3: STOCK IN (RECEIVE 50A + 30B)');
  const t3 = now();
  const siA = { id: 'E2E-SI-A', grnNumber: 'GRN-E2E-A', itemId: 'E2E-A', itemCode: 'PPE-TEST-A', itemName: 'Test Item A', quantity: 50, unit: 'Piece', receiptDate: t3, supplier: 'Supplier A', remarks: 'E2E batch A', createdBy: 'yousif', batchId: 'BATCH-E2E-A', expiryDate: '2028-12-31', createdAt: t3, updatedAt: t3 };
  const siB = { id: 'E2E-SI-B', grnNumber: 'GRN-E2E-B', itemId: 'E2E-B', itemCode: 'LUB-TEST-B', itemName: 'Test Item B', quantity: 30, unit: 'Liter', receiptDate: t3, supplier: 'Supplier B', remarks: 'E2E batch B', createdBy: 'yousif', batchId: 'BATCH-E2E-B', expiryDate: '2027-06-30', createdAt: t3, updatedAt: t3 };
  const blA = { id: 'E2E-BL-A', batchId: 'BATCH-E2E-A', itemId: 'E2E-A', itemCode: 'PPE-TEST-A', itemName: 'Test Item A', quantityIn: 50, quantityOut: 0, balance: 50, receiptDate: t3, expiryDate: '2028-12-31', supplier: 'Supplier A', createdAt: t3, updatedAt: t3 };
  const blB = { id: 'E2E-BL-B', batchId: 'BATCH-E2E-B', itemId: 'E2E-B', itemCode: 'LUB-TEST-B', itemName: 'Test Item B', quantityIn: 30, quantityOut: 0, balance: 30, receiptDate: t3, expiryDate: '2027-06-30', supplier: 'Supplier B', createdAt: t3, updatedAt: t3 };
  const invA = { id: 'E2E-INV-A', itemId: 'E2E-A', itemCode: 'PPE-TEST-A', itemName: 'Test Item A', totalQuantity: 50, availableQuantity: 50, reservedQuantity: 0, lastUpdated: t3 };
  const invB = { id: 'E2E-INV-B', itemId: 'E2E-B', itemCode: 'LUB-TEST-B', itemName: 'Test Item B', totalQuantity: 30, availableQuantity: 30, reservedQuantity: 0, lastUpdated: t3 };

  r1 = await syncPost(await login(), makePush(data, {
    stockInRecords: [...data.stockInRecords, siA, siB],
    batchLedger: [...data.batchLedger, blA, blB],
    inventoryBalances: [...data.inventoryBalances, invA, invB]
  }));
  check('Push stock in', r1.ok);

  data = await syncGet(await login());
  const batchA = data.batchLedger.find(b => b.batchId === 'BATCH-E2E-A');
  const batchB = data.batchLedger.find(b => b.batchId === 'BATCH-E2E-B');
  const invBalA = data.inventoryBalances.find(b => b.itemId === 'E2E-A');
  const invBalB = data.inventoryBalances.find(b => b.itemId === 'E2E-B');

  check('Batch A: balance=50', batchA && batchA.balance === 50);
  check('Batch B: balance=30', batchB && batchB.balance === 30);
  check('Inv A: available=50', invBalA && invBalA.availableQuantity === 50);
  check('Inv B: available=30', invBalB && invBalB.availableQuantity === 30);
  info(`Batch A: In=${batchA?.quantityIn} Bal=${batchA?.balance}, Inv A: Avail=${invBalA?.availableQuantity}`);

  // ===== PHASE 4: STOCK OUT =====
  console.log('\nPHASE 4: STOCK OUT (ISSUE 15A + 10B)');
  const t4 = now();
  const soA = { id: 'E2E-SO-A', issueNumber: 'ISS-E2E-A', itemId: 'E2E-A', itemCode: 'PPE-TEST-A', itemName: 'Test Item A', quantity: 15, unit: 'Piece', issuedTo: 'Ahmed', jobNumber: 'JOB-E2E', remarks: 'Field use', issuedBy: 'yousif', issueDate: t4, batchId: 'BATCH-E2E-A', createdAt: t4, updatedAt: t4 };
  const soB = { id: 'E2E-SO-B', issueNumber: 'ISS-E2E-B', itemId: 'E2E-B', itemCode: 'LUB-TEST-B', itemName: 'Test Item B', quantity: 10, unit: 'Liter', issuedTo: 'Ali', jobNumber: 'JOB-E2E', remarks: 'Machine use', issuedBy: 'yousif', issueDate: t4, batchId: 'BATCH-E2E-B', createdAt: t4, updatedAt: t4 };

  const newBatches = data.batchLedger.map(b => {
    if (b.batchId === 'BATCH-E2E-A') return { ...b, quantityOut: 15, balance: 35, updatedAt: t4 };
    if (b.batchId === 'BATCH-E2E-B') return { ...b, quantityOut: 10, balance: 20, updatedAt: t4 };
    return b;
  });
  const newInvs = data.inventoryBalances.map(b => {
    if (b.itemId === 'E2E-A') return { ...b, availableQuantity: 35, lastUpdated: t4 };
    if (b.itemId === 'E2E-B') return { ...b, availableQuantity: 20, lastUpdated: t4 };
    return b;
  });

  r1 = await syncPost(await login(), makePush(data, {
    stockOutRecords: [...data.stockOutRecords, soA, soB],
    batchLedger: newBatches,
    inventoryBalances: newInvs
  }));
  check('Push stock out', r1.ok);

  data = await syncGet(await login());
  const batchA2 = data.batchLedger.find(b => b.batchId === 'BATCH-E2E-A');
  const batchB2 = data.batchLedger.find(b => b.batchId === 'BATCH-E2E-B');
  const invA2 = data.inventoryBalances.find(b => b.itemId === 'E2E-A');
  const invB2 = data.inventoryBalances.find(b => b.itemId === 'E2E-B');

  check('Batch A: balance=35 after 15 out', batchA2 && batchA2.balance === 35);
  check('Batch B: balance=20 after 10 out', batchB2 && batchB2.balance === 20);
  check('Inv A: available=35', invA2 && invA2.availableQuantity === 35);
  check('Inv B: available=20', invB2 && invB2.availableQuantity === 20);
  info(`Batch A: In=${batchA2?.quantityIn} Out=${batchA2?.quantityOut} Bal=${batchA2?.balance}`);
  info(`Inv A: Total=${invA2?.totalQuantity} Avail=${invA2?.availableQuantity}`);

  // ===== PHASE 5: UPDATE ITEM =====
  console.log('\nPHASE 5: UPDATE ITEM');
  const t5 = now();
  const updatedItems = data.masterItems.map(i => {
    if (i.id === 'E2E-A') return { ...i, itemName: 'Test Item A Updated', minStock: 20, location: 'T9-99', updatedAt: t5 };
    return i;
  });

  r1 = await syncPost(await login(), makePush(data, { masterItems: updatedItems }));
  check('Push update', r1.ok);

  data = await syncGet(await login());
  const updated = data.masterItems.find(i => i.id === 'E2E-A');
  check('Name updated', updated && updated.itemName === 'Test Item A Updated');
  check('MinStock updated', updated && updated.minStock === 20);
  check('Location updated', updated && updated.location === 'T9-99');
  info(`Name=${updated?.itemName} Min=${updated?.minStock} Loc=${updated?.location}`);

  // ===== PHASE 6: ARCHIVE + RESTORE =====
  console.log('\nPHASE 6: ARCHIVE + RESTORE');
  const t6a = now();
  const archived = data.masterItems.map(i => {
    if (i.id === 'E2E-A') return { ...i, status: 'Archived', updatedAt: t6a };
    return i;
  });
  r1 = await syncPost(await login(), makePush(data, { masterItems: archived }));
  check('Push archive', r1.ok);

  data = await syncGet(await login());
  const isArchived = data.masterItems.find(i => i.id === 'E2E-A');
  check('Item archived', isArchived && isArchived.status === 'Archived');

  const t6b = now();
  const restored = data.masterItems.map(i => {
    if (i.id === 'E2E-A') return { ...i, status: 'Active', updatedAt: t6b };
    return i;
  });
  r1 = await syncPost(await login(), makePush(data, { masterItems: restored }));
  check('Push restore', r1.ok);

  data = await syncGet(await login());
  const isRestored = data.masterItems.find(i => i.id === 'E2E-A');
  check('Item restored', isRestored && isRestored.status === 'Active');

  // ===== PHASE 7: EMPLOYEE CRUD =====
  console.log('\nPHASE 7: EMPLOYEE CRUD');
  const t7 = now();
  const newEmp = { id: 'E2E-EMP', name: 'Test Employee E2E', iqama: '1234567890', department: 'Operations', jobTitle: 'Technician', nationality: 'Test', phone: '1234567890', status: 'Active', createdAt: t7, updatedAt: t7 };

  r1 = await syncPost(await login(), makePush(data, { employees: [...data.employees, newEmp] }));
  check('Create employee', r1.ok);

  data = await syncGet(await login());
  const emp = data.employees.find(e => e.id === 'E2E-EMP');
  check('Employee exists', emp && emp.name === 'Test Employee E2E');

  // Update employee
  const t7b = now();
  const updatedEmps = data.employees.map(e => {
    if (e.id === 'E2E-EMP') return { ...e, name: 'Test Employee Updated', updatedAt: t7b };
    return e;
  });
  r1 = await syncPost(await login(), makePush(data, { employees: updatedEmps }));
  data = await syncGet(await login());
  const emp2 = data.employees.find(e => e.id === 'E2E-EMP');
  check('Employee updated', emp2 && emp2.name === 'Test Employee Updated');

  // Delete employee
  const deletedEmps = data.employees.filter(e => e.id !== 'E2E-EMP');
  const delIds = [...(data.deletedIds || []), 'E2E-EMP'];
  r1 = await syncPost(await login(), makePush(data, { employees: deletedEmps, deletedIds: delIds }));
  data = await syncGet(await login());
  const emp3 = data.employees.find(e => e.id === 'E2E-EMP');
  check('Employee deleted', !emp3);

  // ===== PHASE 8: STOCK ADJUSTMENT =====
  console.log('\nPHASE 8: STOCK ADJUSTMENT');
  const t8 = now();
  const adj = { id: 'E2E-ADJ', adjustmentNumber: 'ADJ-E2E-001', itemId: 'E2E-A', itemCode: 'PPE-TEST-A', itemName: 'Test Item A', adjustmentType: 'Addition', quantity: 5, reason: 'Found extra', adjustedBy: 'yousif', date: t8, batchId: 'BATCH-E2E-A', createdAt: t8, updatedAt: t8 };

  // Update batch + inv for adjustment
  const adjBatches = data.batchLedger.map(b => {
    if (b.batchId === 'BATCH-E2E-A') return { ...b, quantityIn: b.quantityIn + 5, balance: b.balance + 5, updatedAt: t8 };
    return b;
  });
  const adjInvs = data.inventoryBalances.map(b => {
    if (b.itemId === 'E2E-A') return { ...b, totalQuantity: b.totalQuantity + 5, availableQuantity: b.availableQuantity + 5, lastUpdated: t8 };
    return b;
  });

  r1 = await syncPost(await login(), makePush(data, { stockAdjustments: [...(data.stockAdjustments || []), adj], batchLedger: adjBatches, inventoryBalances: adjInvs }));
  check('Push adjustment', r1.ok);

  data = await syncGet(await login());
  const adjResult = data.batchLedger.find(b => b.batchId === 'BATCH-E2E-A');
  const invAdj = data.inventoryBalances.find(b => b.itemId === 'E2E-A');
  check('Batch balance=40 after +5', adjResult && adjResult.balance === 40);
  check('Inv available=40 after +5', invAdj && invAdj.availableQuantity === 40);
  info(`Batch: In=${adjResult?.quantityIn} Bal=${adjResult?.balance}, Inv: Avail=${invAdj?.availableQuantity}`);

  // ===== PHASE 9: DELETE ITEM + SYNC =====
  console.log('\nPHASE 9: DELETE ITEM + SYNC');
  const delItems = data.masterItems.filter(i => i.id !== 'E2E-B');
  const delInv = data.inventoryBalances.filter(b => b.itemId !== 'E2E-B');
  const delBatch = data.batchLedger.filter(b => b.itemId !== 'E2E-B');
  const delSI = data.stockInRecords.filter(s => s.itemId !== 'E2E-B');
  const delSO = data.stockOutRecords.filter(s => s.itemId !== 'E2E-B');
  const delIds9 = [...(data.deletedIds || []), 'E2E-B'];

  r1 = await syncPost(await login(), makePush(data, {
    masterItems: delItems, inventoryBalances: delInv, batchLedger: delBatch,
    stockInRecords: delSI, stockOutRecords: delSO, deletedIds: delIds9
  }));
  check('Push delete', r1.ok);

  data = await syncGet(await login());
  const deletedItem = data.masterItems.find(i => i.id === 'E2E-B');
  const deletedBatch = data.batchLedger.find(b => b.itemId === 'E2E-B');
  const deletedInv = data.inventoryBalances.find(b => b.itemId === 'E2E-B');
  check('Item B deleted', !deletedItem);
  check('Batch B deleted', !deletedBatch);
  check('Inv B deleted', !deletedInv);
  info(`Remaining items: ${data.masterItems.filter(i => i.id.startsWith('E2E-')).map(i => i.id).join(', ')}`);

  // ===== PHASE 10: 2-CLIENT SIMULTANEOUS OPERATIONS =====
  console.log('\nPHASE 10: 2 CLIENTS - SIMULTANEOUS OPERATIONS');
  const clientA = await syncGet(await login());
  const clientB = await syncGet(await login()); // Same starting point

  // Client A: Issue 5 from batch A
  const t10 = now();
  const cA_batches = clientA.batchLedger.map(b => {
    if (b.batchId === 'BATCH-E2E-A') return { ...b, quantityOut: b.quantityOut + 5, balance: b.balance - 5, updatedAt: t10 };
    return b;
  });
  const cA_invs = clientA.inventoryBalances.map(b => {
    if (b.itemId === 'E2E-A') return { ...b, availableQuantity: b.availableQuantity - 5, lastUpdated: t10 };
    return b;
  });
  const cA_so = { id: 'E2E-SO-C', issueNumber: 'ISS-E2E-C', itemId: 'E2E-A', itemCode: 'PPE-TEST-A', itemName: 'Test Item A', quantity: 5, unit: 'Piece', issuedTo: 'ClientA-User', jobNumber: 'JOB-A', remarks: 'Client A issue', issuedBy: 'yousif', issueDate: t10, batchId: 'BATCH-E2E-A', createdAt: t10, updatedAt: t10 };

  // Client B: Issue 3 from batch A (different amount)
  const t10b = now();
  const cB_batches = clientB.batchLedger.map(b => {
    if (b.batchId === 'BATCH-E2E-A') return { ...b, quantityOut: b.quantityOut + 3, balance: b.balance - 3, updatedAt: t10b };
    return b;
  });
  const cB_invs = clientB.inventoryBalances.map(b => {
    if (b.itemId === 'E2E-A') return { ...b, availableQuantity: b.availableQuantity - 3, lastUpdated: t10b };
    return b;
  });
  const cB_so = { id: 'E2E-SO-D', issueNumber: 'ISS-E2E-D', itemId: 'E2E-A', itemCode: 'PPE-TEST-A', itemName: 'Test Item A', quantity: 3, unit: 'Piece', issuedTo: 'ClientB-User', jobNumber: 'JOB-B', remarks: 'Client B issue', issuedBy: 'yousif', issueDate: t10b, batchId: 'BATCH-E2E-A', createdAt: t10b, updatedAt: t10b };

  // Push Client A first
  r1 = await syncPost(await login(), makePush(clientA, { stockOutRecords: [...clientA.stockOutRecords, cA_so], batchLedger: cA_batches, inventoryBalances: cA_invs }));
  check('Client A push', r1.ok);

  // Push Client B second (same starting point, different changes)
  r1 = await syncPost(await login(), makePush(clientB, { stockOutRecords: [...clientB.stockOutRecords, cB_so], batchLedger: cB_batches, inventoryBalances: cB_invs }));
  check('Client B push', r1.ok);

  // Verify both stock outs exist
  data = await syncGet(await login());
  const soC = data.stockOutRecords.find(s => s.issueNumber === 'ISS-E2E-C');
  const soD = data.stockOutRecords.find(s => s.issueNumber === 'ISS-E2E-D');
  check('SO-C exists (Client A)', !!soC);
  check('SO-D exists (Client B)', !!soD);

  // The batch should have the LAST push's values (Client B pushed 35-3=32, but the updatedAt is newer)
  const finalBatch = data.batchLedger.find(b => b.batchId === 'BATCH-E2E-A');
  const finalInv = data.inventoryBalances.find(b => b.itemId === 'E2E-A');
  info(`Final Batch A: In=${finalBatch?.quantityIn} Out=${finalBatch?.quantityOut} Bal=${finalBatch?.balance}`);
  info(`Final Inv A: Total=${finalBatch?.quantityIn} Avail=${finalInv?.availableQuantity}`);

  // ===== SUMMARY =====
  console.log('\n========================================');
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  console.log('========================================');
  if (failed === 0) console.log('\x1b[32m  ALL TESTS PASSED!\x1b[0m');
  else console.log('\x1b[31m  SOME TESTS FAILED!\x1b[0m');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
