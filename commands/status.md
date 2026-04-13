---
description: 查看后台 Trae 任务状态
---

# /trae:status

**Description:**
查看当前或历史的后台 Trae 任务的状态。

**Usage:**
```bash
/trae:status
```

**Internal Execution:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" status
```
