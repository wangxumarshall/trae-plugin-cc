# trae-plugin-cc

trae-plugin-cc支持在 **Claude Code** 和 **OpenCode**中无缝调用trae-cli，提供任务委托、代码审查、会话管理、ACP 协议通信等功能，实现跨框架一致的 AI Agent 协作体验。

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         trae-plugin-cc                               │
│                                                                      │
│  ┌─────────────────────┐              ┌──────────────────────────┐  │
│  │   Claude Code       │              │      OpenCode            │  │
│  ├─────────────────────┤              ├──────────────────────────┤  │
│  │ ① 斜杠命令           │              │ ① Bun 工具 (9个)          │  │
│  │    commands/*.md     │              │    .opencode/tools/*.ts  │  │
│  │ ② MCP 工具 (4个)     │              │ ② 命令文档 (10个)         │  │
│  │    .mcp.json         │              │    .opencode/commands/   │  │
│  │ ③ 生命周期钩子       │              │ ③ 事件钩子                │  │
│  │    hooks/hooks.json  │              │    .opencode/plugins/    │  │
│  └──────────┬──────────┘              └──────────┬───────────────┘  │
│             │                                     │                  │
│  ┌──────────▼─────────────────────────────────────▼──────────────┐  │
│  │              Core CLI (src/ → dist/index.js)                   │  │
│  │  run | review | sessions | acp | setup | status | result |    │  │
│  │  cancel | rescue | hooks                                       │  │
│  └──────────────────────────┬────────────────────────────────────┘  │
│                             │                                        │
│  ┌──────────────────────────▼────────────────────────────────────┐  │
│  │              TraeExecutor → trae-cli 子进程                    │  │
│  │          (继承 OAuth2 auth token, 无需额外 API Key)             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 功能概览

| 功能 | 说明 | Claude Code | OpenCode |
|------|------|:-----------:|:--------:|
| 任务执行 | 自然语言任务委托，支持 YOLO、恢复、worktree | ✅ `/trae:run` + MCP | ✅ `trae-run` 工具 |
| 代码审查 | git diff 自动审查，支持标准/对抗性模式 | ✅ `/trae:review` + MCP | ✅ `trae-review` 工具 |
| 会话管理 | 历史会话查询、对话历史、工具调用、上下文摘要 | ✅ `/trae:sessions` + MCP | ✅ `trae-sessions` 工具 |
| ACP 协议 | JSON-RPC over STDIO，Agent 间协作 | ✅ `/trae:acp` + MCP | ✅ `trae-acp` 工具 |
| 后台任务 | 长时间任务后台执行，状态查询、结果获取、取消 | ✅ `/trae:status` 等 | ✅ `trae-status` 等 |
| 故障恢复 | 分析失败任务并提供诊断建议 | ✅ `/trae:rescue` | ✅ `trae-rescue` 工具 |
| 环境检查 | trae-cli 安装验证、认证状态检查 | ✅ `/trae:setup` | ✅ `trae-setup` 工具 |
| 生命周期钩子 | SessionStart/SessionEnd/Stop 自动触发 | ✅ hooks.json | ✅ .opencode/plugins/ |

## 前置条件

- [trae-cli](https://docs.trae.cn/cli) 已安装并完成 auth 认证

```bash
# 验证 trae-cli 是否可用
trae-cli --help

# 验证认证状态（需看到模型名称和登录地址）
cat ~/.trae/trae_cli.yaml
```

## 安装

### Claude Code 安装

#### 方式 1: Marketplace 安装（推荐）

```bash
# 添加 Marketplace
claude plugin marketplace add https://github.com/wangxumarshall/trae-plugin-cc

# 安装插件
claude plugin install trae

# 验证安装
claude plugin list | grep trae
```

安装范围选项：
- `--scope user`（默认）: 全局可用
- `--scope project`: 仅当前项目可用
- `--scope local`: 仅当前会话可用

#### 方式 2: 本地目录安装

```bash
git clone https://github.com/wangxumarshall/trae-plugin-cc.git
cd trae-plugin-cc
npm install
npm run build

# 添加本地 Marketplace
claude plugin marketplace add /path/to/trae-plugin-cc
claude plugin install trae
```

### OpenCode 安装

```bash
git clone https://github.com/wangxumarshall/trae-plugin-cc.git
cd trae-plugin-cc
npm install
npm run build

# 安装 OpenCode 插件依赖
cd .opencode && npm install && cd ..
```

OpenCode 会自动发现 `.opencode/tools/` 下的工具和 `.opencode/commands/` 下的命令定义。

## 安装后验证

```bash
# 验证 trae-cli 认证
node dist/index.js setup
```

预期输出：
```
✅ trae-cli 已安装并可用！

## 认证状态
  已认证: ✅
  配置文件: ~/.trae/trae_cli.yaml (存在)
  模型: GLM-5
  登录地址: https://console.enterprise.trae.cn

## ACP/MCP 服务
  ACP Server: trae-cli acp serve
  MCP Server: trae-cli mcp serve
```

## 使用指南

### Claude Code 使用

#### 斜杠命令（用户主动触发）

```bash
# 执行任务
/trae:run "重构用户认证模块"

# YOLO 模式（跳过工具确认）
/trae:run "修复登录bug" --yolo

# 代码审查
/trae:review

# 对抗性审查
/trae:adversarial-review

# 恢复会话
/trae:run "继续之前的任务" --resume

# 会话管理
/trae:sessions list
/trae:sessions detail <session-id>

# ACP 协议
/trae:acp run "分析代码质量"
/trae:acp stream "实时分析"
```

#### MCP 工具（AI 自主决策）

插件安装后，`.mcp.json` 中定义的 4 个 MCP 工具自动注册，Claude AI 根据上下文自主调用：

| 工具 | 说明 | 触发场景 |
|------|------|---------|
| `trae_run` | 执行任务 | "用 Trae 重构这个模块" |
| `trae_review` | 代码审查 | "帮我审查当前变更" |
| `trae_sessions` | 会话管理 | "我之前用 Trae 做了什么？" |
| `trae_acp` | ACP 协议 | "通过 ACP 分析代码质量" |

#### 生命周期钩子

| 钩子 | 触发时机 | 行为 |
|------|---------|------|
| `SessionStart` | Claude Code 启动 | 检查 trae-cli 状态，提醒后台任务 |
| `SessionEnd` | Claude Code 退出 | 清理过期日志，提醒运行中的后台任务 |
| `Stop` | 用户停止操作 | 检测未提交变更，建议代码审查 |
| `PostToolUse` | 执行 `/trae:review` 后 | 记录审查结果 |

### OpenCode 使用

#### Bun 工具（9 个）

OpenCode Agent 可直接调用这些工具：

| 工具 | CLI 命令 | 功能 |
|------|----------|------|
| `trae-setup` | `setup` | 检查 trae-cli 安装和认证 |
| `trae-run` | `run` | 执行自然语言任务 |
| `trae-review` | `review` / `adversarial-review` | 代码审查 |
| `trae-sessions` | `sessions` | 会话管理（支持 9 种动作） |
| `trae-acp` | `acp` | ACP 协议管理 |
| `trae-status` | `status` | 后台任务状态 |
| `trae-result` | `result` | 获取后台任务输出 |
| `trae-cancel` | `cancel` | 取消后台任务 |
| `trae-rescue` | `rescue` | 故障恢复诊断 |

#### 命令文档（10 个）

`.opencode/commands/` 下的 Markdown 文件为 Agent 提供可直接执行的指令：

- `trae-run.md` — 任务执行命令定义
- `trae-review.md` — 代码审查
- `trae-adversarial-review.md` — 对抗性审查
- `trae-sessions.md` — 会话管理
- `trae-acp.md` — ACP 协议
- `trae-setup.md` — 环境检查
- `trae-status.md` — 后台任务状态
- `trae-result.md` — 获取任务结果
- `trae-cancel.md` — 取消任务
- `trae-rescue.md` — 故障恢复

#### 事件钩子

`.opencode/plugins/trae-hooks.ts` 将 OpenCode 事件映射为插件钩子：
- `session.created` → SessionStart 钩子
- `session.deleted` / `server.instance.disposed` → SessionEnd 钩子

## 功能详解

### 1. 任务执行

```bash
/trae:run "任务描述" [options]          # Claude Code
# 或 OpenCode Agent 调用 trae-run 工具
```

| 选项 | 缩写 | 说明 |
|------|------|------|
| `--yolo` | `-y` | YOLO 模式，跳过工具确认 |
| `--background` | | 后台执行 |
| `--json` | | 结构化 JSON 输出（含 session_id） |
| `--resume [ID]` | | 恢复会话 |
| `--worktree [NAME]` | `-w` | 隔离 git worktree |
| `--allowed-tool <name>` | | 自动批准的工具 |
| `--disallowed-tool <name>` | | 自动拒绝的工具 |
| `--inject-context <id>` | | 注入其他会话上下文 |
| `--query-timeout <dur>` | | 单次查询超时 |
| `-c k=v` | | 覆盖配置项 |

### 2. 代码审查

```bash
/trae:review [options]                  # 标准审查
/trae:adversarial-review [options]      # 对抗性审查
# 或 OpenCode Agent 调用 trae-review 工具 (adversarial=true)
```

- 自动检测基准分支（main/master/develop）
- 自动估算变更规模，大型变更建议后台模式
- 对抗性模式：极度严苛，专门挑刺和质疑假设

### 3. 会话管理

```bash
/trae:sessions <action> [options]       # Claude Code
# 或 OpenCode Agent 调用 trae-sessions 工具
```

| 动作 | 说明 | 参数 |
|------|------|------|
| `list` | 列出会话 | `--cwd`, `--limit` |
| `recent` | 最近会话 | `--limit` |
| `detail` | 会话详情 | `--session-id` |
| `conversation` | 对话历史 | `--session-id`, `--limit` |
| `tools` | 工具调用记录 | `--session-id` |
| `context` | 上下文摘要 | `--session-id` |
| `find` | 按主题搜索 | `--topic` |
| `delete` | 删除会话 | `--session-id` |
| `delete-smoke` | 批量删除 smoke 会话 | — |

### 4. ACP 协议通信

ACP 使用 **JSON-RPC over STDIO**（标准协议），非 HTTP 服务。

```bash
/trae:acp <action> [options]            # Claude Code
# 或 OpenCode Agent 调用 trae-acp 工具
```

| 动作 | 说明 |
|------|------|
| `run "任务"` | 通过 ACP 执行任务 |
| `stream "任务"` | 流式执行（实时输出） |
| `agents` | 发现可用 Agent |
| `status` | 查看状态 |

### 5. 后台任务管理

```bash
/trae:status                             # 查看所有后台任务
/trae:result <task-id>                   # 获取任务结果
/trae:cancel <task-id>                   # 取消任务
# 或 OpenCode Agent 调用 trae-status / trae-result / trae-cancel
```

### 6. 故障恢复

```bash
/trae:rescue [--context TEXT]            # Claude Code
# 或 OpenCode Agent 调用 trae-rescue 工具
```

分析失败任务，收集错误日志和 git 状态，提交给 Trae Agent 诊断。

## 上下文获取路径

| 路径 | 方式 | 适用场景 |
|------|------|---------|
| 文件系统直读 | `~/Library/Caches/trae_cli/sessions/` | 查询历史会话 |
| 结构化输出 | `trae-cli -p --json` | 执行任务并追踪 |
| ACP STDIO | `trae-cli acp serve` (JSON-RPC) | 跨框架 Agent 协作 |

## 项目结构

```
trae-plugin-cc/
├── .claude-plugin/          # Claude Code 插件声明
│   ├── plugin.json
│   └── marketplace.json
├── .mcp.json                # 4 个 MCP 工具定义
├── commands/                # Claude Code 斜杠命令定义 (*.md)
├── hooks/
│   └── hooks.json           # Claude Code 生命周期钩子
├── scripts/                 # 钩子脚本 (*.mjs)
├── src/                     # 核心 CLI 源码 (TypeScript)
│   ├── index.ts             # CLI 入口
│   ├── commands/            # 命令处理器
│   └── utils/               # 工具类
│       ├── trae-executor.ts       # 子进程执行器
│       ├── session-reader.ts      # 会话读取器
│       ├── acp-server-manager.ts  # ACP 服务器管理 (STDIO JSON-RPC)
│       ├── acp-client.ts          # ACP 客户端 (JSON-RPC)
│       ├── auth-bridge.ts         # 认证桥接
│       ├── context-bridge.ts      # 上下文注入
│       └── branch-detection.ts    # Git 分支检测
├── .opencode/               # OpenCode 集成
│   ├── tools/               # 9 个 Bun 工具 (*.ts)
│   ├── commands/            # 10 个命令文档 (*.md)
│   ├── plugins/             # 事件钩子
│   └── package.json         # OpenCode 依赖
└── tests/                   # Jest 测试用例
```

## 开发

```bash
# 编译（修改 src/ 后必须执行）
npm run build

# 测试
npm test

# 安装 OpenCode 依赖（仅首次）
cd .opencode && npm install && cd ..

# 验证插件 (Claude Code)
claude plugin validate /path/to/trae-plugin-cc
```

### ⚠️ 编译规则

修改任何 `src/*.ts` 文件后必须运行 `npm run build`，因为运行时入口是 `dist/index.js`（esbuild 打包）。

| 命令 | 输出 | 用途 |
|------|------|------|
| `npm run build` | `dist/index.js` (打包) | **运行时 CLI** (`node dist/index.js`) |
| `npm run build:tsc` | `dist/**/*.js` (分离文件) | 直接模块导入 |

### OpenCode 开发注意事项

- `.opencode/tools/*.ts` 使用 **Bun** 运行时，**无需编译**
- `.opencode/commands/*.md` 为 Agent 提供可读指令
- 修改 `.opencode/plugins/trae-hooks.ts` 后重启 OpenCode 即可
- **但**：OpenCode 工具内部调用 `dist/index.js`，所以修改 `src/` 仍需 `npm run build`

## 全量命令参考

### 1. `setup` — 检查 trae-cli 安装与认证状态

```bash
/trae:setup
```

| 参数 | 说明 |
|------|------|
| 无 | 无参数 |

---

### 2. `run` — 委托任务给 Trae Agent

```bash
/trae:run "任务描述" [options]
```

| 参数 | 简写 | 说明 |
|------|------|------|
| `<prompt>` | 位置参数 | 任务描述（必需） |
| `--background` | | 后台执行 |
| `--json` | | 返回结构化 JSON 输出 |
| `--yolo` | `-y` | YOLO 模式，跳过工具确认 |
| `--resume <id>` | | 恢复指定会话 |
| `--resume` / `--resume=AUTO` | | 自动恢复最近会话 |
| `--session-id <id>` | | 指定新会话 ID |
| `--worktree <name>` | `-w` | 使用指定 git worktree |
| `--worktree` / `-w` | | 自动生成 worktree (`__auto__`) |
| `--allowed-tool <tool>` | | 自动批准工具（可多次使用） |
| `--disallowed-tool <tool>` | | 自动拒绝工具（可多次使用） |
| `--query-timeout <duration>` | | 查询超时，如 `30s`, `5m` |
| `--bash-tool-timeout <duration>` | | Bash 工具超时 |
| `-c <key=value>` | | 配置覆盖（可多次使用） |
| `--inject-context <session-id>` | | 注入指定会话上下文 |

---

### 3. `review` — 标准代码审查

```bash
/trae:review [options]
```

| 参数 | 简写 | 说明 |
|------|------|------|
| `--base <branch>` | | 基准分支（默认自动检测） |
| `--background` | | 后台执行 |
| `--yolo` | `-y` | YOLO 模式 |
| `--json` | | 结构化 JSON 输出 |
| `--session-id <id>` | | 指定会话 ID |

---

### 4. `adversarial-review` — 对抗性审查

```bash
/trae:adversarial-review [options]
```

| 参数 | 简写 | 说明 |
|------|------|------|
| `--base <branch>` | | 基准分支（默认自动检测） |
| `--background` | | 后台执行 |
| `--yolo` | `-y` | YOLO 模式 |
| `--json` | | 结构化 JSON 输出 |
| `--session-id <id>` | | 指定会话 ID |

---

### 5. `status` — 查看后台任务状态

```bash
/trae:status
```

| 参数 | 说明 |
|------|------|
| 无 | 无参数 |

---

### 6. `result` — 查看后台任务输出

```bash
/trae:result <task_id>
```

| 参数 | 说明 |
|------|------|
| `<task_id>` | 任务 ID（必需） |

---

### 7. `cancel` — 强制取消后台任务

```bash
/trae:cancel <task_id>
```

| 参数 | 说明 |
|------|------|
| `<task_id>` | 任务 ID（必需） |

---

### 8. `sessions` — 历史会话管理

```bash
/trae:sessions <action> [options]
```

| action | 参数 | 说明 |
|--------|------|------|
| `list` | `--cwd <dir>`, `--limit <n>` | 列出会话（默认 20） |
| `recent` | `--cwd <dir>` | 最近会话 |
| `detail <id>` | `<session-id>` | 会话详情 |
| `conversation <id>` | `<session-id>`, `--limit <n>` | 对话历史（默认 50） |
| `tools <id>` | `<session-id>` | 工具调用记录 |
| `context <id>` | `<session-id>` | 上下文摘要 |
| `find <topic>` | `<topic>` | 按主题搜索 |
| `delete <id>` | `<session-id>` | 删除会话 |
| `delete-smoke` | 无 | 删除含 "smoke" 的会话 |

---

### 9. `acp` — ACP 协议交互

```bash
/trae:acp <action> [options]
```

| action | 参数 | 说明 |
|--------|------|------|
| `start` | `--yolo`, `--allowed-tool`, `--disabled-tool` | 启动 ACP Server |
| `stop` | 无 | 停止 ACP Server |
| `status` | 无 | 查看状态 |
| `agents` | 无 | 发现可用 Agent |
| `run <prompt>` | `<prompt>` | 执行任务 |
| `stream <prompt>` | `<prompt>` | 流式执行任务 |

---

### 10. `rescue` — 故障诊断

```bash
/trae:rescue [options]
```

| 参数 | 说明 |
|------|------|
| `--context <text>` | 提供附加上下文 |

---

### 11. `hooks` — 生命周期钩子（内部使用）

```bash
/trae:hooks <type>
```

| 参数 | 说明 |
|------|------|
| `session-start` | 会话开始 |
| `session-end` | 会话结束 |
| `stop-gate` | 停止拦截门控 |

## License

MIT
