---
description: Forcibly cancel an active background Trae job.
argument-hint: '<Task ID>'
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

Cancel the task:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" cancel $ARGUMENTS
```

Return the command stdout verbatim, exactly as-is.
