// Global state
let state = {
  devices: [],
  summary: null,
  scenarios: [],
  logs: [],
  filters: {
    search: '',
    status: 'all',
    room: 'all',
    type: 'all'
  }
};

let ws = null;

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  fetchInitialData();
  updateMcpParamsInput();
});

// Switch Tabs
function switchTab(tabId) {
  const tabs = ['devices', 'workflow', 'mcp'];
  tabs.forEach(t => {
    const el = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}`);
    const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (t === tabId) {
      el.classList.remove('hidden');
      btn.classList.add('border-indigo-500', 'text-indigo-400');
      btn.classList.remove('border-transparent', 'text-slate-400');
    } else {
      el.classList.add('hidden');
      btn.classList.remove('border-indigo-500', 'text-indigo-400');
      btn.classList.add('border-transparent', 'text-slate-400');
    }
  });
}

// WebSocket Management
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}`;
  const badge = document.getElementById('wsStatusBadge');

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      badge.className = 'flex items-center gap-2 text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1.5 rounded-lg font-medium';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-500 status-pulse"></span><span>Live Telemetry</span>';
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleWsMessage(msg);
      } catch (e) {
        console.error('WS parse error', e);
      }
    };

    ws.onclose = () => {
      badge.className = 'flex items-center gap-2 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1.5 rounded-lg font-medium';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-amber-500"></span><span>Reconnecting...</span>';
      setTimeout(initWebSocket, 3000);
    };

    ws.onerror = () => {
      ws.close();
    };
  } catch (err) {
    console.warn('WS not supported or failed to connect:', err);
  }
}

function handleWsMessage(msg) {
  if (msg.type === 'init') {
    state.summary = msg.data.summary;
    state.devices = msg.data.devices;
    state.scenarios = msg.data.scenarios;
    updateKpis();
    populateFilterDropdowns();
    renderDevices();
    renderScenarios();
  } else if (msg.type === 'telemetry_tick') {
    // Soft update without full rerender to avoid flickering inputs
    refreshDevicesQuietly();
    if (msg.data.summary) {
      state.summary = msg.data.summary;
      updateKpis();
    }
  } else if (msg.type === 'device_updated' || msg.type === 'device_added' || msg.type === 'device_deleted') {
    fetchInitialData();
  } else if (msg.type === 'workflow_executed') {
    state.logs.unshift(msg.data);
    renderLogs();
    fetchScenarios();
  }
}

