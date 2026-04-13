---
description: 当任务失败时，使用 Trae Agent 分析问题并提供恢复建议
allowed-tools: Bash(git:*), Bash(trae-cli:*)
---

# /trae:rescue

**Description:**
当任务执行失败时，使用 Trae Agent 进行故障诊断。它会收集最近的错误日志、Git 状态等信息，并让 Trae 分析问题原因和恢复建议。

**Usage:**
```bash
/trae:rescue [--context "额外信息"] [--retries 3] [--force]
```

**Options:**
- `--context <text>`: 提供额外的上下文信息帮助诊断
- `--retries <n>`: 最大重试次数 (默认: 3)
- `--force`: 跳过确认直接执行恢复操作

**Internal Execution:**
```bash
npx --yes trae-plugin-cc rescue [--context <text>] [--retries <n>] [--force]
```