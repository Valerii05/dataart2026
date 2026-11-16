const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { WebSocketServer } = require('ws');
const deviceManager = require('./devices');
const workflowEngine = require('./workflowEngine');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Broadcast to all WebSocket clients
function broadcast(eventType, data) {
  const payload = JSON.stringify({ type: eventType, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Hook device events to WebSocket broadcast
deviceManager.on('deviceUpdated', (payload) => broadcast('device_updated', payload));
deviceManager.on('deviceAdded', (device) => broadcast('device_added', device));
deviceManager.on('deviceDeleted', (device) => broadcast('device_deleted', device));
deviceManager.on('telemetryTick', (summary) => broadcast('telemetry_tick', { summary }));

// Hook workflow engine logs
const originalExecute = workflowEngine.executeScenario.bind(workflowEngine);
workflowEngine.executeScenario = function (scenario, reason) {
  const log = originalExecute(scenario, reason);
  broadcast('workflow_executed', log);
  return log;
};

// WebSocket connection handling
wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      summary: deviceManager.getSummary(),
      devices: deviceManager.getAll(),
      scenarios: workflowEngine.getAll()
    }
  }));
});

// REST API Endpoints

// 1. Devices summary
app.get('/api/summary', (req, res) => {
  res.json(deviceManager.getSummary());
});

// 2. Devices list & search
app.get('/api/devices', (req, res) => {
  const { status, room, type, search } = req.query;
  const devices = deviceManager.getAll({ status, room, type, search });
  res.json(devices);
});

// 3. Get single device
app.get('/api/devices/:id', (req, res) => {
  const device = deviceManager.getById(req.params.id);
  if (!device) return res.status(404).json({ error: 'Device not found' });
  res.json(device);
});

// 4. Update device state
app.put('/api/devices/:id/state', (req, res) => {
  const updated = deviceManager.updateState(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Device not found' });
  res.json(updated);
});

// 5. Toggle device online/offline status
app.post('/api/devices/:id/toggle-status', (req, res) => {
  const updated = deviceManager.toggleStatus(req.params.id);
  if (!updated) return res.status(404).json({ error: 'Device not found' });
  res.json(updated);
});

// 6. Add new device
app.post('/api/devices', (req, res) => {
  const device = deviceManager.addDevice(req.body);
  res.status(201).json(device);
});

// 7. Delete device
app.delete('/api/devices/:id', (req, res) => {
  const ok = deviceManager.deleteDevice(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Device not found' });
  res.json({ success: true, id: req.params.id });
});

// 8. Workflow Scenarios
app.get('/api/scenarios', (req, res) => {
  res.json(workflowEngine.getAll());
});

app.post('/api/scenarios', (req, res) => {
  const scen = workflowEngine.createScenario(req.body);
  res.status(201).json(scen);
});

app.post('/api/scenarios/:id/trigger', (req, res) => {
  const scen = workflowEngine.getById(req.params.id);
  if (!scen) return res.status(404).json({ error: 'Scenario not found' });
  const log = workflowEngine.executeScenario(scen, 'Manual dashboard trigger');
  res.json({ success: true, log });
});

app.post('/api/scenarios/:id/toggle', (req, res) => {
  const scen = workflowEngine.toggleScenario(req.params.id);
  if (!scen) return res.status(404).json({ error: 'Scenario not found' });
  res.json(scen);
});

app.delete('/api/scenarios/:id', (req, res) => {
  const ok = workflowEngine.deleteScenario(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Scenario not found' });
  res.json({ success: true, id: req.params.id });
});

app.get('/api/scenarios/logs', (req, res) => {
  res.json(workflowEngine.getLogs());
});

// 9. Interactive MCP tool caller endpoint (for web UI testing)
app.post('/api/mcp/call', (req, res) => {
  const { tool, arguments: args } = req.body;
  try {
    switch (tool) {
      case 'list_devices':
        return res.json({ result: deviceManager.getAll(args || {}) });
      case 'get_device_status':
        const dev = deviceManager.getById(args.device_id);
        if (!dev) return res.status(404).json({ error: 'Device not found' });
        return res.json({ result: dev });
      case 'control_device':
        const target = deviceManager.getById(args.device_id);
        if (!target) return res.status(404).json({ error: 'Device not found' });
        if (target.status === 'offline' && args.action !== 'toggle_status') {
          return res.status(400).json({ error: `Device ${target.name} is offline` });
        }
        if (args.action === 'set_power') deviceManager.updateState(target.id, { power: args.value ? 'on' : 'off' });
        else if (args.action === 'set_temperature') deviceManager.updateState(target.id, { targetTemp: Number(args.value) });
        else if (args.action === 'set_lock') deviceManager.updateState(target.id, { locked: Boolean(args.value) });
        else if (args.action === 'toggle_status') deviceManager.toggleStatus(target.id);
        return res.json({ result: { success: true, device: deviceManager.getById(target.id) } });
      case 'get_system_summary':
        return res.json({ result: deviceManager.getSummary() });
      case 'list_automations':
        return res.json({ result: workflowEngine.getAll() });
      case 'trigger_automation':
        const sc = workflowEngine.getById(args.scenario_id);
        if (!sc) return res.status(404).json({ error: 'Scenario not found' });
        return res.json({ result: workflowEngine.executeScenario(sc, 'Web MCP Test') });
      default:
        return res.status(400).json({ error: `Unknown tool: ${tool}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🏠 Smart Home Device Monitoring Dashboard`);
    console.log(`🚀 Running at: http://localhost:${PORT}`);
    console.log(`📡 WebSocket server live for real-time updates`);
    console.log(`🤖 MCP Server entrypoint: src/mcp/server.js`);
    console.log(`====================================================`);
  });
}

module.exports = { app, server };

