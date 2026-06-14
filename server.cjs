console.log('Starting WMS server...');
console.log('Node version:', process.version);
console.log('PORT:', process.env.PORT);

const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'wms-data.json');

app.use(cors());
app.use(express.json());

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch {}
  return null;
}

function saveData(data) {
  try {
    var full = Object.assign({
      extraUsers: extraUsers,
      publicEmployees: publicEmployees,
      publicItems: publicItems,
      publicJobs: publicJobs,
      pendingRequests: pendingRequests,
      serverStockOutRecords: serverStockOutRecords,
      stockOutSequence: stockOutSequence,
      requestSequence: requestSequence,
    }, data || {});
    fs.writeFileSync(DATA_FILE, JSON.stringify(full, null, 2));
  } catch {}
}

var persistedData = loadData() || { extraUsers: [] };

let emailTransporter = null;
let alertEmailAddress = '';

function setupEmailTransporter(email, appPassword) {
  emailTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: email, pass: appPassword },
  });
  alertEmailAddress = email;
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

function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw).digest('hex');
}

function authMiddleware(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.replace('Bearer ', '');
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = sessions[token];
  next();
}

app.post('/api/logout', authMiddleware, function(req, res) {
  const token = req.headers.authorization.replace('Bearer ', '');
  delete sessions[token];
  res.json({ ok: true });
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
  if (users.find(function(u) { return u.username === body.username; })) return res.status(400).json({ error: 'Username exists' });
  if (extraUsers.find(function(u) { return u.username === body.username; })) return res.status(400).json({ error: 'Username exists' });
  var newUser = { id: String(Date.now()), username: body.username, password: hashPassword(body.password || body.username), role: body.role, fullName: body.fullName || body.username };
  users.push(newUser);
  extraUsers.push(newUser);
  saveData();
  res.json({ id: newUser.id, username: body.username, role: body.role, fullName: newUser.fullName });
});

app.put('/api/users/:id', authMiddleware, function(req, res) {
  if (req.user.role !== 'Administrator') return res.status(403).json({ error: 'Forbidden' });
  var id = req.params.id;
  var body = req.body;
  var idx = users.findIndex(function(u) { return u.id === id; });
  var eidx = extraUsers.findIndex(function(u) { return u.id === id; });
  if (idx !== -1) {
    if (body.username) users[idx].username = body.username;
    if (body.password) users[idx].password = hashPassword(body.password);
    if (body.role) users[idx].role = body.role;
    if (body.fullName) users[idx].fullName = body.fullName;
  }
  if (eidx !== -1) {
    if (body.username) extraUsers[eidx].username = body.username;
    if (body.password) extraUsers[eidx].password = hashPassword(body.password);
    if (body.role) extraUsers[eidx].role = body.role;
    if (body.fullName) extraUsers[eidx].fullName = body.fullName;
  }
  if (idx === -1 && eidx === -1) return res.status(404).json({ error: 'User not found' });
  saveData();
  res.json({ ok: true });
});

