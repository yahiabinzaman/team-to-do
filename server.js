import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 4173;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial seed data if no store exists
const defaultData = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  employees: [
    {
      id: 'emp-1',
      name: 'Tanvir Ahmed',
      role: 'Lead UI/UX Designer',
      email: 'tanvir@studio.com',
      avatarColor: '#0A84FF', // Apple Blue
      avatarText: 'TA',
      active: true,
      todayClients: ['Acme Corp', 'Apex Tech'],
      createdAt: '2026-09-01T00:00:00Z'
    },
    {
      id: 'emp-2',
      name: 'Nusrat Jahan',
      role: 'Senior Full Stack Dev',
      email: 'nusrat@studio.com',
      avatarColor: '#30D158', // Apple Green
      avatarText: 'NJ',
      active: true,
      todayClients: ['CloudScale', 'FinHealth'],
      createdAt: '2026-09-01T00:00:00Z'
    },
    {
      id: 'emp-3',
      name: 'Rafiqul Islam',
      role: 'Motion & Brand Designer',
      email: 'rafiq@studio.com',
      avatarColor: '#FF9F0A', // Apple Orange
      avatarText: 'RI',
      active: true,
      todayClients: ['Apex Tech'],
      createdAt: '2026-09-01T00:00:00Z'
    },
    {
      id: 'emp-4',
      name: 'Sarah Khan',
      role: 'Project Manager & QA',
      email: 'sarah@studio.com',
      avatarColor: '#BF5AF2', // Apple Purple
      avatarText: 'SK',
      active: true,
      todayClients: ['Acme Corp', 'FinHealth'],
      createdAt: '2026-09-01T00:00:00Z'
    }
  ],
  tasks: [
    {
      id: 'task-1',
      title: 'Design Dashboard Glassmorphism UI Components',
      description: 'Create dark & light mode tokens and responsive widget cards.',
      employeeId: 'emp-1',
      client: 'Acme Corp',
      priority: 'high', // 'urgent', 'high', 'medium', 'low'
      status: 'in_progress', // 'todo', 'in_progress', 'review', 'done'
      dueDate: '2026-09-26',
      dueTime: '16:00',
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-2',
      title: 'Real-time WebSocket & Client Sync Architecture',
      description: 'Implement bi-directional event broadcast with offline caching.',
      employeeId: 'emp-2',
      client: 'CloudScale',
      priority: 'urgent',
      status: 'in_progress',
      dueDate: '2026-09-26',
      dueTime: '18:30',
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-3',
      title: 'Brand Hero Animation in Lottie & 3D Render',
      description: 'Deliver 60fps smooth loop animation for website header.',
      employeeId: 'emp-3',
      client: 'Apex Tech',
      priority: 'medium',
      status: 'todo',
      dueDate: '2026-09-27',
      dueTime: '14:00',
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-4',
      title: 'Sprint Review & QA Delivery with Client Stakeholders',
      description: 'Conduct live demo walkthrough and capture release feedback.',
      employeeId: 'emp-4',
      client: 'FinHealth',
      priority: 'high',
      status: 'todo',
      dueDate: '2026-09-26',
      dueTime: '20:00',
      completed: false,
      completedAt: null,
      createdAt: new Date().toISOString()
    },
    {
      id: 'task-5',
      title: 'Mobile Widget Layout Optimization',
      description: 'Fine-tune compact widget padding and responsive typography.',
      employeeId: 'emp-1',
      client: 'Apex Tech',
      priority: 'low',
      status: 'done',
      dueDate: '2026-09-25',
      dueTime: '12:00',
      completed: true,
      completedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    }
  ],
  clients: [
    {
      id: 'client-1',
      name: 'Acme Corp',
      tagline: 'Enterprise Cloud Solutions',
      badgeColor: '#0A84FF',
      activeProjects: 3,
      leadContact: 'John Doe',
      status: 'active'
    },
    {
      id: 'client-2',
      name: 'Apex Tech',
      tagline: 'NextGen AI & Automation',
      badgeColor: '#FF375F',
      activeProjects: 2,
      leadContact: 'Elena Rostova',
      status: 'active'
    },
    {
      id: 'client-3',
      name: 'CloudScale',
      tagline: 'Global Distributed Infrastructure',
      badgeColor: '#30D158',
      activeProjects: 4,
      leadContact: 'Mark Zuckerberg',
      status: 'active'
    },
    {
      id: 'client-4',
      name: 'FinHealth',
      tagline: 'Modern Digital Healthcare Banking',
      badgeColor: '#BF5AF2',
      activeProjects: 2,
      leadContact: 'Dr. Evelyn Reed',
      status: 'active'
    }
  ],
  schedules: [
    {
      id: 'sched-1',
      title: 'Client Sprint Alignment',
      employeeId: 'emp-1',
      client: 'Acme Corp',
      date: '2026-09-26',
      startTime: '10:00',
      endTime: '11:30',
      type: 'meeting',
      notes: 'Review Figma wireframes and interaction specs.'
    },
    {
      id: 'sched-2',
      title: 'API Performance & Load Test',
      employeeId: 'emp-2',
      client: 'CloudScale',
      date: '2026-09-26',
      startTime: '14:00',
      endTime: '16:00',
      type: 'milestone',
      notes: 'Benchmark 50,000 concurrent socket connections.'
    },
    {
      id: 'sched-3',
      title: 'Apex Tech Brand Pitch Call',
      employeeId: 'emp-3',
      client: 'Apex Tech',
      date: '2026-09-27',
      startTime: '15:00',
      endTime: '16:30',
      type: 'delivery',
      notes: 'Final presentation of 3D motion assets.'
    },
    {
      id: 'sched-4',
      title: 'FinHealth Security & Compliance Review',
      employeeId: 'emp-4',
      client: 'FinHealth',
      date: '2026-09-28',
      startTime: '11:00',
      endTime: '12:30',
      type: 'meeting',
      notes: 'HIPAA & ISO audit sign-off.'
    },
    {
      id: 'sched-5',
      title: 'Design System Team Workshop',
      employeeId: 'emp-1',
      client: 'Apex Tech',
      date: '2026-09-29',
      startTime: '13:00',
      endTime: '15:00',
      type: 'workshop',
      notes: 'Internal training on Apple Design Language.'
    },
    {
      id: 'sched-6',
      title: 'Architecture Sync & Code Review',
      employeeId: 'emp-2',
      client: 'FinHealth',
      date: '2026-09-30',
      startTime: '16:00',
      endTime: '17:30',
      type: 'milestone',
      notes: 'Backend database migration validation.'
    }
  ]
};

