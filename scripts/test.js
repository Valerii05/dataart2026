const assert = require('assert');
const deviceManager = require('../src/devices');
const workflowEngine = require('../src/workflowEngine');

console.log('Running test suite...');

async function runTests() {
  try {
    // 1. Devices initialization
    const all = deviceManager.getAll();
    assert.ok(all.length >= 10, 'Expected at least 10 initial devices');
    console.log(`- Loaded devices count: ${all.length} [OK]`);

    // 2. Summary stats & online count
    const summary = deviceManager.getSummary();
    assert.strictEqual(typeof summary.onlineDevices, 'number');
    assert.strictEqual(typeof summary.totalDevices, 'number');
    assert.ok(summary.onlineDevices > 0);
    console.log(`- Metrics: ${summary.onlineDevices}/${summary.totalDevices} online [OK]`);

    // 3. Filters
    const onlineOnly = deviceManager.getAll({ status: 'online' });
    assert.strictEqual(onlineOnly.length, summary.onlineDevices);
    const livingRoom = deviceManager.getAll({ room: 'Living Room' });
    assert.ok(livingRoom.length > 0);
    console.log('- Filters by status and room [OK]');

    // 4. State updates
    const thermostat = deviceManager.getById('dev-001');
    assert.ok(thermostat);
    const updated = deviceManager.updateState('dev-001', { targetTemp: 23.5 });
    assert.strictEqual(updated.state.targetTemp, 23.5);
    console.log('- State updates [OK]');

    // 5. Status toggle
    const beforeStatus = thermostat.status;
    deviceManager.toggleStatus('dev-001');
    assert.notStrictEqual(deviceManager.getById('dev-001').status, beforeStatus);
    deviceManager.toggleStatus('dev-001');
    console.log('- Device connectivity toggle [OK]');

    // 6. Workflow engine scenarios
    const scenarios = workflowEngine.getAll();
    assert.ok(scenarios.length >= 3);
    console.log(`- Loaded automations: ${scenarios.length} [OK]`);

    // 7. Manual trigger execution
    const testScen = scenarios[0];
    const log = workflowEngine.executeScenario(testScen, 'Test Execution');
    assert.strictEqual(log.scenarioId, testScen.id);
    assert.ok(log.executedActions.length > 0);
    console.log('- Automation execution & logging [OK]');

    deviceManager.stopTelemetrySimulation();

    console.log('\nAll tests passed.');
    process.exit(0);
  } catch (err) {
    console.error('\nTest error:', err.message);
    deviceManager.stopTelemetrySimulation();
    process.exit(1);
  }
}

runTests();