// Fetch initial data
async function fetchInitialData() {
  try {
    const [summaryRes, devicesRes, scenariosRes, logsRes] = await Promise.all([
      fetch('/api/summary'),
      fetch('/api/devices'),
      fetch('/api/scenarios'),
      fetch('/api/scenarios/logs')
    ]);

    state.summary = await summaryRes.json();
    state.devices = await devicesRes.json();
    state.scenarios = await scenariosRes.json();
    state.logs = await logsRes.json();

    updateKpis();
    populateFilterDropdowns();
    renderDevices();
    renderScenarios();
    renderLogs();
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

async function refreshDevicesQuietly() {
  try {
    const res = await fetch('/api/devices');
    state.devices = await res.json();
    renderDevices();
  } catch (e) {}
}

async function fetchScenarios() {
  try {
    const res = await fetch('/api/scenarios');
    state.scenarios = await res.json();
    renderScenarios();
  } catch (e) {}
}

// Update KPI Stats Cards
function updateKpis() {
  if (!state.summary) return;

  const { totalDevices, onlineDevices, offlineDevices, onlinePercentage, activeAlerts, rooms } = state.summary;

  document.getElementById('kpiTotal').textContent = totalDevices;
  document.getElementById('kpiRoomsCount').textContent = `Across ${rooms ? rooms.length : 0} rooms`;

  // Online devices metric
  document.getElementById('kpiOnline').textContent = onlineDevices;
  document.getElementById('kpiOnlinePercent').textContent = `${onlinePercentage}% online`;

  // Offline Devices
  document.getElementById('kpiOffline').textContent = offlineDevices;
  document.getElementById('kpiOfflineNotice').textContent = offlineDevices > 0 ? `${offlineDevices} need inspection` : 'All systems connected';

  // System Health
  const healthEl = document.getElementById('kpiHealth');
  const alertEl = document.getElementById('kpiAlertMessage');
  if (onlinePercentage >= 80) {
    healthEl.textContent = 'Optimal';
    healthEl.className = 'text-3xl font-extrabold text-emerald-400';
  } else if (onlinePercentage >= 50) {
    healthEl.textContent = 'Degraded';
    healthEl.className = 'text-3xl font-extrabold text-amber-400';
  } else {
    healthEl.textContent = 'Critical';
    healthEl.className = 'text-3xl font-extrabold text-rose-400';
  }

  if (activeAlerts && activeAlerts.length > 0) {
    alertEl.innerHTML = `<span class="text-amber-400 font-medium">${activeAlerts[0]}</span>`;
  } else {
    alertEl.textContent = 'All critical services nominal';
  }

  document.getElementById('tabCountDevices').textContent = totalDevices;
}

// Populate Filter Dropdowns
function populateFilterDropdowns() {
  if (!state.summary) return;

  const roomSelect = document.getElementById('filterRoom');
  const typeSelect = document.getElementById('filterType');

  const currentRoom = roomSelect.value;
  const currentType = typeSelect.value;

  // Rooms
  const rooms = state.summary.rooms || [];
  roomSelect.innerHTML = '<option value="all">Room: All</option>' + 
    rooms.map(r => `<option value="${r}">${r}</option>`).join('');
  roomSelect.value = currentRoom || 'all';

  // Types
  const types = state.summary.deviceTypes || [];
  typeSelect.innerHTML = '<option value="all">Type: All</option>' + 
    types.map(t => `<option value="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join('');
  typeSelect.value = currentType || 'all';
}

// Filter apply
function applyFilters() {
  state.filters.search = document.getElementById('searchInput').value.trim();
  state.filters.status = document.getElementById('filterStatus').value;
  state.filters.room = document.getElementById('filterRoom').value;
  state.filters.type = document.getElementById('filterType').value;
  renderDevices();
}

// Render Devices Grid
function renderDevices() {
  const container = document.getElementById('devicesGrid');
  if (!container) return;

  let filtered = [...state.devices];

  if (state.filters.status !== 'all') {
    filtered = filtered.filter(d => d.status.toLowerCase() === state.filters.status.toLowerCase());
  }
  if (state.filters.room !== 'all') {
    filtered = filtered.filter(d => d.room.toLowerCase() === state.filters.room.toLowerCase());
  }
  if (state.filters.type !== 'all') {
    filtered = filtered.filter(d => d.type.toLowerCase() === state.filters.type.toLowerCase());
  }
  if (state.filters.search) {
    const q = state.filters.search.toLowerCase();
    filtered = filtered.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.room.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q) ||
      d.type.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500 bg-slate-900/50 border border-slate-800 rounded-2xl">
        <i class="fa-solid fa-radar text-3xl mb-2 text-slate-600"></i>
        <p class="text-sm">No smart devices match your active filters.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(d => renderDeviceCard(d)).join('');
}

// Render Single Device Card
function renderDeviceCard(d) {
  const isOnline = d.status === 'online';
  const iconClass = getDeviceIcon(d.type);

  // Status badge
  const statusBadge = isOnline 
    ? `<span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse"></span> Online
       </span>`
    : `<span class="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30">
        <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Offline
       </span>`;

  // Battery info
  const batteryBadge = d.batteryLevel !== null
    ? `<span class="flex items-center gap-1 text-xs ${d.batteryLevel <= 20 ? 'text-amber-400 font-semibold' : 'text-slate-400'}">
        <i class="fa-solid ${d.batteryLevel > 50 ? 'fa-battery-full' : (d.batteryLevel > 20 ? 'fa-battery-half' : 'fa-battery-quarter')}"></i>
        ${d.batteryLevel}%
       </span>`
    : `<span class="flex items-center gap-1 text-xs text-slate-500"><i class="fa-solid fa-plug text-xs"></i> AC Power</span>`;

  // Telemetry details based on device type
  let telemetryHtml = '';
  if (d.type === 'thermostat') {
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">Current Temp</span>
          <span class="text-slate-200 font-bold text-sm">${d.state.currentTemp ?? '--'}°C</span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Target / Mode</span>
          <span class="text-indigo-400 font-semibold">${d.state.targetTemp ?? '--'}°C (${d.state.mode || 'eco'})</span>
        </div>
      </div>
    `;
  } else if (d.type === 'lighting') {
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">Power State</span>
          <span class="font-bold ${d.state.power === 'on' ? 'text-emerald-400' : 'text-slate-400'} uppercase">${d.state.power}</span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Brightness / Watts</span>
          <span class="text-amber-300 font-semibold">${d.state.brightness}% • ${d.state.wattage || 0}W</span>
        </div>
      </div>
    `;
  } else if (d.type === 'camera') {
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">Recording Stream</span>
          <span class="font-bold ${d.state.recording ? 'text-emerald-400' : 'text-rose-400'}">${d.state.recording ? 'REC • 4K Live' : 'Standby'}</span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Motion</span>
          <span class="${d.state.motionDetected ? 'text-amber-400 font-bold' : 'text-slate-400'}">${d.state.motionDetected ? 'DETECTED' : 'Clear'}</span>
        </div>
      </div>
    `;
  } else if (d.type === 'lock') {
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">Deadbolt State</span>
          <span class="font-bold ${d.state.locked ? 'text-emerald-400' : 'text-amber-400'} uppercase">${d.state.locked ? 'LOCKED 🔒' : 'UNLOCKED 🔓'}</span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Keypad</span>
          <span class="text-slate-300">${d.state.keypadEnabled ? 'Armed' : 'Disabled'}</span>
        </div>
      </div>
    `;
  } else if (d.type === 'plug') {
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">Draw</span>
          <span class="text-cyan-300 font-bold text-sm">${d.state.currentWatts ?? 0} W</span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Daily Energy</span>
          <span class="text-slate-300 font-semibold">${d.state.dailyKWh ?? 0} kWh</span>
        </div>
      </div>
    `;
  } else if (d.type === 'air_purifier') {
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">PM2.5 Index</span>
          <span class="text-emerald-400 font-bold text-sm">${d.state.pm25 ?? 0} µg/m³</span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Filter Life</span>
          <span class="text-slate-300 font-semibold">${d.state.filterLifeRemainingPercent ?? 90}%</span>
        </div>
      </div>
    `;
  } else if (d.type === 'sensor') {
    const isLeak = Boolean(d.state.leakDetected);
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">Water Status</span>
          <span class="font-bold ${isLeak ? 'text-rose-400' : 'text-emerald-400'} flex items-center gap-1">
            <i class="fa-solid ${isLeak ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i>
            ${isLeak ? 'LEAK DETECTED' : 'Dry & Nominal'}
          </span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Temperature</span>
          <span class="text-slate-300 font-semibold">${d.state.temperature !== undefined ? d.state.temperature + '°C' : '--'}</span>
        </div>
      </div>
    `;
  } else if (d.type === 'motion') {
    const hasMotion = Boolean(d.state.motion);
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">Motion Activity</span>
          <span class="font-bold ${hasMotion ? 'text-amber-400' : 'text-slate-300'} flex items-center gap-1">
            <i class="fa-solid ${hasMotion ? 'fa-person-walking' : 'fa-shield'}"></i>
            ${hasMotion ? 'Motion Detected' : 'All Clear'}
          </span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Illuminance</span>
          <span class="text-amber-300 font-semibold">${d.state.illuminanceLux !== undefined ? d.state.illuminanceLux + ' Lux' : '--'}</span>
        </div>
      </div>
    `;
  } else if (d.type === 'garage') {
    const isOpen = d.state.doorState === 'open';
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
        <div>
          <span class="text-slate-500 block">Door State</span>
          <span class="font-bold ${isOpen ? 'text-amber-400' : 'text-slate-300'} uppercase">
            ${d.state.doorState || 'Closed'}
          </span>
        </div>
        <div class="text-right">
          <span class="text-slate-500 block">Safety Sensor</span>
          <span class="${d.state.obstructionDetected ? 'text-rose-400 font-bold' : 'text-emerald-400'}">
            ${d.state.obstructionDetected ? 'Obstructed' : 'Clear'}
          </span>
        </div>
      </div>
    `;
  } else {
    // Clean formatted badges for any generic properties
    const stateEntries = Object.entries(d.state || {});
    telemetryHtml = `
      <div class="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 text-xs">
        <div class="flex flex-wrap gap-1.5">
          ${stateEntries.length > 0 
            ? stateEntries.map(([k, v]) => `
              <span class="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px] text-slate-300 truncate max-w-full">
                <span class="text-slate-500">${escapeHtml(k)}:</span> ${escapeHtml(String(v))}
              </span>
            `).join('')
            : '<span class="text-slate-500">Standby</span>'
          }
        </div>
      </div>
    `;
  }

  // Quick action buttons
  let actionButtonsHtml = '';
  if (d.type === 'lighting') {
    actionButtonsHtml = `
      <button onclick="togglePower('${d.id}', '${d.state.power === 'on' ? 'off' : 'on'}')" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 rounded-lg border border-slate-700 transition font-medium flex items-center justify-center gap-1.5">
        <i class="fa-solid fa-power-off text-amber-400"></i> ${d.state.power === 'on' ? 'Turn Off' : 'Turn On'}
      </button>
    `;
  } else if (d.type === 'lock') {
    actionButtonsHtml = `
      <button onclick="toggleLock('${d.id}', ${!d.state.locked})" class="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs py-1.5 rounded-lg border border-slate-700 transition font-medium flex items-center justify-center gap-1.5">
        <i class="fa-solid ${d.state.locked ? 'fa-lock-open text-amber-400' : 'fa-lock text-emerald-400'}"></i> ${d.state.locked ? 'Unlock' : 'Lock'}
      </button>
    `;
  } else if (d.type === 'thermostat') {
    actionButtonsHtml = `
      <button onclick="adjustTemp('${d.id}', ${d.state.targetTemp - 0.5})" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition font-bold">-0.5°</button>
      <button onclick="adjustTemp('${d.id}', ${d.state.targetTemp + 0.5})" class="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition font-bold">+0.5°</button>
    `;
  }

  return `
    <div class="bg-slate-900 border ${isOnline ? 'border-slate-800' : 'border-rose-900/30'} rounded-2xl p-4 shadow-sm flex flex-col justify-between hover:border-slate-700 transition space-y-3 relative group overflow-hidden">
      <!-- Top header -->
      <div>
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl shrink-0 ${isOnline ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-slate-800 text-slate-500'} flex items-center justify-center text-lg">
              <i class="${iconClass}"></i>
            </div>
            <div class="min-w-0">
              <h4 class="text-sm font-bold text-white group-hover:text-indigo-400 transition truncate">${escapeHtml(d.name)}</h4>
              <p class="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                <i class="fa-solid fa-location-dot text-slate-500"></i> ${escapeHtml(d.room)}
                <span class="text-slate-600">•</span>
                <span class="text-slate-500 uppercase text-[10px] tracking-wider font-semibold">${escapeHtml(d.type)}</span>
              </p>
            </div>
          </div>
          <div class="shrink-0">${statusBadge}</div>
        </div>

        <!-- Telemetry Widget -->
        <div class="mt-3.5">
          ${telemetryHtml}
        </div>

        <!-- Metadata row -->
        <div class="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
          <span class="truncate">IP: <code class="text-slate-400">${d.ipAddress || '--'}</code></span>
          <div class="shrink-0 pl-2">${batteryBadge}</div>
        </div>
      </div>

      <!-- Action Footer -->
      <div class="pt-2 flex flex-wrap items-center gap-2">
        ${actionButtonsHtml}
        
        <!-- Toggle Online / Offline simulation button -->
        <button onclick="toggleOnline('${d.id}')" title="Simulate device connect / disconnect" class="flex-1 sm:flex-none bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 transition flex items-center justify-center gap-1 font-medium min-h-[32px]">
          <i class="fa-solid fa-toggle-on text-xs"></i>
          <span>${isOnline ? 'Set Offline' : 'Set Online'}</span>
        </button>

        <!-- Delete button -->
        <button onclick="deleteDevice('${d.id}')" title="Remove device" class="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg transition min-h-[32px] flex items-center justify-center">
          <i class="fa-solid fa-trash-can text-xs"></i>
        </button>
      </div>
    </div>
  `;
}

function getDeviceIcon(type) {
  switch (type) {
    case 'thermostat': return 'fa-solid fa-temperature-half';
    case 'camera': return 'fa-solid fa-video';
    case 'lighting': return 'fa-solid fa-lightbulb';
    case 'plug': return 'fa-solid fa-plug-circle-bolt';
    case 'lock': return 'fa-solid fa-lock';
    case 'sensor': return 'fa-solid fa-droplet';
    case 'air_purifier': return 'fa-solid fa-wind';
    case 'garage': return 'fa-solid fa-warehouse';
    case 'motion': return 'fa-solid fa-person-walking';
    default: return 'fa-solid fa-microchip';
  }
}

// Device API Actions
async function toggleOnline(id) {
  try {
    await fetch(`/api/devices/${id}/toggle-status`, { method: 'POST' });
    fetchInitialData();
  } catch (e) {
    console.error(e);
  }
}

async function togglePower(id, newPower) {
  try {
    await fetch(`/api/devices/${id}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ power: newPower })
    });
    fetchInitialData();
  } catch (e) {
    console.error(e);
  }
}

async function toggleLock(id, newLock) {
  try {
    await fetch(`/api/devices/${id}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: newLock })
    });
    fetchInitialData();
  } catch (e) {
    console.error(e);
  }
}