app.delete('/api/users/:id', authMiddleware, function(req, res) {
  if (req.user.role !== 'Administrator') return res.status(403).json({ error: 'Forbidden' });
  var id = req.params.id;
  var idx = users.findIndex(function(u) { return u.id === id; });
  if (idx === -1) { var eidx = extraUsers.findIndex(function(u) { return u.id === id; }); if (eidx !== -1) { extraUsers.splice(eidx, 1); saveData(); } return res.status(404).json({ error: 'User not found' }); }
  users.splice(idx, 1);
  var eidx2 = extraUsers.findIndex(function(u) { return u.id === id; });
  if (eidx2 !== -1) extraUsers.splice(eidx2, 1);
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

var publicItems = persistedData.publicItems || [
  { id: '1', itemCode: 'PPE-GLV-001', itemName: 'Nitrile Gloves (L)', unit: 'Box', trackerGroup: 'PPE', availableQty: 200 },
  { id: '2', itemCode: 'PPE-MSK-002', itemName: 'N95 Respirator Mask', unit: 'Box', trackerGroup: 'PPE', availableQty: 150 },
  { id: '3', itemCode: 'PPE-EST-003', itemName: 'Safety Glasses', unit: 'Piece', trackerGroup: 'PPE', availableQty: 100 },
  { id: '4', itemCode: 'PPE-BOT-004', itemName: 'Steel Toe Boots', unit: 'Pair', trackerGroup: 'PPE', availableQty: 50 },
  { id: '5', itemCode: 'CHE-CLN-005', itemName: 'Industrial Cleaner 5L', unit: 'Drum', trackerGroup: '', availableQty: 40 },
  { id: '6', itemCode: 'SPR-BLT-006', itemName: 'M8 Hex Bolt M12x50', unit: 'Pack(100)', trackerGroup: '', availableQty: 80 },
  { id: '7', itemCode: 'PPE-HLM-007', itemName: 'Hard Hat (White)', unit: 'Piece', trackerGroup: 'PPE', availableQty: 75 },
  { id: '8', itemCode: 'PPE-HNS-008', itemName: 'Hi-Vis Safety Vest', unit: 'Piece', trackerGroup: 'PPE', availableQty: 90 },
  { id: '9', itemCode: 'LUB-GRS-009', itemName: 'Multi-Purpose Grease', unit: 'Bucket(20L)', trackerGroup: '', availableQty: 30 },
  { id: '10', itemCode: 'SPR-BRG-010', itemName: 'Ball Bearing 6205', unit: 'Piece', trackerGroup: '', availableQty: 60 },
  { id: '11', itemCode: 'STA-PEN-001', itemName: 'Blue Ballpoint Pen', unit: 'Pack(50)', trackerGroup: 'Stationery', availableQty: 45 },
  { id: '12', itemCode: 'STA-PPR-002', itemName: 'A4 Copy Paper (Ream)', unit: 'Ream', trackerGroup: 'Stationery', availableQty: 120 },
  { id: '13', itemCode: 'STA-TPE-003', itemName: 'Adhesive Tape Roll', unit: 'Piece', trackerGroup: 'Stationery', availableQty: 70 },
  { id: '14', itemCode: 'QC-FLT-001', itemName: 'Test Filter Kit', unit: 'Kit', trackerGroup: 'QC', availableQty: 25 },
  { id: '15', itemCode: 'QC-SMP-002', itemName: 'Sample Collection Bags', unit: 'Box(100)', trackerGroup: 'QC', availableQty: 50 },
];
var publicEmployees = persistedData.publicEmployees || [];
var publicJobs = persistedData.publicJobs || [];
var pendingRequests = persistedData.pendingRequests || [];
var requestSequence = persistedData.requestSequence || 1000;
var serverStockOutRecords = persistedData.serverStockOutRecords || [];
var stockOutSequence = persistedData.stockOutSequence || 0;

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

app.get('/api/public/stock-data', function(req, res) {
  res.json({ items: publicItems, employees: publicEmployees, jobs: publicJobs });
});

var extraUsers = persistedData.extraUsers || [];

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
  var user = users.find(function(u) { return u.username === username && u.password === hashPassword(password); });
  if (!user) {
    user = extraUsers.find(function(u) { return u.username === username && u.password && u.password === hashPassword(password); });
  }
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  var token = crypto.randomBytes(32).toString('hex');
  sessions[token] = { id: user.id, username: user.username, role: user.role, fullName: user.fullName };

  res.json({ token: token, user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName } });
});

app.post('/api/public/stock-out', function(req, res) {
  var body = req.body;
  if (!body.employeeName || !body.itemId || !body.quantity) {
    return res.status(400).json({ error: 'All required fields must be filled' });
  }
  var item = publicItems.find(function(i) { return i.id === body.itemId; });
  if (!item) return res.status(400).json({ error: 'Item not found' });
  if (body.quantity <= 0) return res.status(400).json({ error: 'Quantity must be greater than 0' });
  if (body.quantity > item.availableQty) return res.status(400).json({ error: 'Insufficient stock. Available: ' + item.availableQty });

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
    unit: item.unit,
    jobNumber: body.jobNumber || '',
    remarks: body.remarks || '',
    status: 'Pending',
    createdAt: new Date().toISOString()
  };
  pendingRequests.push(request);
  saveData();
  console.log('New stock out request: ' + request.requestNumber + ' from ' + body.employeeName + ' for ' + item.itemName);
  res.json({ ok: true, requestNumber: request.requestNumber });
});

app.get('/api/pending-requests', function(req, res) {
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

app.use(function(req, res) {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', function() {
  console.log('');
  console.log('='.repeat(50));
  console.log('  WMS Server running on port ' + PORT);
  console.log('='.repeat(50));
});
