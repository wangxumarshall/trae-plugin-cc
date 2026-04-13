---
description: 将任务委托给 Trae Agent 执行
allowed-tools: Bash(trae-cli:*)
---

# /trae:run

**Description:**
将任务描述直接交给 Trae Agent (`trae-cli`) 执行。支持会话恢复、工具控制、结构化输出、隔离工作树等高级选项。

**Usage:**
```bash
/trae:run "自然语言任务描述" [options]
```

**Options:**
- `--background`: 将任务放到后台运行
- `--json`: 返回结构化 JSON 输出 (含 session_id)
- `--yolo` / `-y`: YOLO 模式，跳过工具权限确认
- `--resume [SESSION_ID]`: 恢复会话，不指定 ID 则自动恢复最近会话
- `--session-id <id>`: 指定新会话 ID
- `--worktree [NAME]` / `-w`: 在隔离的 git worktree 中工作
- `--allowed-tool <name>`: 自动批准的工具 (可多次指定)
- `--disallowed-tool <name>`: 自动拒绝的工具 (可多次指定)
- `--query-timeout <duration>`: 单次查询超时 (如 30s, 5m)
- `--bash-tool-timeout <duration>`: Bash 工具超时
- `--inject-context <session-id>`: 注入指定会话的上下文到 prompt 中
- `-c k=v`: 覆盖配置项 (可多次指定)

**Examples:**
```bash
/trae:run "重构用户模块"
/trae:run "修复bug" --yolo
/trae:run "生成文档" --background
/trae:run "分析项目" --json
/trae:run "继续任务" --resume
/trae:run "继续" --resume 0d3cbdc3-e365-468e-982c-fb3d5849f5cc
/trae:run "实验性修改" --worktree
/trae:run "执行脚本" --allowed-tool Bash --allowed-tool Edit
/trae:run "长任务" --query-timeout 5m
/trae:run "继续优化" --inject-context 0d3cbdc3-e365-468e-982c-fb3d5849f5cc
```

**Internal Execution:**
```bash
npx --yes trae-plugin-cc run "任务描述" [options]
```
