const EventEmitter = require('events');

class DeviceManager extends EventEmitter {
  constructor() {
    super();
    this.devices = [
      {
        id: 'dev-001',
        name: 'Living Room Thermostat',
        type: 'thermostat',
        category: 'Climate',
        room: 'Living Room',
        status: 'online',
        ipAddress: '192.168.1.101',
        macAddress: '00:1B:44:11:3A:B7',
        batteryLevel: 98,
        firmware: 'v2.4.1',
        lastSeen: new Date().toISOString(),
        state: {
          currentTemp: 21.8,
          targetTemp: 22.0,
          humidity: 45,
          mode: 'heat', // heat, cool, eco, off
          fan: 'auto'
        }
      },
      {
        id: 'dev-002',
        name: 'Front Porch Camera',
        type: 'camera',
        category: 'Security',
        room: 'Entrance',
        status: 'online',
        ipAddress: '192.168.1.102',
        macAddress: '00:1B:44:22:8C:11',
        batteryLevel: 84,
        firmware: 'v3.1.0',
        lastSeen: new Date().toISOString(),
        state: {
          recording: true,
          motionDetected: false,
          nightVision: true,
          resolution: '4K',
          streamUrl: 'rtsp://192.168.1.102:554/live'
        }
      },
      {
        id: 'dev-003',
        name: 'Kitchen Ceiling Lights',
        type: 'lighting',
        category: 'Lighting',
        room: 'Kitchen',
        status: 'online',
        ipAddress: '192.168.1.103',
        macAddress: '00:1B:44:33:9D:44',
        batteryLevel: null, // Hardwired
        firmware: 'v1.8.2',
        lastSeen: new Date().toISOString(),
        state: {
          power: 'on',
          brightness: 80,
          colorTemp: 3200,
          color: '#FFE2B3',
          wattage: 38.5
        }
      },
      {
        id: 'dev-004',
        name: 'Master Bedroom Smart Plug',
        type: 'plug',
        category: 'Energy',
        room: 'Master Bedroom',
        status: 'online',
        ipAddress: '192.168.1.104',
        macAddress: '00:1B:44:44:FE:23',
        batteryLevel: null,
        firmware: 'v1.3.0',
        lastSeen: new Date().toISOString(),
        state: {
          power: 'on',
          currentWatts: 62.4,
          dailyKWh: 1.14,
          voltage: 228.5
        }
      },
      {
        id: 'dev-005',
        name: 'Backyard Floodlight Camera',
        type: 'camera',
        category: 'Security',
        room: 'Backyard',
        status: 'offline',
        ipAddress: '192.168.1.105',
        macAddress: '00:1B:44:55:7A:99',
        batteryLevel: 12,
        firmware: 'v2.0.4',
        lastSeen: new Date(Date.now() - 3600000 * 4).toISOString(),
        state: {
          recording: false,
          motionDetected: false,
          floodlight: 'off',
          nightVision: false
        }
      },
      {
        id: 'dev-006',
        name: 'Front Door Smart Lock',
        type: 'lock',
        category: 'Security',
        room: 'Entrance',
        status: 'online',
        ipAddress: '192.168.1.106',
        macAddress: '00:1B:44:66:BC:55',
        batteryLevel: 76,
        firmware: 'v4.0.1',
        lastSeen: new Date().toISOString(),
        state: {
          locked: true,
          autoLockMinutes: 5,
          keypadEnabled: true,
          tamperAlarm: false
        }
      },
      {
        id: 'dev-007',
        name: 'Basement Water Leak Sensor',
        type: 'sensor',
        category: 'Safety',
        room: 'Basement',
        status: 'online',
        ipAddress: '192.168.1.107',
        macAddress: '00:1B:44:77:FF:33',
        batteryLevel: 92,
        firmware: 'v1.1.0',
        lastSeen: new Date().toISOString(),
        state: {
          leakDetected: false,
          temperature: 16.4,
          batteryWarning: false
        }
      },
      {
        id: 'dev-008',
        name: 'Living Room Air Purifier',
        type: 'air_purifier',
        category: 'Climate',
        room: 'Living Room',
        status: 'online',
        ipAddress: '192.168.1.108',
        macAddress: '00:1B:44:88:AA:12',
        batteryLevel: null,
        firmware: 'v2.3.0',
        lastSeen: new Date().toISOString(),
        state: {
          power: 'on',
          pm25: 8,
          airQuality: 'Excellent',
          fanSpeed: 'level_2',
          filterLifeRemainingPercent: 87
        }
      },
      {
        id: 'dev-009',
        name: 'Garage Door Opener',
        type: 'garage',
        category: 'Access',
        room: 'Garage',
        status: 'offline',
        ipAddress: '192.168.1.109',
        macAddress: '00:1B:44:99:CC:01',
        batteryLevel: null,
        firmware: 'v1.9.0',
        lastSeen: new Date(Date.now() - 3600000 * 8).toISOString(),
        state: {
          doorState: 'closed',
          obstructionDetected: false
        }
      },
      {
        id: 'dev-010',
        name: 'Hallway Motion Sensor',
        type: 'motion',
        category: 'Security',
        room: 'Hallway',
        status: 'online',
        ipAddress: '192.168.1.110',
        macAddress: '00:1B:44:AA:EE:78',
        batteryLevel: 68,
        firmware: 'v1.2.5',
        lastSeen: new Date().toISOString(),
        state: {
          motion: false,
          illuminanceLux: 140,
          sensitivity: 'medium'
        }
      }
    ];

    this.startTelemetrySimulation();
  }

