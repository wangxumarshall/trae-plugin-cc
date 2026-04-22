---
description: Lists or queries Trae Agent session history. View session details, conversation history, tool call records, and full context summaries. Data sourced from trae-cli session files on disk.
---

Manage Trae Agent sessions by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" sessions $ARGUMENTS
```

Actions:
- `list`: List all sessions (default)
- `recent`: View the most recent session
- `detail <id>`: View session details
- `conversation <id>`: Get conversation history
- `tools <id>`: Get tool call records
- `context <id>`: Get full context summary
- `find <topic>`: Search sessions by topic
- `delete <id>`: Delete a session

Options:
- `--cwd <path>`: Filter by working directory
- `--limit <n>`: Limit number of results (default 20)

Example: `sessions list --limit 5`, `sessions detail 0d3cbdc3-e365-468e-982c-fb3d5849f5cc`, `sessions tools abc123`, `sessions find "refactor"`
