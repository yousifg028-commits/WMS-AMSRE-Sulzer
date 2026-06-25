console.log('Starting WMS server...');
console.log('Node version:', process.version);
console.log('PORT:', process.env.PORT);

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const nodemailer = require('nodemailer');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'wms-data.json');
const GOOGLE_SHEET_URL = process.env.GOOGLE_SHEET_URL || 'https://script.google.com/macros/s/AKfycbx7puscv5jMys7WmVLh4EOYSNRof4yOSoTuq7bhgnDqtR7e0X_VJqDZyglgj8NGUjWF8A/exec';

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || origin === 'null') return callback(null, true);
    callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

var sseClients = [];
var sseClientIdCounter = 0;

function notifySSE() {
  for (var i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].res.write('data: sync\n\n');
    } catch (e) {
      sseClients.splice(i, 1);
    }
  }
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      var raw = fs.readFileSync(DATA_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.error('loadData parse error:', e.message);
    try {
      if (fs.existsSync(DATA_FILE)) {
        var backupPath = DATA_FILE + '.bak.' + Date.now();
        fs.copyFileSync(DATA_FILE, backupPath);
        console.log('Corrupted data backed up to:', backupPath);
      }
    } catch (backupErr) { console.error('Backup failed:', backupErr.message); }
  }
  return null;
}

function saveData(extra) {
  try {
    if (extra) Object.assign(persistedData, extra);
    persistedData.extraUsers = extraUsers;
    persistedData.publicEmployees = publicEmployees;
    persistedData.publicItems = publicItems;
    persistedData.publicJobs = publicJobs;
    persistedData.pendingRequests = pendingRequests;
    persistedData.serverStockOutRecords = serverStockOutRecords;
    persistedData.stockOutSequence = stockOutSequence;
    persistedData.requestSequence = requestSequence;
    fs.writeFileSync(DATA_FILE, JSON.stringify(persistedData, null, 2));
    notifySSE();
    syncToGoogleSheetDebounced();
  } catch(e) { console.error('saveData error:', e.message); }
}

var persistedData = loadData() || { extraUsers: [] };

var extraUsers = persistedData.extraUsers || [];
var publicItems = persistedData.publicItems || [];
var publicEmployees = persistedData.publicEmployees || [];
var publicJobs = persistedData.publicJobs || [];
var pendingRequests = persistedData.pendingRequests || [];
var requestSequence = persistedData.requestSequence || 1000;
var serverStockOutRecords = persistedData.serverStockOutRecords || [];
var stockOutSequence = persistedData.stockOutSequence || 0;

function syncToGoogleSheet() {
  if (!GOOGLE_SHEET_URL) return;
  try {
    var sheetsData = {};
    var masterHeaders = ['id','itemCode','itemName','category','subcategory','unitOfMeasure','location','trackerGroup','batchControlled','fefoEnabled','minimumStock','maximumStock','reorderLevel','standardShelfLife','manufacturer','supplier','msdsRequired','msdsLink','fifoRequired','remarks','status','createdAt','updatedAt'];
    sheetsData['MasterItems'] = { headers: masterHeaders, rows: persistedData.masterItems || [] };
    var empHeaders = ['id','employeeId','employeeName','department','position','location','hireDate','status','createdAt','updatedAt'];
    sheetsData['Employees'] = { headers: empHeaders, rows: persistedData.employees || [] };
    var siHeaders = ['id','grnNumber','receiptDate','itemId','itemCode','itemName','quantity','unit','batchId','dom','bbd','expiryDate','supplier','warehouseLocation','purchaseOrder','referenceNumber','remarks','createdBy','createdAt'];
    sheetsData['StockIn'] = { headers: siHeaders, rows: persistedData.stockInRecords || [] };
    var soHeaders = ['id','issueNumber','issueDate','employeeId','employeeName','department','itemId','itemCode','itemName','quantity','batchId','jobNumber','remarks','createdBy','createdAt'];
    sheetsData['StockOut'] = { headers: soHeaders, rows: persistedData.stockOutRecords || [] };
    var blHeaders = ['id','batchId','itemId','itemCode','itemName','dom','bbd','expiryDate','quantityIn','quantityOut','balance','status','createdAt','updatedAt'];
    sheetsData['BatchLedger'] = { headers: blHeaders, rows: persistedData.batchLedger || [] };
    var jobHeaders = ['id','jobNumber','jobName','description','status','startDate','endDate','createdAt','updatedAt'];
    sheetsData['Jobs'] = { headers: jobHeaders, rows: persistedData.jobs || [] };
    var qmHeaders = ['id','code','itemName','description','category','unit','reason','source','receivedDate','quarantineDate','releaseDate','quantityIn','quantityOut','balance','location','status','inspector','inspectionResult','issuedTo','issuedDate','remarks','createdBy','createdAt','updatedAt'];
    sheetsData['QuarantineMaterials'] = { headers: qmHeaders, rows: persistedData.quarantineMaterials || [] };
    var cmHeaders = ['id','code','itemName','description','category','unit','clientName','projectNumber','receivedDate','expectedReturnDate','quantityIn','quantityOut','balance','location','status','issuedTo','issuedDate','remarks','createdBy','createdAt','updatedAt'];
    sheetsData['ClientMaterials'] = { headers: cmHeaders, rows: persistedData.clientMaterials || [] };
    var jmHeaders = ['id','code','itemName','category','quantity','jobNumber','jobName','status','issuedTo','issuedDate','remarks','createdBy','createdAt','updatedAt'];
    sheetsData['JobMaterials'] = { headers: jmHeaders, rows: persistedData.jobMaterials || [] };
    var ibHeaders = ['id','itemId','itemCode','itemName','totalQuantity','availableQuantity','reservedQuantity','lastUpdated'];
    sheetsData['InventoryBalances'] = { headers: ibHeaders, rows: persistedData.inventoryBalances || [] };

    var payload = JSON.stringify({ action: 'saveAll', sheets: sheetsData });
    var url = GOOGLE_SHEET_URL;
    if (!url.endsWith('/exec') && !url.endsWith('/dev')) url = url + '/exec';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      redirect: 'follow',
    }).then(function() { console.log('Synced to Google Sheet'); })
      .catch(function(e) { console.error('Google Sheet sync error:', e.message); });
  } catch(e) { console.error('Google Sheet sync error:', e.message); }
}