// 1-Year Retention Cleanup (Keeps completed tasks for 365 days)
function pruneOneYearOldTasks(data) {
  if (!data || !Array.isArray(data.tasks)) return;
  const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
  data.tasks = data.tasks.filter(task => {
    if (!task.completed) return true; // Keep all active tasks
    const completedTimestamp = task.completedAt ? new Date(task.completedAt).getTime() : new Date(task.createdAt || Date.now()).getTime();
    return completedTimestamp >= oneYearAgo;
  });
}

// Read store
function readStore() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    pruneOneYearOldTasks(parsed);
    return parsed;
  } catch (err) {
    console.error('Error reading store:', err);
    return defaultData;
  }
}

// Write store
function writeStore(data) {
  try {
    data.lastUpdated = new Date().toISOString();
    pruneOneYearOldTasks(data);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing store:', err);
    return false;
  }
}

// In-memory active store
let currentStore = readStore();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.get('/api/state', (req, res) => {
  res.json({ success: true, data: currentStore, serverTime: new Date().toISOString() });
});

app.get('/api/network-info', (req, res) => {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push({
          interface: k,
          ip: address.address,
          url: `http://${address.address}:${PORT}`
        });
      }
    }
  }
  res.json({
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    networkAddresses: addresses,
    hostname: os.hostname(),
    platform: os.platform()
  });
});

// Broadcast to all connected WebSocket clients (including sender)
function broadcast(message) {
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Broadcast client count to everyone
function broadcastPeerCount() {
  const count = wss.clients.size;
  const msg = JSON.stringify({
    type: 'PEER_COUNT_UPDATE',
    count: count
  });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${ip}. Total clients: ${wss.clients.size}`);

  // Send initial full state
  ws.send(JSON.stringify({
    type: 'INITIAL_STATE',
    data: currentStore,
    clientCount: wss.clients.size
  }));

  broadcastPeerCount();

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      handleClientAction(parsed, ws);
    } catch (err) {
      console.error('[WS] Error processing client message:', err);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected. Total clients: ${wss.clients.size}`);
    broadcastPeerCount();
  });

  ws.on('error', (err) => {
    console.error('[WS] Socket error:', err);
  });
});

