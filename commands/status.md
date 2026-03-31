---
description: Shows running and recent Trae background jobs for the current repository.
argument-hint: '[task-id]'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Run status command to check background jobs:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" status $ARGUMENTS
```

Return the command stdout verbatim, exactly as-is.