var lastSyncTime = 0;
function syncToGoogleSheetDebounced() {
  var now = Date.now();
  if (now - lastSyncTime < 10000) return;
  lastSyncTime = now;
  setTimeout(syncToGoogleSheet, 1000);
}

function pullFromGoogleSheet(callback) {
  if (!GOOGLE_SHEET_URL) { callback(false); return; }
  console.log('Pulling data from Google Sheet...');
  var url = GOOGLE_SHEET_URL;
  if (!url.endsWith('/exec') && !url.endsWith('/dev')) url = url + '/exec';
  console.log('Google Sheet URL: ' + url);
  
  var controller = new AbortController();
  var timeout = setTimeout(function() { controller.abort(); }, 30000);
  
  fetch(url + '?action=getAll', { redirect: 'follow', signal: controller.signal })
    .then(function(r) { clearTimeout(timeout); return r.text(); })
    .then(function(text) {
      try {
        var data = JSON.parse(text);
      } catch(e) {
        console.error('Google Sheet pull FAILED: Response is HTML, not JSON.');
        console.error('First 200 chars: ' + text.substring(0, 200));
        callback(false);
        return;
      }
      if (data.error) { console.error('Google Sheet pull error:', data.error); callback(false); return; }
      
      function mergeArrays(serverArr, sheetArr, timeKey) {
        if (sheetArr === undefined || sheetArr === null) return serverArr || [];
        if (sheetArr.length === 0) return serverArr || [];
        if (!serverArr || serverArr.length === 0) return sheetArr;
        var sMap = {};
        for (var i = 0; i < serverArr.length; i++) {
          var id = serverArr[i].id;
          var existing = sMap[id];
          if (!existing) {
            sMap[id] = serverArr[i];
          } else {
            var t1 = new Date(existing[timeKey] || existing.createdAt || 0).getTime();
            var t2 = new Date(serverArr[i][timeKey] || serverArr[i].createdAt || 0).getTime();
            if (t2 > t1) sMap[id] = serverArr[i];
          }
        }
        var cMap = {};
        for (var i = 0; i < sheetArr.length; i++) {
          var id = sheetArr[i].id;
          var existing = cMap[id];
          if (!existing) {
            cMap[id] = sheetArr[i];
          } else {
            var t1 = new Date(existing[timeKey] || existing.createdAt || 0).getTime();
            var t2 = new Date(sheetArr[i][timeKey] || sheetArr[i].createdAt || 0).getTime();
            if (t2 > t1) cMap[id] = sheetArr[i];
          }
        }
        var merged = {};
        for (var id in sMap) {
          merged[id] = sMap[id];
        }
        for (var id in cMap) {
          if (!merged[id]) merged[id] = cMap[id];
        }
        return Object.values(merged);
      }

      var changed = false;
      var newMasterItems = mergeArrays(persistedData.masterItems, data.MasterItems, 'updatedAt');
      if (newMasterItems !== persistedData.masterItems) { persistedData.masterItems = newMasterItems; changed = true; }
      var newEmployees = mergeArrays(persistedData.employees, data.Employees, 'updatedAt');
      if (newEmployees !== persistedData.employees) { persistedData.employees = newEmployees; changed = true; }
      var newStockIn = mergeArrays(persistedData.stockInRecords, data.StockIn, 'createdAt');
      if (newStockIn !== persistedData.stockInRecords) { persistedData.stockInRecords = newStockIn; changed = true; }
      var newStockOut = mergeArrays(persistedData.stockOutRecords, data.StockOut, 'createdAt');
      if (newStockOut !== persistedData.stockOutRecords) { persistedData.stockOutRecords = newStockOut; changed = true; }
      var newBatchLedger = mergeArrays(persistedData.batchLedger, data.BatchLedger, 'updatedAt');
      if (newBatchLedger !== persistedData.batchLedger) { persistedData.batchLedger = newBatchLedger; changed = true; }
      var newInvBal = mergeArrays(persistedData.inventoryBalances, data.InventoryBalances, 'lastUpdated');
      if (newInvBal !== persistedData.inventoryBalances) { persistedData.inventoryBalances = newInvBal; changed = true; }
      var newJobs = mergeArrays(persistedData.jobs, data.Jobs, 'updatedAt');
      if (newJobs !== persistedData.jobs) { persistedData.jobs = newJobs; changed = true; }
      var newUsers = mergeArrays(persistedData.users, data.Users, 'createdAt');
      if (newUsers !== persistedData.users) { persistedData.users = newUsers; changed = true; }
      var newQM = mergeArrays(persistedData.quarantineMaterials, data.QuarantineMaterials, 'updatedAt');
      if (newQM !== persistedData.quarantineMaterials) { persistedData.quarantineMaterials = newQM; changed = true; }
      var newCM = mergeArrays(persistedData.clientMaterials, data.ClientMaterials, 'updatedAt');
      if (newCM !== persistedData.clientMaterials) { persistedData.clientMaterials = newCM; changed = true; }
      var newJM = mergeArrays(persistedData.jobMaterials, data.JobMaterials, 'updatedAt');
      if (newJM !== persistedData.jobMaterials) { persistedData.jobMaterials = newJM; changed = true; }
      if (data.AuditTrail && data.AuditTrail.length > 0) {
        persistedData.auditTrail = data.AuditTrail;
        changed = true;
      }
      if (data.Dashboard && data.Dashboard.length > 0) { changed = true; }
      if (changed) {
        saveData();
        console.log('Data merged from Google Sheet');
      }
      callback(changed);
    })
    .catch(function(e) {
      clearTimeout(timeout);
      console.error('Google Sheet pull error:', e.message);
      callback(false);
    });
}