async function adjustTemp(id, targetTemp) {
  try {
    await fetch(`/api/devices/${id}/state`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetTemp: parseFloat(targetTemp.toFixed(1)) })
    });
    fetchInitialData();
  } catch (e) {
    console.error(e);
  }
}

async function deleteDevice(id) {
  if (!confirm('Are you sure you want to remove this smart device?')) return;
  try {
    await fetch(`/api/devices/${id}`, { method: 'DELETE' });
    fetchInitialData();
  } catch (e) {
    console.error(e);
  }
}

// Modal handling
function openAddDeviceModal() {
  document.getElementById('addDeviceModal').classList.remove('hidden');
}

function closeAddDeviceModal() {
  document.getElementById('addDeviceModal').classList.add('hidden');
}

async function submitAddDevice(e) {
  e.preventDefault();
  const name = document.getElementById('devNameInput').value;
  const type = document.getElementById('devTypeInput').value;
  const room = document.getElementById('devRoomInput').value;
  const status = document.getElementById('devStatusInput').value;

  try {
    await fetch('/api/devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type, room, status })
    });
    closeAddDeviceModal();
    document.getElementById('addDeviceForm').reset();
    fetchInitialData();
  } catch (err) {
    alert('Failed to add device: ' + err.message);
  }
}