  getAll(filters = {}) {
    let result = [...this.devices];

    if (filters.status && filters.status !== 'all') {
      result = result.filter(d => d.status.toLowerCase() === filters.status.toLowerCase());
    }

    if (filters.room && filters.room !== 'all') {
      result = result.filter(d => d.room.toLowerCase() === filters.room.toLowerCase());
    }

    if (filters.type && filters.type !== 'all') {
      result = result.filter(d => d.type.toLowerCase() === filters.type.toLowerCase());
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.room.toLowerCase().includes(q) || 
        d.type.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q)
      );
    }

    return result;
  }

  getById(id) {
    return this.devices.find(d => d.id === id) || null;
  }

  getSummary() {
    const total = this.devices.length;
    const online = this.devices.filter(d => d.status === 'online').length;
    const offline = total - online;
    const lowBattery = this.devices.filter(d => d.batteryLevel !== null && d.batteryLevel <= 20).length;
    const activeAlerts = [];

    if (offline > 0) {
      activeAlerts.push(`${offline} device${offline > 1 ? 's are' : ' is'} currently offline`);
    }
    if (lowBattery > 0) {
      activeAlerts.push(`${lowBattery} battery-powered device${lowBattery > 1 ? 's have' : ' has'} low battery (<=20%)`);
    }

    return {
      totalDevices: total,
      onlineDevices: online,
      offlineDevices: offline,
      onlinePercentage: total > 0 ? Math.round((online / total) * 100) : 0,
      lowBatteryCount: lowBattery,
      activeAlerts,
      rooms: [...new Set(this.devices.map(d => d.room))],
      deviceTypes: [...new Set(this.devices.map(d => d.type))],
      timestamp: new Date().toISOString()
    };
  }

  updateState(id, newState) {
    const device = this.getById(id);
    if (!device) return null;

    device.state = { ...device.state, ...newState };
    device.lastSeen = new Date().toISOString();
    
    this.emit('deviceUpdated', { device, action: 'state_changed', diff: newState });
    return device;
  }

  toggleStatus(id, newStatus = null) {
    const device = this.getById(id);
    if (!device) return null;

    if (newStatus) {
      device.status = newStatus;
    } else {
      device.status = device.status === 'online' ? 'offline' : 'online';
    }

    device.lastSeen = new Date().toISOString();
    this.emit('deviceUpdated', { device, action: 'status_toggled', status: device.status });
    return device;
  }

  addDevice(payload) {
    const id = `dev-${String(this.devices.length + 1).padStart(3, '0')}`;
    const newDevice = {
      id,
      name: payload.name || `Smart Device ${id}`,
      type: payload.type || 'generic',
      category: payload.category || 'General',
      room: payload.room || 'Living Room',
      status: payload.status || 'online',
      ipAddress: payload.ipAddress || `192.168.1.${110 + this.devices.length}`,
      macAddress: payload.macAddress || '00:1B:44:EE:' + Math.floor(Math.random()*89+10) + ':AA',
      batteryLevel: payload.batteryLevel !== undefined ? payload.batteryLevel : 100,
      firmware: payload.firmware || 'v1.0.0',
      lastSeen: new Date().toISOString(),
      state: payload.state || { power: 'off' }
    };

    this.devices.push(newDevice);
    this.emit('deviceAdded', newDevice);
    return newDevice;
  }

  deleteDevice(id) {
    const index = this.devices.findIndex(d => d.id === id);
    if (index === -1) return false;

    const removed = this.devices.splice(index, 1)[0];
    this.emit('deviceDeleted', removed);
    return true;
  }

  startTelemetrySimulation() {
    // Subtle realistic fluctuations every 5 seconds
    this.telemetryInterval = setInterval(() => {
      const thermostat = this.getById('dev-001');
      if (thermostat && thermostat.status === 'online') {
        const delta = (Math.random() - 0.5) * 0.2;
        thermostat.state.currentTemp = parseFloat((thermostat.state.currentTemp + delta).toFixed(1));
      }

      const plug = this.getById('dev-004');
      if (plug && plug.status === 'online' && plug.state.power === 'on') {
        const deltaWatts = (Math.random() - 0.5) * 4;
        plug.state.currentWatts = Math.max(10, parseFloat((plug.state.currentWatts + deltaWatts).toFixed(1)));
      }

      const purifier = this.getById('dev-008');
      if (purifier && purifier.status === 'online') {
        purifier.state.pm25 = Math.max(2, Math.min(45, purifier.state.pm25 + Math.floor((Math.random() - 0.5) * 3)));
      }

      this.emit('telemetryTick', this.getSummary());
    }, 5000);
  }

  stopTelemetrySimulation() {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
    }
  }
}

module.exports = new DeviceManager();

