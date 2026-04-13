---
description: 强制取消后台 Trae 任务
allowed-tools: Bash(kill)
---

# /trae:cancel

**Description:**
强制取消特定的后台 Trae 任务。

**Usage:**
```bash
/trae:cancel <Task ID>
```

**Internal Execution:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" cancel <Task ID>
```
