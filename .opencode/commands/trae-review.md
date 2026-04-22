---
description: Performs a standard professional code review on current Git changes. Automatically fetches git diff and submits to Trae Agent for review. Supports base branch override, background execution, and structured JSON output.
---

Execute a standard code review by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" review $ARGUMENTS
```

If no arguments are provided, it auto-detects the base branch and reviews all current changes.

Options:
- `--base <branch>`: Specify the base branch to compare against (default: auto-detect)
- `--background`: Run review in background for large changes
- `--yolo` / `-y`: Skip tool permission confirmations
- `--json`: Return structured JSON output
- `--session-id <id>`: Specify session ID

Example: `review`, `review --base develop`, `review --background`, `review --json`
