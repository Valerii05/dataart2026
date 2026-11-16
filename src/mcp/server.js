const { Server } = require('@modelcontextprotocol/sdk/server');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const deviceManager = require('../devices');
const workflowEngine = require('../workflowEngine');

function createMcpServer() {
  const server = new Server(
    {
      name: 'smart-home-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_devices',
          description: 'Find and list available smart home devices with real-time status and telemetry. Supports filtering by status (online/offline), room, or device type.',
          inputSchema: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                enum: ['all', 'online', 'offline'],
                description: 'Filter by device connectivity status'
              },
              room: {
                type: 'string',
                description: 'Filter by room (e.g. "Living Room", "Kitchen", "Entrance", "Master Bedroom")'
              },
              type: {
                type: 'string',
                description: 'Filter by device type (e.g. "thermostat", "camera", "lighting", "plug", "lock", "sensor", "air_purifier")'
              },
              search: {
                type: 'string',
                description: 'Keyword search across device names, rooms, and IDs'
              }
            }
          }
        },
        {
          name: 'get_device_status',
          description: 'Retrieve real-time telemetry, power usage, battery, and state for a specific smart home device by ID.',
          inputSchema: {
            type: 'object',
            required: ['device_id'],
            properties: {
              device_id: {
                type: 'string',
                description: 'The unique device ID (e.g. "dev-001", "dev-006")'
              }
            }
          }
        },
        {
          name: 'control_device',
          description: 'Execute an action or update state on a smart home device (power on/off, adjust temperature, lock/unlock, brightness).',
          inputSchema: {
            type: 'object',
            required: ['device_id', 'action'],
            properties: {
              device_id: {
                type: 'string',
                description: 'The target device ID'
              },
              action: {
                type: 'string',
                description: 'Action to perform: "set_power", "set_temperature", "set_lock", "set_brightness", "toggle_status"'
              },
              value: {
                description: 'Action value (boolean for power/lock, number for temperature/brightness, string for mode)'
              }
            }
          }
        },
        {
          name: 'get_system_summary',
          description: 'Get high-level dashboard metrics: total devices, number of online devices, offline count, and active alerts.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'list_automations',
          description: 'List all smart home workflow scenarios, active triggers, conditions, and execution history.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'trigger_automation',
          description: 'Manually execute a specific automation workflow scenario by its scenario ID.',
          inputSchema: {
            type: 'object',
            required: ['scenario_id'],
            properties: {
              scenario_id: {
                type: 'string',
                description: 'Scenario ID to execute (e.g. "scen-001")'
              }
            }
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'list_devices') {
        const devices = deviceManager.getAll(args || {});
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(devices, null, 2)
            }
          ]
        };
      }

      if (name === 'get_device_status') {
        const device = deviceManager.getById(args.device_id);
        if (!device) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Device with ID '${args.device_id}' was not found.` }]
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(device, null, 2) }]
        };
      }

      if (name === 'control_device') {
        const device = deviceManager.getById(args.device_id);
        if (!device) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Device with ID '${args.device_id}' not found.` }]
          };
        }

        if (device.status === 'offline' && args.action !== 'toggle_status') {
          return {
            isError: true,
            content: [{ type: 'text', text: `Cannot control '${device.name}': device is currently OFFLINE.` }]
          };
        }

        let updatedState = {};
        switch (args.action) {
          case 'set_power':
            updatedState = { power: args.value ? 'on' : 'off' };
            deviceManager.updateState(device.id, updatedState);
            break;
          case 'set_temperature':
            updatedState = { targetTemp: Number(args.value) };
            deviceManager.updateState(device.id, updatedState);
            break;
          case 'set_lock':
            updatedState = { locked: Boolean(args.value) };
            deviceManager.updateState(device.id, updatedState);
            break;
          case 'set_brightness':
            updatedState = { brightness: Math.min(100, Math.max(0, Number(args.value))) };
            deviceManager.updateState(device.id, updatedState);
            break;
          case 'toggle_status':
            deviceManager.toggleStatus(device.id);
            break;
          default:
            if (typeof args.value === 'object') {
              deviceManager.updateState(device.id, args.value);
            } else {
              return {
                isError: true,
                content: [{ type: 'text', text: `Unknown action '${args.action}'.` }]
              };
            }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Successfully executed action '${args.action}' on device '${device.name}'.`,
                device: deviceManager.getById(device.id)
              }, null, 2)
            }
          ]
        };
      }

      if (name === 'get_system_summary') {
        const summary = deviceManager.getSummary();
        return {
          content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }]
        };
      }

      if (name === 'list_automations') {
        const scenarios = workflowEngine.getAll();
        return {
          content: [{ type: 'text', text: JSON.stringify(scenarios, null, 2) }]
        };
      }

      if (name === 'trigger_automation') {
        const scen = workflowEngine.getById(args.scenario_id);
        if (!scen) {
          return {
            isError: true,
            content: [{ type: 'text', text: `Scenario '${args.scenario_id}' not found.` }]
          };
        }
        const result = workflowEngine.executeScenario(scen, 'Triggered via MCP Tool Call');
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        };
      }

      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }]
      };
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Tool error: ${err.message}` }]
      };
    }
  });

  return server;
}

// Standalone execution via stdio
if (require.main === module) {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error('Smart Home MCP Server running on stdio');
  }).catch((err) => {
    console.error('Failed to start MCP server:', err);
    process.exit(1);
  });
}

module.exports = { createMcpServer };

