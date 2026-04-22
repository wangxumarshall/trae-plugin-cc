---
description: Retrieves output logs for a specific background Trae task.
---

Get background task output by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" result $ARGUMENTS
```

Requires a task ID (from `trae-status` or `trae-run --background`).

Example: `result 1713700000000`