// Handle real-time actions and mutations
function handleClientAction(action, senderWs) {
  const { type, payload, clientInfo } = action;

  switch (type) {
    // --- Task Actions ---
    case 'ADD_TASK': {
      const newTask = {
        id: 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: payload.title || 'Untitled Task',
        description: payload.description || '',
        employeeId: payload.employeeId || (currentStore.employees[0]?.id || ''),
        client: payload.client || '',
        priority: payload.priority || 'medium',
        status: payload.status || 'todo',
        dueDate: payload.dueDate || new Date().toISOString().split('T')[0],
        dueTime: payload.dueTime || '18:00',
        completed: !!payload.completed,
        completedAt: payload.completed ? new Date().toISOString() : null,
        createdAt: new Date().toISOString()
      };
      currentStore.tasks.unshift(newTask);
      writeStore(currentStore);
      broadcast({ type: 'TASK_ADDED', task: newTask, clientInfo }, senderWs);
      senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: newTask }));
      break;
    }

    case 'UPDATE_TASK': {
      const idx = currentStore.tasks.findIndex(t => t.id === payload.id);
      if (idx !== -1) {
        currentStore.tasks[idx] = { ...currentStore.tasks[idx], ...payload, updatedAt: new Date().toISOString() };
        if (payload.completed !== undefined) {
          currentStore.tasks[idx].completedAt = payload.completed ? new Date().toISOString() : null;
          if (payload.completed && currentStore.tasks[idx].status !== 'done') {
            currentStore.tasks[idx].status = 'done';
          }
        }
        writeStore(currentStore);
        broadcast({ type: 'TASK_UPDATED', task: currentStore.tasks[idx], clientInfo }, senderWs);
        senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: currentStore.tasks[idx] }));
      }
      break;
    }

    case 'DELETE_TASK': {
      const taskToDelete = currentStore.tasks.find(t => t.id === payload.id);
      currentStore.tasks = currentStore.tasks.filter(t => t.id !== payload.id);
      writeStore(currentStore);
      broadcast({ type: 'TASK_DELETED', id: payload.id, task: taskToDelete, clientInfo }, senderWs);
      senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: { id: payload.id } }));
      break;
    }

    case 'TOGGLE_TASK_STATUS': {
      const idx = currentStore.tasks.findIndex(t => t.id === payload.id);
      if (idx !== -1) {
        const isDone = !currentStore.tasks[idx].completed;
        currentStore.tasks[idx].completed = isDone;
        currentStore.tasks[idx].status = isDone ? 'done' : (payload.newStatus || 'todo');
        currentStore.tasks[idx].completedAt = isDone ? new Date().toISOString() : null;
        writeStore(currentStore);
        broadcast({ type: 'TASK_UPDATED', task: currentStore.tasks[idx], clientInfo }, senderWs);
        senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: currentStore.tasks[idx] }));
      }
      break;
    }

    // --- Employee Actions ---
    case 'ADD_EMPLOYEE': {
      const initials = (payload.name || 'User')
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

      const colors = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#FF375F', '#5E5CE6', '#64D2FF', '#FFD60A'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newEmp = {
        id: 'emp-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: payload.name.trim(),
        role: payload.role ? payload.role.trim() : 'Team Member',
        email: payload.email ? payload.email.trim() : '',
        avatarColor: payload.avatarColor || randomColor,
        avatarText: initials || 'EM',
        active: true,
        todayClients: payload.todayClients || [],
        createdAt: new Date().toISOString()
      };
      currentStore.employees.push(newEmp);
      writeStore(currentStore);
      broadcast({ type: 'EMPLOYEE_ADDED', employee: newEmp, clientInfo }, senderWs);
      senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: newEmp }));
      break;
    }

    case 'UPDATE_EMPLOYEE': {
      const idx = currentStore.employees.findIndex(e => e.id === payload.id);
      if (idx !== -1) {
        currentStore.employees[idx] = { ...currentStore.employees[idx], ...payload };
        if (payload.name) {
          currentStore.employees[idx].avatarText = payload.name
            .split(' ')
            .map(w => w[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        }
        writeStore(currentStore);
        broadcast({ type: 'EMPLOYEE_UPDATED', employee: currentStore.employees[idx], clientInfo }, senderWs);
        senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: currentStore.employees[idx] }));
      }
      break;
    }

    case 'DELETE_EMPLOYEE': {
      const empId = payload.id;
      currentStore.employees = currentStore.employees.filter(e => e.id !== empId);
      // Reassign or unassign tasks
      currentStore.tasks = currentStore.tasks.map(t => {
        if (t.employeeId === empId) {
          return { ...t, employeeId: '' };
        }
        return t;
      });
      // Remove from schedules
      currentStore.schedules = currentStore.schedules.filter(s => s.employeeId !== empId);
      writeStore(currentStore);
      broadcast({ type: 'EMPLOYEE_DELETED', id: empId, clientInfo }, senderWs);
      senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: { id: empId } }));
      break;
    }

    // --- Client Assignment Actions ---
    case 'UPDATE_EMPLOYEE_CLIENTS': {
      const idx = currentStore.employees.findIndex(e => e.id === payload.employeeId);
      if (idx !== -1) {
        currentStore.employees[idx].todayClients = payload.clients || [];
        writeStore(currentStore);
        broadcast({ type: 'EMPLOYEE_UPDATED', employee: currentStore.employees[idx], clientInfo }, senderWs);
        senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: currentStore.employees[idx] }));
      }
      break;
    }

    case 'ADD_CLIENT': {
      const newClient = {
        id: 'client-' + Date.now(),
        name: payload.name.trim(),
        tagline: payload.tagline || '',
        badgeColor: payload.badgeColor || '#0A84FF',
        activeProjects: payload.activeProjects || 1,
        leadContact: payload.leadContact || '',
        status: 'active'
      };
      currentStore.clients.push(newClient);
      writeStore(currentStore);
      broadcast({ type: 'CLIENT_ADDED', client: newClient, clientInfo }, senderWs);
      senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: newClient }));
      break;
    }

    case 'DELETE_CLIENT': {
      currentStore.clients = currentStore.clients.filter(c => c.name !== payload.name && c.id !== payload.id);
      // Update employee todayClients
      currentStore.employees.forEach(emp => {
        emp.todayClients = emp.todayClients.filter(c => c !== payload.name);
      });
      writeStore(currentStore);
      broadcast({ type: 'FULL_SYNC', data: currentStore, clientInfo }, senderWs);
      senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: { name: payload.name } }));
      break;
    }

    // --- Schedule & Calendar Actions ---
    case 'ADD_SCHEDULE': {
      const newSchedule = {
        id: 'sched-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        title: payload.title || 'Schedule Item',
        employeeId: payload.employeeId || '',
        client: payload.client || '',
        date: payload.date || new Date().toISOString().split('T')[0],
        startTime: payload.startTime || '10:00',
        endTime: payload.endTime || '11:00',
        type: payload.type || 'meeting', // 'meeting', 'milestone', 'delivery', 'shift', 'workshop'
        notes: payload.notes || '',
        createdAt: new Date().toISOString()
      };
      currentStore.schedules.push(newSchedule);
      writeStore(currentStore);
      broadcast({ type: 'SCHEDULE_ADDED', schedule: newSchedule, clientInfo }, senderWs);
      senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: newSchedule }));
      break;
    }

    case 'UPDATE_SCHEDULE': {
      const idx = currentStore.schedules.findIndex(s => s.id === payload.id);
      if (idx !== -1) {
        currentStore.schedules[idx] = { ...currentStore.schedules[idx], ...payload };
        writeStore(currentStore);
        broadcast({ type: 'SCHEDULE_UPDATED', schedule: currentStore.schedules[idx], clientInfo }, senderWs);
        senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: currentStore.schedules[idx] }));
      }
      break;
    }

    case 'DELETE_SCHEDULE': {
      currentStore.schedules = currentStore.schedules.filter(s => s.id !== payload.id);
      writeStore(currentStore);
      broadcast({ type: 'SCHEDULE_DELETED', id: payload.id, clientInfo }, senderWs);
      senderWs.send(JSON.stringify({ type: 'ACTION_CONFIRM', actionId: action.actionId, result: { id: payload.id } }));
      break;
    }

    // --- Full Restore / Import ---
    case 'IMPORT_STATE': {
      if (payload.data) {
        currentStore = { ...defaultData, ...payload.data };
        writeStore(currentStore);
        broadcast({ type: 'FULL_SYNC', data: currentStore, clientInfo }, null);
      }
      break;
    }

    default:
      console.warn('[WS] Unknown action type:', type);
  }
}

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Apple-Style Real-time Team Widget Server is LIVE!`);
  console.log(`📍 Localhost URL: http://localhost:${PORT}`);
  
  const interfaces = os.networkInterfaces();
  console.log(`🌐 LAN Network URLs (for syncing across other Mac/Windows PCs):`);
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        console.log(`   👉 http://${address.address}:${PORT}`);
      }
    }
  }
  console.log(`======================================================\n`);
});