// WORKFLOW ENGINE TAB
function renderScenarios() {
  const container = document.getElementById('scenariosList');
  if (!container) return;

  if (state.scenarios.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-500">No automation scenarios configured.</div>`;
    return;
  }

  container.innerHTML = state.scenarios.map(sc => `
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-lg ${sc.enabled ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-500'} flex items-center justify-center">
            <i class="fa-solid fa-bolt text-sm"></i>
          </div>
          <div>
            <h4 class="text-sm font-bold text-white flex items-center gap-2">
              ${escapeHtml(sc.name)}
              <span class="text-[10px] px-2 py-0.5 rounded-full ${sc.enabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'} font-semibold">
                ${sc.enabled ? 'Active' : 'Disabled'}
              </span>
            </h4>
            <p class="text-xs text-slate-400">${escapeHtml(sc.description)}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="triggerScenarioManual('${sc.id}')" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 font-medium transition flex items-center gap-1.5">
            <i class="fa-solid fa-play text-xs"></i>
            <span>Run Test</span>
          </button>
          <button onclick="toggleScenario('${sc.id}')" class="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition">
            ${sc.enabled ? 'Disable' : 'Enable'}
          </button>
          <button onclick="deleteScenario('${sc.id}')" class="text-slate-500 hover:text-rose-400 p-1.5 transition">
            <i class="fa-solid fa-trash-can text-xs"></i>
          </button>
        </div>
      </div>

      <!-- Trigger, Condition, Action badges -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs pt-1">
        <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
          <span class="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Trigger</span>
          <span class="text-indigo-400 font-mono">${escapeHtml(sc.trigger.type)} (${escapeHtml(sc.trigger.property || 'status')} ${sc.trigger.operator} ${sc.trigger.value})</span>
        </div>
        <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
          <span class="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Conditions</span>
          <span class="text-slate-300">${sc.conditions.length > 0 ? `${sc.conditions.length} rule(s) checked` : 'None (runs always)'}</span>
        </div>
        <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
          <span class="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">Actions</span>
          <span class="text-amber-300">${sc.actions.length} action(s) configured</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderLogs() {
  const container = document.getElementById('workflowLogs');
  if (!container) return;

  if (state.logs.length === 0) {
    container.innerHTML = `<span class="text-slate-500">No automation executions recorded yet. Click 'Run Test' above to execute a scenario.</span>`;
    return;
  }

  container.innerHTML = state.logs.map(log => `
    <div class="border-b border-slate-900 pb-1.5">
      <div class="flex items-center justify-between text-[11px] text-slate-500">
        <span class="text-amber-400 font-bold">${escapeHtml(log.scenarioName)}</span>
        <span>${new Date(log.timestamp).toLocaleTimeString()}</span>
      </div>
      <div class="text-slate-400 text-xs">${escapeHtml(log.reason)}</div>
      ${log.executedActions.map(act => `<div class="text-emerald-400 text-xs pl-2">↳ ${escapeHtml(act)}</div>`).join('')}
    </div>
  `).join('');
}

async function triggerScenarioManual(id) {
  try {
    const res = await fetch(`/api/scenarios/${id}/trigger`, { method: 'POST' });
    const data = await res.json();
    if (data.log) {
      state.logs.unshift(data.log);
      renderLogs();
    }
  } catch (e) {
    console.error(e);
  }
}

async function toggleScenario(id) {
  try {
    await fetch(`/api/scenarios/${id}/toggle`, { method: 'POST' });
    fetchScenarios();
  } catch (e) {
    console.error(e);
  }
}

async function deleteScenario(id) {
  if (!confirm('Delete this scenario?')) return;
  try {
    await fetch(`/api/scenarios/${id}`, { method: 'DELETE' });
    fetchScenarios();
  } catch (e) {
    console.error(e);
  }
}

function openAddScenarioModal() {
  document.getElementById('addScenarioModal').classList.remove('hidden');
}

function closeAddScenarioModal() {
  document.getElementById('addScenarioModal').classList.add('hidden');
}

async function submitAddScenario(e) {
  e.preventDefault();
  const name = document.getElementById('scenNameInput').value;
  const description = document.getElementById('scenDescInput').value;

  try {
    await fetch('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description })
    });
    closeAddScenarioModal();
    document.getElementById('addScenarioForm').reset();
    fetchScenarios();
  } catch (err) {
    alert('Failed to create scenario: ' + err.message);
  }
}

// AI / MCP SERVER TAB
function updateMcpParamsInput() {
  const tool = document.getElementById('mcpToolSelect').value;
  const input = document.getElementById('mcpToolArgs');

  switch (tool) {
    case 'list_devices':
      input.value = JSON.stringify({ status: "online", room: "Living Room" });
      break;
    case 'get_device_status':
      input.value = JSON.stringify({ device_id: "dev-001" });
      break;
    case 'control_device':
      input.value = JSON.stringify({ device_id: "dev-003", action: "set_power", value: true });
      break;
    case 'trigger_automation':
      input.value = JSON.stringify({ scenario_id: "scen-001" });
      break;
    default:
      input.value = '{}';
  }
}

async function executeMcpTool() {
  const tool = document.getElementById('mcpToolSelect').value;
  const box = document.getElementById('mcpResponseBox');
  let args = {};

  try {
    args = JSON.parse(document.getElementById('mcpToolArgs').value || '{}');
  } catch (err) {
    box.textContent = `JSON parse error in arguments: ${err.message}`;
    box.className = 'bg-slate-950 border border-rose-800 text-rose-400 font-mono text-xs p-4 rounded-xl min-h-[160px] whitespace-pre-wrap';
    return;
  }

  box.textContent = 'Calling MCP tool via server endpoint...';
  box.className = 'bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs p-4 rounded-xl min-h-[160px] whitespace-pre-wrap';

  try {
    const res = await fetch('/api/mcp/call', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, arguments: args })
    });
    const data = await res.json();
    box.textContent = JSON.stringify(data, null, 2);
    box.className = 'bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs p-4 rounded-xl min-h-[160px] whitespace-pre-wrap';
  } catch (err) {
    box.textContent = `Error: ${err.message}`;
    box.className = 'bg-slate-950 border border-rose-800 text-rose-400 font-mono text-xs p-4 rounded-xl min-h-[160px] whitespace-pre-wrap';
  }
}

// Utility: escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