let emailTransporter = null;
let alertEmailAddress = persistedData.alertEmailAddress || '';
let savedEmailPassword = persistedData.alertEmailPassword || '';

function setupEmailTransporter(email, appPassword) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: appPassword },
  });
  alertEmailAddress = email;
  savedEmailPassword = appPassword;
  persistedData.alertEmailAddress = email;
  persistedData.alertEmailPassword = appPassword;
  saveData();
}

if (alertEmailAddress && savedEmailPassword) {
  try {
    setupEmailTransporter(alertEmailAddress, savedEmailPassword);
  } catch (e) { console.error('Failed to restore email config:', e.message); }
}

const users = [
  { id: '0', username: 'yousif', password: hashPassword('98765'), role: 'Administrator', fullName: 'Yousif' },
  { id: '1', username: 'admin', password: hashPassword('admin123'), role: 'Administrator', fullName: 'System Admin' },
  { id: '2', username: 'manager', password: hashPassword('manager123'), role: 'Warehouse Manager', fullName: 'Warehouse Manager' },
  { id: '3', username: 'supervisor', password: hashPassword('super123'), role: 'Warehouse Supervisor', fullName: 'Warehouse Supervisor' },
  { id: '4', username: 'storekeeper', password: hashPassword('store123'), role: 'Storekeeper', fullName: 'Store Keeper' },
  { id: '5', username: 'viewer', password: hashPassword('view123'), role: 'Viewer', fullName: 'Read Only User' },
];

const sessions = {};

const SESSION_TTL = 8 * 60 * 60 * 1000;

const loginAttempts = {};
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000;

setInterval(function() {
  var now = Date.now();
  for (var token in sessions) {
    if (now - sessions[token].createdAt > SESSION_TTL) delete sessions[token];
  }
  for (var key in loginAttempts) {
    if (now - loginAttempts[key].lastAttempt > LOCKOUT_TIME * 2) delete loginAttempts[key];
  }
}, 60 * 60 * 1000);

function hashPassword(pw) {
  return bcrypt.hashSync(pw, 10);
}

function verifyPassword(pw, hash) {
  return bcrypt.compareSync(pw, hash);
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.replace('Bearer ', '');
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (Date.now() - sessions[token].createdAt > SESSION_TTL) {
    delete sessions[token];
    return res.status(401).json({ error: 'Session expired' });
  }
  req.user = sessions[token];
  next();
}

app.post('/api/logout', authMiddleware, function(req, res) {
  const token = req.headers.authorization.replace('Bearer ', '');
  delete sessions[token];
  res.json({ ok: true });
});

app.get('/api/sse', function(req, res) {
  var token = req.query.token;
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('data: connected\n\n');
  var clientId = ++sseClientIdCounter;
  sseClients.push({ id: clientId, res: res });
  req.on('close', function() {
    sseClients = sseClients.filter(function(c) { return c.id !== clientId; });
  });
});

app.get('/api/me', authMiddleware, function(req, res) {
  res.json(req.user);
});

app.get('/api/users', authMiddleware, function(req, res) {
  if (req.user.role !== 'Administrator') return res.status(403).json({ error: 'Forbidden' });
  res.json({ users: users.map(function(u) { return { id: u.id, username: u.username, role: u.role, fullName: u.fullName }; }).concat(extraUsers.map(function(u) { return { id: u.id, username: u.username, role: u.role, fullName: u.fullName }; })) });
});

app.post('/api/users', authMiddleware, function(req, res) {
  if (req.user.role !== 'Administrator') return res.status(403).json({ error: 'Forbidden' });
  var body = req.body;
  var username = String(body.username || '').trim();
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(username)) return res.status(400).json({ error: 'Username must be 3-30 alphanumeric/underscore characters' });
  if (users.find(function(u) { return u.username === username; })) return res.status(400).json({ error: 'Username exists' });
  if (extraUsers.find(function(u) { return u.username === username; })) return res.status(400).json({ error: 'Username exists' });
  var newUser = { id: String(Date.now()), username: username, password: hashPassword(body.password || username), role: body.role, fullName: String(body.fullName || username).slice(0, 100) };
  extraUsers.push(newUser);
  saveData();
  res.json({ id: newUser.id, username: username, role: body.role, fullName: newUser.fullName });
});

