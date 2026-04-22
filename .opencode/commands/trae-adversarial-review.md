---
description: Performs an adversarial code review. The Trae Agent aggressively looks for flaws, questions assumptions, and identifies security vulnerabilities, performance bottlenecks, logic errors, and best-practice violations.
---

Execute an adversarial code review by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" adversarial-review $ARGUMENTS
```

Options:
- `--base <branch>`: Specify the base branch (default: auto-detect)
- `--background`: Run in background
- `--yolo` / `-y`: YOLO mode
- `--json`: Structured JSON output
- `--session-id <id>`: Specify session ID

Example: `adversarial-review`, `adversarial-review --base develop`, `adversarial-review --background`
