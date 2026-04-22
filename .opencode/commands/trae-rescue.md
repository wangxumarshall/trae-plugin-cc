---
description: Diagnoses failed Trae tasks and suggests recovery. Collects recent error logs, git status, and recent commits before submitting to Trae Agent for analysis.
---

Run fault diagnosis by:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" rescue $ARGUMENTS
```

Options:
- `--context <text>`: Additional context for diagnosis
- `--retries <n>`: Max retries (default: 3)
- `--force`: Skip confirmations

The rescue command will:
1. Collect recent error logs from .claude-trae-plugin/
2. Gather current git status
3. Analyze recent commits
4. Submit diagnostic prompt to Trae Agent
5. Display recovery suggestions