app.put('/api/users/:id', authMiddleware, function(req, res) {
  if (req.user.role !== 'Administrator') return res.status(403).json({ error: 'Forbidden' });
  var id = req.params.id;
  var body = req.body;
  var idx = users.findIndex(function(u) { return u.id === id; });
  var eidx = extraUsers.findIndex(function(u) { return u.id === id; });
  if (idx !== -1) return res.status(400).json({ error: 'Cannot modify built-in users' });
  if (eidx !== -1) {
    if (body.username) extraUsers[eidx].username = String(body.username).trim().slice(0, 30);
    if (body.password) extraUsers[eidx].password = hashPassword(body.password);
    if (body.role) extraUsers[eidx].role = body.role;
    if (body.fullName) extraUsers[eidx].fullName = String(body.fullName).slice(0, 100);
  }
  if (idx === -1 && eidx === -1) return res.status(404).json({ error: 'User not found' });
  saveData();
  res.json({ ok: true });
});

app.delete('/api/users/:id', authMiddleware, function(req, res) {
  if (req.user.role !== 'Administrator') return res.status(403).json({ error: 'Forbidden' });
  var id = req.params.id;
  var idx = users.findIndex(function(u) { return u.id === id; });
  var eidx = extraUsers.findIndex(function(u) { return u.id === id; });
  if (idx !== -1) return res.status(400).json({ error: 'Cannot delete built-in users' });
  if (eidx === -1) return res.status(404).json({ error: 'User not found' });
  extraUsers.splice(eidx, 1);
  saveData();
  res.json({ ok: true });
});

app.get('/api/sessions', authMiddleware, function(req, res) {
  if (req.user.role !== 'Administrator') return res.status(403).json({ error: 'Forbidden' });
  var active = [];
  for (var token in sessions) {
    active.push({ username: sessions[token].username, role: sessions[token].role, fullName: sessions[token].fullName, tokenPreview: token.substring(0, 8) + '...' });
  }
  res.json(active);
});

app.post('/api/email-config', authMiddleware, function(req, res) {
  if (req.user.role !== 'Administrator') return res.status(403).json({ error: 'Forbidden' });
  var body = req.body;
  if (!body.email || !body.appPassword) return res.status(400).json({ error: 'Email and app password required' });
  try {
    setupEmailTransporter(body.email, body.appPassword);
    emailTransporter.verify(function(err) {
      if (err) return res.status(400).json({ error: 'Invalid email credentials: ' + err.message });
      res.json({ ok: true, message: 'Email configured successfully' });
    });
  } catch (e) {
    res.status(400).json({ error: 'Failed to setup email: ' + e.message });
  }
});

app.post('/api/send-alert-email', authMiddleware, function(req, res) {
  if (!emailTransporter) return res.json({ ok: false, message: 'Email not configured' });
  var body = req.body;
  var alerts = body.alerts || [];
  if (alerts.length === 0) return res.json({ ok: true });

  var htmlContent = '<h2>WMS Stock Alerts</h2>';
  alerts.forEach(function(alert) {
    var color = alert.severity === 'critical' ? '#dc2626' : alert.severity === 'warning' ? '#f59e0b' : '#3b82f6';
    htmlContent += '<div style="border-left:4px solid ' + color + ';padding:12px;margin:8px 0;background:#f9fafb;border-radius:4px;">';
    htmlContent += '<h3 style="margin:0 0 4px 0;color:' + color + ';">' + alert.title + '</h3>';
    htmlContent += '<p style="margin:0;color:#374151;">' + alert.message + '</p>';
    htmlContent += '<p style="margin:4px 0 0 0;color:#9ca3af;font-size:12px;">Current Qty: ' + alert.currentQty + ' | Reorder Level: ' + alert.reorderLevel + '</p>';
    htmlContent += '</div>';
  });
  htmlContent += '<p style="color:#9ca3af;font-size:11px;margin-top:16px;">WMS Enterprise - Warehouse Management System</p>';

  var mailOptions = {
    from: 'WMS Alerts <' + alertEmailAddress + '>',
    to: body.email || alertEmailAddress,
    subject: 'WMS Alert: ' + alerts[0].title,
    html: htmlContent,
  };

  emailTransporter.sendMail(mailOptions, function(err) {
    if (err) return res.status(500).json({ error: 'Failed to send email: ' + err.message });
    res.json({ ok: true, message: 'Alert email sent' });
  });
});

app.get('/api/email-status', authMiddleware, function(req, res) {
  res.json({ configured: !!emailTransporter, email: alertEmailAddress || '' });
});

app.post('/api/public/sync-data', authMiddleware, function(req, res) {
  var body = req.body;
  publicItems = (body.items || []).map(function(item) {
    return {
      id: item.id, itemCode: item.itemCode, itemName: item.itemName,
      unit: item.unitOfMeasure, trackerGroup: item.trackerGroup || '',
      availableQty: item._availableQty || 0, status: item.status
    };
  }).filter(function(i) { return i.status === 'Active'; });
  publicEmployees = (body.employees || []).map(function(emp) {
    return { id: emp.id, employeeName: emp.employeeName, department: emp.department, status: emp.status };
  }).filter(function(e) { return e.status === 'Active'; });
  publicJobs = (body.jobs || []).filter(function(j) { return j.status === 'Active'; });
  saveData();
  res.json({ ok: true, items: publicItems.length, employees: publicEmployees.length });
});

