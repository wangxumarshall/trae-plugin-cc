---
description: Manages ACP (Agent Communication Protocol) server. Start/stop ACP server, discover agents, execute tasks or stream results via the ACP REST API.
---

Manage ACP protocol server by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" acp $ARGUMENTS
```

Actions:
- `start`: Start the ACP Server (trae-cli acp serve)
- `stop`: Stop the ACP Server
- `status`: Check server status
- `agents`: Discover available agents
- `run "task"`: Execute a task via ACP
- `stream "task"`: Stream a task execution (real-time output)

Options for `start`:
- `--yolo`: Skip tool permission confirmations
- `--allowed-tool <name>`: Allow specific tools
- `--disabled-tool <name>`: Disable specific tools

Example: `acp start`, `acp status`, `acp agents`, `acp run "analyze code quality"`
