---
description: Force-cancels a running background Trae task.
---

Cancel a background task by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" cancel $ARGUMENTS
```

Requires a task ID. The task process will be force-killed (SIGKILL).

Example: `cancel 1713700000000`
