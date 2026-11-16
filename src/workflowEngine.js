const deviceManager = require('./devices');

class WorkflowEngine {
  constructor() {
    this.scenarios = [
      {
        id: 'scen-001',
        name: 'Night Motion Security Alert',
        description: 'When hallway motion sensor detects motion, turn on kitchen lights and lock front door',
        enabled: true,
        trigger: {
          type: 'device_state_change',
          deviceId: 'dev-010', // Hallway Motion Sensor
          property: 'motion',
          operator: '==',
          value: true
        },
        conditions: [
          {
            deviceId: 'dev-006', // Front Door Lock
            property: 'locked',
            operator: '==',
            value: false
          }
        ],
        actions: [
          {
            type: 'set_device_state',
            deviceId: 'dev-003', // Kitchen lights
            payload: { power: 'on', brightness: 100 }
          },
          {
            type: 'set_device_state',
            deviceId: 'dev-006', // Lock front door
            payload: { locked: true }
          },
          {
            type: 'send_alert',
            message: 'SECURITY ALERT: Motion detected in Hallway while door was unlocked! Kitchen lights turned ON and door LOCKED.'
          }
        ],
        lastTriggered: null,
        executionCount: 0
      },
      {
        id: 'scen-002',
        name: 'High Temperature Eco Cooling',
        description: 'If living room temperature exceeds 24°C, switch thermostat mode to cool and turn on air purifier',
        enabled: true,
        trigger: {
          type: 'device_state_change',
          deviceId: 'dev-001', // Thermostat
          property: 'currentTemp',
          operator: '>',
          value: 23.5
        },
        conditions: [
          {
            deviceId: 'dev-001',
            property: 'status',
            operator: '==',
            value: 'online'
          }
        ],
        actions: [
          {
            type: 'set_device_state',
            deviceId: 'dev-001',
            payload: { mode: 'cool', targetTemp: 21.0 }
          },
          {
            type: 'set_device_state',
            deviceId: 'dev-008', // Air purifier
            payload: { power: 'on', fanSpeed: 'level_3' }
          },
          {
            type: 'send_alert',
            message: 'CLIMATE ACTION: Living room temperature exceeded 23.5°C. Cooling mode activated.'
          }
        ],
        lastTriggered: null,
        executionCount: 0
      },
      {
        id: 'scen-003',
        name: 'Device Offline Guard',
        description: 'Whenever any security camera or lock goes offline, send an urgent notification',
        enabled: true,
        trigger: {
          type: 'device_status_change',
          operator: '==',
          value: 'offline'
        },
        conditions: [],
        actions: [
          {
            type: 'send_alert',
            message: 'DEVICE ALERT: A smart home device has transitioned to OFFLINE status.'
          }
        ],
        lastTriggered: null,
        executionCount: 0
      }
    ];

    this.logs = [];
    this.maxLogs = 50;

    // Listen to device manager events
    this.setupListeners();
  }

  setupListeners() {
    deviceManager.on('deviceUpdated', ({ device, action, diff, status }) => {
      this.evaluateTrigger({
        type: action === 'status_toggled' ? 'device_status_change' : 'device_state_change',
        device,
        diff,
        status: device.status
      });
    });
  }

  evaluateTrigger(event) {
    for (const scenario of this.scenarios) {
      if (!scenario.enabled) continue;

      const trigger = scenario.trigger;
      if (trigger.type !== event.type) continue;

      // Device specific check
      if (trigger.deviceId && trigger.deviceId !== event.device.id) continue;

      // Property check
      let triggerMatched = false;
      if (trigger.type === 'device_status_change') {
        triggerMatched = this.compare(event.status, trigger.operator, trigger.value);
      } else if (trigger.type === 'device_state_change' && event.diff) {
        if (trigger.property in event.diff) {
          const actualVal = event.diff[trigger.property];
          triggerMatched = this.compare(actualVal, trigger.operator, trigger.value);
        } else if (event.device.state && trigger.property in event.device.state) {
          const actualVal = event.device.state[trigger.property];
          triggerMatched = this.compare(actualVal, trigger.operator, trigger.value);
        }
      }

      if (triggerMatched) {
        // Evaluate conditions
        const conditionsMet = this.checkConditions(scenario.conditions);
        if (conditionsMet) {
          this.executeScenario(scenario, `Triggered by ${event.device.name} (${trigger.property || 'status'})`);
        }
      }
    }
  }

  checkConditions(conditions) {
    if (!conditions || conditions.length === 0) return true;

    for (const cond of conditions) {
      const targetDev = deviceManager.getById(cond.deviceId);
      if (!targetDev) return false;

      let val = null;
      if (cond.property === 'status') {
        val = targetDev.status;
      } else if (targetDev.state && cond.property in targetDev.state) {
        val = targetDev.state[cond.property];
      }

      if (!this.compare(val, cond.operator, cond.value)) {
        return false;
      }
    }

    return true;
  }

  compare(actual, operator, expected) {
    switch (operator) {
      case '==': return actual == expected;
      case '!=': return actual != expected;
      case '>': return Number(actual) > Number(expected);
      case '>=': return Number(actual) >= Number(expected);
      case '<': return Number(actual) < Number(expected);
      case '<=': return Number(actual) <= Number(expected);
      default: return actual == expected;
    }
  }

  executeScenario(scenario, reason = 'Automated Execution') {
    const executedActions = [];

    for (const act of scenario.actions) {
      if (act.type === 'set_device_state') {
        const updated = deviceManager.updateState(act.deviceId, act.payload);
        executedActions.push(`Updated ${updated ? updated.name : act.deviceId} state: ${JSON.stringify(act.payload)}`);
      } else if (act.type === 'send_alert') {
        executedActions.push(`ALERT: ${act.message}`);
      }
    }

    scenario.lastTriggered = new Date().toISOString();
    scenario.executionCount++;

    const logEntry = {
      id: 'log-' + Date.now(),
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      reason,
      executedActions,
      timestamp: new Date().toISOString()
    };

    this.logs.unshift(logEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    return logEntry;
  }

  getAll() {
    return this.scenarios;
  }

  getById(id) {
    return this.scenarios.find(s => s.id === id) || null;
  }

  getLogs() {
    return this.logs;
  }

  createScenario(payload) {
    const id = `scen-${String(this.scenarios.length + 1).padStart(3, '0')}`;
    const newScenario = {
      id,
      name: payload.name || `Custom Automation ${id}`,
      description: payload.description || 'User created workflow scenario',
      enabled: payload.enabled !== undefined ? payload.enabled : true,
      trigger: payload.trigger || {
        type: 'device_state_change',
        deviceId: 'dev-001',
        property: 'currentTemp',
        operator: '>',
        value: 25
      },
      conditions: payload.conditions || [],
      actions: payload.actions || [
        { type: 'send_alert', message: `Scenario ${id} triggered successfully.` }
      ],
      lastTriggered: null,
      executionCount: 0
    };

    this.scenarios.push(newScenario);
    return newScenario;
  }

  deleteScenario(id) {
    const idx = this.scenarios.findIndex(s => s.id === id);
    if (idx === -1) return false;
    this.scenarios.splice(idx, 1);
    return true;
  }

  toggleScenario(id) {
    const scen = this.getById(id);
    if (!scen) return null;
    scen.enabled = !scen.enabled;
    return scen;
  }
}

module.exports = new WorkflowEngine();