// Full sync - GET: server sends ALL data to client
app.get('/api/full-sync', authMiddleware, function(req, res) {
  var deletedSet = new Set(persistedData.deletedIds || []);
  function filterDeleted(arr) {
    return (arr || []).filter(function(item) { return !deletedSet.has(item.id); });
  }
  res.json({
    masterItems: filterDeleted(persistedData.masterItems || []).slice().sort(function(a, b) { if (a.category !== b.category) return a.category.localeCompare(b.category); return (a.itemCode || '').localeCompare(b.itemCode || ''); }),
    employees: filterDeleted(persistedData.employees),
    categories: persistedData.categories || ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality'],
    stockInRecords: filterDeleted(persistedData.stockInRecords),
    stockOutRecords: filterDeleted(persistedData.stockOutRecords),
    batchLedger: filterDeleted(persistedData.batchLedger),
    inventoryBalances: filterDeleted(persistedData.inventoryBalances),
    jobs: filterDeleted(persistedData.jobs),
    users: persistedData.users || [],
    stockAdjustments: filterDeleted(persistedData.stockAdjustments),
    auditTrail: persistedData.auditTrail || [],
    quarantineMaterials: persistedData.quarantineMaterials || [],
    clientMaterials: persistedData.clientMaterials || [],
    jobMaterials: persistedData.jobMaterials || [],
    alertEmail: persistedData.alertEmail || '',
    batchSequence: persistedData.batchSequence || 1,
    grnSequence: persistedData.grnSequence || 1,
    issueSequence: persistedData.issueSequence || 1,
    adjustmentSequence: persistedData.adjustmentSequence || 1,
    deletedIds: persistedData.deletedIds || [],
    publicEmployees: persistedData.publicEmployees || [],
    extraUsers: persistedData.extraUsers || [],
  });
});

// Full sync - POST: client sends ALL data to server
app.post('/api/full-sync', authMiddleware, function(req, res) {
  var body = req.body;
  var clientDeleted = body.deletedIds || [];
  var serverDeleted = persistedData.deletedIds || [];
  var mergedDeleted = Array.from(new Set(serverDeleted.concat(clientDeleted)));

  function filterDeleted(arr) {
    return (arr || []).filter(function(item) { return mergedDeleted.indexOf(item.id) === -1; });
  }

  function mergeById(serverArr, clientArr) {
    var map = {};
    (serverArr || []).forEach(function(item) {
      if (mergedDeleted.indexOf(item.id) === -1) map[item.id] = item;
    });
    (clientArr || []).forEach(function(item) {
      if (mergedDeleted.indexOf(item.id) !== -1) return;
      var existing = map[item.id];
      if (!existing) {
        map[item.id] = item;
      } else if (item.updatedAt && existing.updatedAt && item.updatedAt > existing.updatedAt) {
        map[item.id] = item;
      }
    });
    return Object.values(map);
  }

  function mergeByField(serverArr, clientArr, field) {
    var map = {};
    (serverArr || []).forEach(function(item) {
      if (mergedDeleted.indexOf(item.id) === -1) map[item[field]] = item;
    });
    (clientArr || []).forEach(function(item) {
      if (mergedDeleted.indexOf(item.id) !== -1) return;
      var key = item[field];
      var existing = map[key];
      if (!existing) {
        map[key] = item;
      } else if (item.updatedAt && existing.updatedAt && item.updatedAt > existing.updatedAt) {
        map[key] = item;
      } else if (!existing.updatedAt && !item.updatedAt && item.createdAt && existing.createdAt && item.createdAt > existing.createdAt) {
        map[key] = item;
      }
    });
    return Object.values(map);
  }

  persistedData.masterItems = mergeById(persistedData.masterItems, body.masterItems);
  persistedData.employees = mergeById(persistedData.employees, body.employees);
  persistedData.categories = body.categories || persistedData.categories || ['PPE', 'Chemical', 'Spare Parts', 'Lubricant', 'Consumable', 'Stationery', 'Quality'];
  persistedData.stockInRecords = mergeByField(persistedData.stockInRecords, body.stockInRecords, 'grnNumber');
  persistedData.stockOutRecords = mergeByField(persistedData.stockOutRecords, body.stockOutRecords, 'issueNumber');
  persistedData.batchLedger = mergeByField(persistedData.batchLedger, body.batchLedger, 'batchId');
  persistedData.inventoryBalances = mergeById(persistedData.inventoryBalances, body.inventoryBalances);
  persistedData.jobs = mergeById(persistedData.jobs, body.jobs);
  persistedData.users = body.users || [];
  persistedData.stockAdjustments = mergeByField(persistedData.stockAdjustments, body.stockAdjustments, 'adjustmentNumber');
  persistedData.auditTrail = body.auditTrail || [];
  if (body.quarantineMaterials && body.quarantineMaterials.length > 0) persistedData.quarantineMaterials = body.quarantineMaterials;
  if (body.clientMaterials && body.clientMaterials.length > 0) persistedData.clientMaterials = body.clientMaterials;
  if (body.jobMaterials && body.jobMaterials.length > 0) persistedData.jobMaterials = body.jobMaterials;
  persistedData.alertEmail = body.alertEmail || '';
  persistedData.batchSequence = Math.max(persistedData.batchSequence || 1, body.batchSequence || 1);
  persistedData.grnSequence = Math.max(persistedData.grnSequence || 1, body.grnSequence || 1);
  persistedData.issueSequence = Math.max(persistedData.issueSequence || 1, body.issueSequence || 1);
  persistedData.adjustmentSequence = Math.max(persistedData.adjustmentSequence || 1, body.adjustmentSequence || 1);
  persistedData.deletedIds = mergedDeleted;
  var clientUsers = body.extraUsers || [];
  var serverUserMap = {};
  extraUsers.forEach(function(u) { serverUserMap[u.id] = u; });
  clientUsers.forEach(function(u) { if (!serverUserMap[u.id]) serverUserMap[u.id] = u; });
  extraUsers = Object.values(serverUserMap);
  persistedData.extraUsers = extraUsers;
  saveData();
  syncToGoogleSheetDebounced();
  res.json({ ok: true });
});

