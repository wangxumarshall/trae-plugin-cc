---
description: Check if trae-cli is installed and guide initialization.
disable-model-invocation: true
allowed-tools: Bash(node:*), AskUserQuestion
---

Run setup to check Trae Agent installation:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup
```

Present the final setup output to the user.
