---
description: 管理 Trae Agent 会话历史与上下文
---

# /trae:sessions

**Description:**
列出或查询 trae-cli 的历史会话。可查看会话详情、对话历史、工具调用记录、完整上下文摘要。

**Usage:**
```bash
/trae:sessions <action> [options]
```

**Actions:**
- `list`: 列出所有会话 (默认)
- `recent`: 查看最近会话
- `detail <id>`: 查看会话详情
- `conversation <id>`: 获取对话历史
- `tools <id>`: 获取工具调用记录
- `context <id>`: 获取完整上下文摘要
- `find <topic>`: 按主题搜索会话
- `delete <id>`: 删除会话

**Options:**
- `--cwd <path>`: 按工作目录筛选 (list/recent)
- `--limit <n>`: 返回数量限制 (默认 20)

**Examples:**
```bash
/trae:sessions list --limit 5
/trae:sessions recent
/trae:sessions detail 0d3cbdc3-e365-468e-982c-fb3d5849f5cc
/trae:sessions conversation 0d3cbdc3-e365-468e-982c-fb3d5849f5cc --limit 10
/trae:sessions tools 0d3cbdc3-e365-468e-982c-fb3d5849f5cc
/trae:sessions context 0d3cbdc3-e365-468e-982c-fb3d5849f5cc
/trae:sessions find "重构"
/trae:sessions delete 0d3cbdc3-e365-468e-982c-fb3d5849f5cc
```

**Internal Execution:**
```bash
npx --yes trae-plugin-cc sessions <action> [options]
```
