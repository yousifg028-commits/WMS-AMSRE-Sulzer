const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs');

const PORT = 18765;
const serverApp = express();
serverApp.use(cors());
serverApp.use(express.json());

const DATA_DIR = path.join(app.getPath('userData'), 'wms-data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const defaultUsers = [
  { id: '1', username: 'yousif', password: '98765', role: 'Administrator', fullName: 'Yousif', status: 'Active' },
];

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch {}
  return [...defaultUsers];
}
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

let users = loadUsers();
let sessions = {};

serverApp.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const token = Math.random().toString(36).slice(2);
  sessions[token] = { userId: user.id, username: user.username, role: user.role };
  res.json({ token, user: { id: user.id, username: user.username, role: user.role, fullName: user.fullName } });
});

serverApp.get('/api/users', (req, res) => {
  res.json({ users: users.map(u => ({ id: u.id, username: u.username, role: u.role, fullName: u.fullName, status: u.status })) });
});

serverApp.post('/api/users', (req, res) => {
  const { username, password, role, fullName } = req.body;
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'Username exists' });
  const newUser = { id: String(Date.now()), username, password: password || username, role: role || 'Viewer', fullName: fullName || username, status: 'Active' };
  users.push(newUser);
  saveUsers(users);
  res.json({ user: { id: newUser.id, username: newUser.username, role: newUser.role } });
});

serverApp.put('/api/users/:id', (req, res) => {
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (req.body.username) user.username = req.body.username;
  if (req.body.password) user.password = req.body.password;
  if (req.body.role) user.role = req.body.role;
  if (req.body.fullName) user.fullName = req.body.fullName;
  saveUsers(users);
  res.json({ ok: true });
});

serverApp.delete('/api/users/:id', (req, res) => {
  users = users.filter(u => u.id !== req.params.id);
  saveUsers(users);
  res.json({ ok: true });
});

const DIST = path.join(__dirname, 'dist');
serverApp.use(express.static(DIST));
serverApp.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(DIST, 'index.html'));
});

let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'AMSER - Sulzer WMS',
    icon: path.join(__dirname, 'dist', 'favicon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  serverApp.listen(PORT, () => {
    console.log(`WMS Server running on port ${PORT}`);
    createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
