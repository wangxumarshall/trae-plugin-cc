---
description: 获取后台 Trae 任务输出
---

# /trae:result

**Description:**
获取特定后台 Trae 任务的输出日志。

**Usage:**
```bash
/trae:result <Task ID>
```

**Internal Execution:**
```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" result <Task ID>
```