app.get('/api/public/stock-data', function(req, res) {
  var storedItems = (persistedData.masterItems || []).filter(Boolean);
  var storedEmps = (persistedData.employees || []).filter(Boolean);
  var storedJobs = (persistedData.jobs || []).filter(Boolean);
  var storedBatches = (persistedData.batchLedger || []).filter(Boolean);

  var items = storedItems.filter(function(i) { return i.status === 'Active'; }).map(function(item) {
    var balance = storedBatches.filter(function(b) { return b.itemId === item.id; }).reduce(function(s, b) { return s + b.balance; }, 0);
    return { id: item.id, itemCode: item.itemCode, itemName: item.itemName, unit: item.unitOfMeasure, trackerGroup: item.trackerGroup || '', availableQty: balance };
  });

  if (items.length === 0 && publicItems.length > 0) items = publicItems.filter(function(i) { return i.status !== 'Archived'; });

  var emps = storedEmps.filter(function(e) { return e.status === 'Active'; }).map(function(e) {
    return { id: e.id, employeeName: e.employeeName, department: e.department };
  });
  if (emps.length === 0 && publicEmployees.length > 0) emps = publicEmployees.filter(function(e) { return e.status !== 'Archived'; });

  var jobs = storedJobs.filter(function(j) { return j.status === 'Active'; });
  if (jobs.length === 0 && publicJobs.length > 0) jobs = publicJobs;

  res.json({ items: items, employees: emps, jobs: jobs });
});

app.post('/api/public/sync-users', authMiddleware, function(req, res) {
  var body = req.body;
  extraUsers = (body.users || []).map(function(u) {
    return {
      id: u.id,
      username: u.username,
      password: u._rawPassword ? hashPassword(u._rawPassword) : null,
      role: u.role,
      fullName: u.fullName || u.username,
    };
  });
  saveData();
  res.json({ ok: true, count: extraUsers.length });
});

app.post('/api/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  var clientIP = req.ip || req.connection.remoteAddress || 'unknown';

  var attemptKey = username + ':' + clientIP;
  var attempt = loginAttempts[attemptKey];
  if (attempt && attempt.count >= MAX_ATTEMPTS && Date.now() - attempt.lastAttempt < LOCKOUT_TIME) {
    var waitMin = Math.ceil((LOCKOUT_TIME - (Date.now() - attempt.lastAttempt)) / 60000);
    return res.status(429).json({ error: 'Too many attempts. Try again in ' + waitMin + ' minutes.' });
  }

  var user = users.find(function(u) { return u.username === username && verifyPassword(password, u.password); });
  if (!user) {
    user = extraUsers.find(function(u) { return u.username === username && u.password && verifyPassword(password, u.password); });
  }
  if (!user) {
    if (!loginAttempts[attemptKey]) loginAttempts[attemptKey] = { count: 0, lastAttempt: 0 };
    loginAttempts[attemptKey].count++;
    loginAttempts[attemptKey].lastAttempt = Date.now();
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  delete loginAttempts[attemptKey];
  var token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { id: user.id, username: user.username, role: user.role, fullName: user.fullName, createdAt: Date.now() };

  res.json({ token: token, user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName } });
});

var publicStockOutLock = false;
app.post('/api/public/stock-out', function(req, res) {
  if (publicStockOutLock) return res.status(429).json({ error: 'Server busy, try again' });
  publicStockOutLock = true;
  var body = req.body;
  if (!body.employeeName || !body.itemId || !body.quantity) {
    publicStockOutLock = false;
    return res.status(400).json({ error: 'All required fields must be filled' });
  }

  var storedItems = (persistedData.masterItems || []).filter(function(i) { return i.status === 'Active'; });
  var storedBatches = persistedData.batchLedger || [];

  var item = storedItems.find(function(i) { return i.id === body.itemId; });
  if (!item) item = publicItems.find(function(i) { return i.id === body.itemId; });
  if (!item) { publicStockOutLock = false; return res.status(400).json({ error: 'Item not found' }); }
  if (body.quantity <= 0) { publicStockOutLock = false; return res.status(400).json({ error: 'Quantity must be greater than 0' }); }

  var availableQty = storedBatches.filter(function(b) { return b.itemId === item.id; }).reduce(function(s, b) { return s + b.balance; }, 0);
  if (availableQty === 0) {
    var fallback = publicItems.find(function(i) { return i.id === body.itemId; });
    if (fallback) availableQty = fallback.availableQty;
  }
  if (body.quantity > availableQty) { publicStockOutLock = false; return res.status(400).json({ error: 'Insufficient stock. Available: ' + availableQty }); }

  requestSequence++;
  var request = {
    id: String(requestSequence),
    requestNumber: 'REQ-' + requestSequence,
    employeeName: body.employeeName,
    department: body.department || '',
    itemId: body.itemId,
    itemCode: item.itemCode,
    itemName: item.itemName,
    trackerGroup: item.trackerGroup || '',
    quantity: body.quantity,
    unit: item.unitOfMeasure || item.unit || '',
    jobNumber: body.jobNumber || '',
    remarks: body.remarks || '',
    status: 'Pending',
    createdAt: new Date().toISOString()
  };
  pendingRequests.push(request);
  saveData();
  publicStockOutLock = false;
  console.log('New stock out request: ' + request.requestNumber + ' from ' + body.employeeName + ' for ' + item.itemName);
  res.json({ ok: true, requestNumber: request.requestNumber });
});

