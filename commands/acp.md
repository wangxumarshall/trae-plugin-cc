---
description: 通过 ACP 协议与 Trae Agent 交互
allowed-tools: Bash(trae-cli:*)
---

# /trae:acp

**Description:**
通过 ACP (Agent Communication Protocol) 与 Trae Agent 交互。启动/停止 ACP Server，发现可用 Agent，执行任务或流式获取结果。

**Usage:**
```bash
/trae:acp <action> [options]
```

**Actions:**
- `start`: 启动 ACP Server
- `stop`: 停止 ACP Server
- `status`: 查看服务器状态
- `agents`: 发现可用 Agent
- `run "任务"`: 通过 ACP 执行任务
- `stream "任务"`: 流式执行任务 (实时输出)

**Options (start):**
- `--yolo`: YOLO 模式，跳过工具权限确认
- `--allowed-tool <name>`: 允许的工具 (可多次指定)
- `--disabled-tool <name>`: 禁用的工具 (可多次指定)

**Examples:**
```bash
/trae:acp start
/trae:acp start --yolo
/trae:acp start --allowed-tool Bash --disabled-tool AskUserQuestion
/trae:acp stop
/trae:acp status
/trae:acp agents
/trae:acp run "分析代码质量"
/trae:acp stream "重构模块"
```

**Internal Execution:**
```bash
npx --yes trae-plugin-cc acp <action> [options]
```
