---
description: Checks trae-cli installation status and authentication state. Guides initial setup for first-time users.
---

Check Trae Agent CLI status by running:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" setup
```

This verifies:
- Whether trae-cli is installed
- Authentication status (reads ~/.trae/trae_cli.yaml)
- Current model configuration
- Allowed tools and installed plugins

Run this before first use to ensure everything is configured correctly.