app.get('/api/pending-requests', authMiddleware, function(req, res) {
  res.json(pendingRequests);
});

app.get('/api/server/stockout-records', authMiddleware, function(req, res) {
  res.json(serverStockOutRecords);
});

app.post('/api/server/backfill-stockout', authMiddleware, function(req, res) {
  var backfilled = 0;
  var approvedRequests = pendingRequests.filter(function(r) { return r.status === 'Approved'; });
  for (var i = 0; i < approvedRequests.length; i++) {
    var ar = approvedRequests[i];
    var exists = serverStockOutRecords.some(function(s) { return s.requestNumber === ar.requestNumber; });
    if (!exists) {
      stockOutSequence++;
      var issueNumber = 'ISU-' + String(stockOutSequence).padStart(4, '0');
      var now = ar.approvedAt || new Date().toISOString();
      serverStockOutRecords.push({
        id: String(Date.now()) + '-' + stockOutSequence,
        issueNumber: issueNumber,
        issueDate: now.split('T')[0],
        employeeId: '',
        employeeName: ar.employeeName,
        department: ar.department || '',
        itemId: ar.itemId,
        itemCode: ar.itemCode,
        itemName: ar.itemName,
        quantity: ar.quantity,
        batchId: 'FORM-' + ar.requestNumber,
        jobNumber: ar.jobNumber || '',
        remarks: 'Form Request: ' + ar.requestNumber + '. ' + (ar.remarks || ''),
        createdBy: ar.approvedBy || 'System',
        createdAt: now,
        source: 'Form Request',
      });
      backfilled++;
    }
  }
  if (backfilled > 0) {
    saveData();
  }
  res.json({ ok: true, backfilled: backfilled });
});

app.post('/api/pending-requests/:id/approve', authMiddleware, function(req, res) {
  var id = req.params.id;
  var idx = pendingRequests.findIndex(function(r) { return r.id === id; });
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });
  pendingRequests[idx].status = 'Approved';
  pendingRequests[idx].approvedBy = req.user.fullName;
  pendingRequests[idx].approvedAt = new Date().toISOString();
  var approvedReq = pendingRequests[idx];
  var pItem = publicItems.find(function(i) { return i.id === approvedReq.itemId || i.itemCode === approvedReq.itemCode; });
  if (pItem) {
    pItem.availableQty = Math.max(0, pItem.availableQty - approvedReq.quantity);
  }
  var batches = (persistedData.batchLedger || []).filter(function(b) { return b.itemId === approvedReq.itemId && b.balance > 0; });
  var remaining = approvedReq.quantity;
  for (var bi = 0; bi < batches.length && remaining > 0; bi++) {
    var batch = batches[bi];
    var deduct = Math.min(batch.balance, remaining);
    batch.quantityOut = (batch.quantityOut || 0) + deduct;
    batch.balance = batch.balance - deduct;
    batch.updatedAt = new Date().toISOString();
    remaining -= deduct;
  }
  var inv = (persistedData.inventoryBalances || []).find(function(b) { return b.itemId === approvedReq.itemId; });
  if (inv) {
    inv.totalQuantity = Math.max(0, inv.totalQuantity - approvedReq.quantity);
    inv.availableQuantity = Math.max(0, inv.availableQuantity - approvedReq.quantity);
    inv.lastUpdated = new Date().toISOString();
  }
  stockOutSequence++;
  var issueNumber = 'ISU-' + String(stockOutSequence).padStart(4, '0');
  var now = new Date().toISOString();
  var stockOutRecord = {
    id: String(Date.now()),
    issueNumber: issueNumber,
    issueDate: now.split('T')[0],
    employeeId: '',
    employeeName: approvedReq.employeeName,
    department: approvedReq.department || '',
    itemId: approvedReq.itemId,
    itemCode: approvedReq.itemCode,
    itemName: approvedReq.itemName,
    quantity: approvedReq.quantity,
    batchId: 'FORM-' + approvedReq.requestNumber,
    jobNumber: approvedReq.jobNumber || '',
    remarks: 'Form Request: ' + approvedReq.requestNumber + '. ' + (approvedReq.remarks || ''),
    createdBy: req.user.fullName,
    createdAt: now,
    source: 'Form Request',
    requestNumber: approvedReq.requestNumber,
  };
  serverStockOutRecords.push(stockOutRecord);

  if (!persistedData.stockOutRecords) persistedData.stockOutRecords = [];
  persistedData.stockOutRecords.push(stockOutRecord);

  var itemBatches = (persistedData.batchLedger || []).filter(function(b) { return b.itemId === approvedReq.itemId && b.balance > 0; });
  var remaining = approvedReq.quantity;
  for (var bi = 0; bi < itemBatches.length && remaining > 0; bi++) {
    var batch = itemBatches[bi];
    var deduct = Math.min(batch.balance, remaining);
    batch.balance -= deduct;
    batch.quantityOut += deduct;
    batch.updatedAt = now;
    remaining -= deduct;
  }

  var invBalance = (persistedData.inventoryBalances || []).find(function(b) { return b.itemId === approvedReq.itemId; });
  if (invBalance) {
    invBalance.totalQuantity = Math.max(0, invBalance.totalQuantity - approvedReq.quantity);
    invBalance.availableQuantity = Math.max(0, invBalance.availableQuantity - approvedReq.quantity);
    invBalance.lastUpdated = now;
  }

  saveData();
  res.json({ ok: true, request: pendingRequests[idx], stockOut: stockOutRecord });
});

