---
description: Fetch the results of a specific background task.
argument-hint: '<Task ID>'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Fetch task result:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" result $ARGUMENTS
```

Return the command stdout verbatim, exactly as-is.
