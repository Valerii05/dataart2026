# Smart Home Device Monitoring Dashboard

A real-time IoT device monitoring dashboard built with Node.js, Express, WebSockets, and Tailwind CSS. The dashboard tracks connectivity and telemetry across smart home devices, provides live metrics (including online device counts), and features an automation engine and Model Context Protocol (MCP) server.

## Features

- **Device Monitoring**:
  - Live device telemetry: status (online/offline), temperature, power usage (watts), air quality (PM2.5), camera feeds, and lock states.
  - Dedicated metric card for the **number of online devices** and connectivity ratio.
  - Device details: IP address, MAC address, battery percentage, firmware version, and room location.
  - Search and filter by status (online/offline), room, or device type.
  - Controls to adjust thermostat temperature, toggle lighting power, and toggle lock states.
  - One-click online/offline simulator to test dashboard state updates.

- **Real-Time Telemetry**:
  - WebSocket connection broadcasts live telemetry drift and status updates without reloading the page.

- **Automation Scenarios (Workflow Engine)**:
  - Rule-based scenario engine supporting triggers, conditions, and actions.
  - Pre-configured scenarios (motion security alerts, high-temp eco cooling, offline device notifications).
  - Web UI for creating, testing, and viewing execution logs.

- **AI Integration (MCP Server)**:
  - Model Context Protocol server (`src/mcp/server.js`) compliant with Claude Desktop and Cursor.
  - Exposes tools: `list_devices`, `get_device_status`, `control_device`, `get_system_summary`, `list_automations`, `trigger_automation`.
  - Built-in web tester for invoking MCP tools and viewing raw JSON responses.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/Valerii05/dataart2026.git
   cd dataart2026
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build and verify:
   ```bash
   npm run build
   ```

4. Run unit tests:
   ```bash
   npm test
   ```

5. Start the application:
   ```bash
   npm start
   ```

6. Open your browser:
   ```
   http://localhost:3000
   ```

## Connecting to Claude Desktop (MCP)

To connect an AI assistant using the Model Context Protocol:

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "smart-home": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/dataart2026/src/mcp/server.js"]
    }
  }
}
```

## API Endpoints

- `GET /api/summary` — Overview metrics (total, online, offline, alerts)
- `GET /api/devices` — Device list (supports `?status=`, `?room=`, `?type=`, `?search=`)
- `GET /api/devices/:id` — Device details by ID
- `PUT /api/devices/:id/state` — Update device state
- `POST /api/devices/:id/toggle-status` — Toggle device online/offline
- `POST /api/devices` — Add new device
- `DELETE /api/devices/:id` — Remove device
- `GET /api/scenarios` — List workflow scenarios
- `POST /api/scenarios/:id/trigger` — Execute scenario manually
- `GET /api/scenarios/logs` — Workflow execution logs
- `POST /api/mcp/call` — Execute MCP tool via HTTP

## License

MIT