app.post('/api/pending-requests/:id/reject', authMiddleware, function(req, res) {
  var id = req.params.id;
  var idx = pendingRequests.findIndex(function(r) { return r.id === id; });
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });
  pendingRequests[idx].status = 'Rejected';
  pendingRequests[idx].rejectedBy = req.user.fullName;
  pendingRequests[idx].rejectedAt = new Date().toISOString();
  saveData();
  res.json({ ok: true, request: pendingRequests[idx] });
});

app.use(express.static(path.join(__dirname, 'dist')));

app.post('/api/import-csv-data', authMiddleware, function(req, res) {
  var body = req.body;
  var imported = {};
  if (body.masterItems && Array.isArray(body.masterItems)) {
    persistedData.masterItems = body.masterItems;
    imported.masterItems = body.masterItems.length;
  }
  if (body.employees && Array.isArray(body.employees)) {
    persistedData.employees = body.employees;
    imported.employees = body.employees.length;
  }
  if (body.stockInRecords && Array.isArray(body.stockInRecords)) {
    persistedData.stockInRecords = body.stockInRecords;
    imported.stockInRecords = body.stockInRecords.length;
  }
  if (body.stockOutRecords && Array.isArray(body.stockOutRecords)) {
    persistedData.stockOutRecords = body.stockOutRecords;
    imported.stockOutRecords = body.stockOutRecords.length;
  }
  if (body.batchLedger && Array.isArray(body.batchLedger)) {
    persistedData.batchLedger = body.batchLedger;
    imported.batchLedger = body.batchLedger.length;
  }
  if (body.inventoryBalances && Array.isArray(body.inventoryBalances)) {
    persistedData.inventoryBalances = body.inventoryBalances;
    imported.inventoryBalances = body.inventoryBalances.length;
  }
  if (body.jobs && Array.isArray(body.jobs)) {
    persistedData.jobs = body.jobs;
    imported.jobs = body.jobs.length;
  }
  if (body.categories && Array.isArray(body.categories)) {
    persistedData.categories = body.categories;
    imported.categories = body.categories.length;
  }
  saveData();
  syncToGoogleSheetDebounced();
  console.log('Data imported:', JSON.stringify(imported));
  res.json({ ok: true, imported: imported });
});

app.get('/api/diag', function(req, res) {
  var url = GOOGLE_SHEET_URL || 'NOT SET';
  if (url !== 'NOT SET' && !url.endsWith('/exec')) url = url + '/exec';
  var checkUrl = url !== 'NOT SET' ? url + '?action=getAll' : null;
  
  if (!checkUrl) {
    return res.json({ 
      googleSheetUrl: 'NOT SET', 
      message: 'GOOGLE_SHEET_URL env var is not set on Render'
    });
  }
  
  var controller = new AbortController();
  var timeout = setTimeout(function() { controller.abort(); }, 15000);
  
  fetch(checkUrl, { redirect: 'follow', signal: controller.signal })
    .then(function(r) { clearTimeout(timeout); return r.text(); })
    .then(function(text) {
      var isJson = false;
      var parsed = null;
      try { parsed = JSON.parse(text); isJson = true; } catch(e) {}
      res.json({
        googleSheetUrl: GOOGLE_SHEET_URL,
        isJson: isJson,
        firstChars: text.substring(0, 200),
        sheetNames: isJson ? Object.keys(parsed) : [],
        counts: isJson ? Object.fromEntries(Object.entries(parsed).map(function([k,v]) { return [k, Array.isArray(v) ? v.length : 0]; })) : {},
        dataCount: isJson ? Object.values(parsed).reduce(function(a,b) { return a + (Array.isArray(b) ? b.length : 0); }, 0) : 0,
      });
    })
    .catch(function(e) {
      clearTimeout(timeout);
      res.json({ googleSheetUrl: GOOGLE_SHEET_URL, error: e.message });
    });
});

app.use(function(req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', function() {
  console.log('');
  console.log('='.repeat(50));
  console.log('  WMS Server running on port ' + PORT);
  console.log('='.repeat(50));
  if (GOOGLE_SHEET_URL) {
    console.log('  Google Sheet sync: ENABLED');
    pullFromGoogleSheet(function(changed) {
      if (changed) console.log('  Initial data loaded from Google Sheet');
      else console.log('  No data on Google Sheet, using local data');
    });
    setInterval(function() {
      pullFromGoogleSheet(function(changed) {
        if (changed) console.log('  Periodic pull: data updated from Google Sheet');
      });
    }, 60000);
    console.log('  Periodic pull: every 60 seconds');
  } else {
    console.log('  Google Sheet sync: DISABLED (set GOOGLE_SHEET_URL env)');
  }
});
