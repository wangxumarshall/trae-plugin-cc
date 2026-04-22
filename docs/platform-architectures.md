# Claude Code 与 OpenCode trae-plugin插件架构解析

## 目录

1. [两大平台的定位差异](#1-两大平台的定位差异)
2. [插件发现与注册机制](#2-插件发现与注册机制)
3. [命令系统：Slash Commands vs Bun Tools](#3-命令系统slash-commands-vs-bun-tools)
4. [工具协议：MCP (JSON Schema) vs Bun Tool (Zod + TypeScript)](#4-工具协议mcp-json-schema-vs-bun-tool-zod--typescript)
5. [生命周期钩子：hooks.json vs Plugin Event System](#5-生命周期钩子hooksjson-vs-plugin-event-system)
6. [命令文档：用户帮助 vs Agent 上下文](#6-命令文档用户帮助-vs-agent-上下文)
7. [安全模型：allowed-tools vs 无显式权限声明](#7-安全模型allowed-tools-vs-无显式权限声明)
8. [运行时与进程模型](#8-运行时与进程模型)
9. [本项目的统一架构设计](#9-本项目的统一架构设计)
10. [完整对比矩阵](#10-完整对比矩阵)

---

## 1. 两大平台的定位差异

### Claude Code：AI 辅助编程终端

Claude Code 是 Anthropic 的命令行 AI 编程工具，采用 **插件 + Skill + Agent + Hook + MCP** 多维扩展体系。其核心特征：

- **用户交互界面是 TUI**（终端用户界面），用户通过 `/` 开头的斜杠命令触发功能
- **AI 自主调用**通过 MCP（Model Context Protocol）协议实现
- **Skill 系统**为 AI 提供可自动匹配的上下文注入能力
- 所有扩展组件通过 **文件发现**（约定目录结构）自动加载

### OpenCode：AI 编程框架

OpenCode 是基于 Bun 运行的 AI 编程框架，采用 **Plugin（TypeScript 模块）** 扩展体系。其核心特征：

- **Plugin 是纯 TypeScript 模块**，`export` 标准接口（Plugin、Tool、Hook）
- 通过 `@opencode-ai/plugin` SDK 提供类型安全的工厂函数（`tool()`）
- **Plugin 工厂函数本质是类型包装器** — `tool()` 内部直接返回输入对象（passthrough）
- **所有能力统一在一个 Plugin 模块**中（tools、hooks、auth、provider、chat.* 等）
- 工具发现通过 **Bun 自动扫描** `.opencode/tools/*.ts` 的 `export default tool(...)`

---

## 2. 插件发现与注册机制

### Claude Code：声明式文件发现

```
my-plugin/
├── .claude-plugin/plugin.json    ← 插件清单（必需）
├── commands/*.md                 ← Slash Commands（文件即命令）
├── .mcp.json                     ← MCP 工具注册
├── hooks/hooks.json              ← 生命周期钩子
├── skills/                       ← AI Skills
├── agents/                       ← 自定义 Agent
├── .lsp.json                     ← LSP 服务器配置
├── monitors/monitors.json        ← 后台监控
├── bin/                          ← PATH 扩展
└── settings.json                 ← 默认设置
```

**核心机制**：
- `.claude-plugin/plugin.json` 定义插件身份（name、description、version）— 仅此文件在 `.claude-plugin/` 下
- 所有其他目录位于 **插件根级别**
- Claude Code 扫描目录结构，根据文件名和目录约定自动注册
- 技能名被 `name` 字段命名空间化（如 `/my-plugin:hello`）
- Marketplace 安装时以 git URL 或本地路径为源

**plugin.json 格式**：
```json
{
  "name": "trae",
  "description": "在 Claude Code 中直接调用字节 Trae Agent (trae-cli) 做代码审查或任务委托",
  "version": "1.0.0",
  "author": { "name": "wangxumarshall" },
  "repository": "https://github.com/wangxumarshall/trae-plugin-cc"
}
```

### OpenCode：命令式 TypeScript 模块

```
.opencode/
├── tools/trae-*.ts           ← Bun 工具 (export default tool({...}))
├── commands/trae-*.md        ← 命令描述 (YAML frontmatter + Markdown)
├── plugins/trae-hooks.ts    ← 生命周期插件 (export const X: Plugin)
└── package.json              ← 依赖 (@opencode-ai/plugin)
```

**核心机制**：
- 无独立 `plugin.json` — 插件身份由 TypeScript 模块的 `export` 名称决定
- `@opencode-ai/plugin` SDK 提供类型工厂：

```typescript
// @opencode-ai/plugin/dist/tool.d.ts
export type ToolResult = string | {
    output: string;
    metadata?: Record<string, any>;
};

export declare function tool<Args extends z.ZodRawShape>(input: {
    description: string;
    args: Args;
    execute(args: z.infer<z.ZodObject<Args>>, context: ToolContext): Promise<ToolResult>;
}): { description: string; args: Args; execute(...): Promise<ToolResult> };
```

- `tool()` 内部是 **纯 passthrough**（直接返回输入对象），真正的注册由 OpenCode 主机完成
- 框架扫描 `.opencode/tools/*.ts` 的默认导出，根据文件名派生工具名（`trae-run.ts` → `trae-run`）

**Plugin 类型**：
```typescript
export type PluginInput = {
    client: ReturnType<typeof createOpencodeClient>;
    project: Project;
    directory: string;
    worktree: string;
    experimental_workspace: { register(type: string, adaptor: WorkspaceAdaptor): void };
    serverUrl: URL;
    $: BunShell;
};

export type Plugin = (input: PluginInput, options?: PluginOptions) => Promise<Hooks>;

export interface Hooks {
    event?: (input: { event: Event }) => Promise<void>;
    config?: (input: Config) => Promise<void>;
    tool?: { [key: string]: ToolDefinition };
    auth?: AuthHook;
    provider?: ProviderHook;
    "chat.message"?: (...) => Promise<void>;
    "chat.params"?: (...) => Promise<void>;
    "tool.execute.before"?: (...) => Promise<void>;
    "tool.execute.after"?: (...) => Promise<void>;
    "permission.ask"?: (...) => Promise<void>;
    // ... 20+ hook types
}
```

**关键差异**：

| 维度 | Claude Code | OpenCode |
|------|-------------|----------|
| 插件入口 | `.claude-plugin/plugin.json`（声明式） | TypeScript 模块的 `export const X: Plugin`（命令式） |
| 发现机制 | 扫描目录结构 → 约定命名 → 自动注册 | 扫描 `tools/*.ts` 默认导出 → 文件名派生工具名 |
| 命名空间 | `plugin.json.name` 前缀（`/trae:run`） | 文件名前缀（`trae-run`） |
| Marketplace | git URL 或本地路径，`strict: true` 模式 | 无 marketplace 概念，本地扫描 |
| 依赖管理 | 根 `package.json`（Node.js） | `.opencode/package.json`（Bun 独立依赖树） |

---

## 3. 命令系统：Slash Commands vs Bun Tools

### Claude Code：Slash Commands（用户交互式）

Claude Code 的 `commands/*.md` 文件定义**用户手动触发**的斜杠命令：

```markdown
---
description: 将任务委托给 Trae Agent 执行
allowed-tools: Bash(trae-cli:*)
---

# /trae:run

**Description:** 将任务描述直接交给 Trae Agent...
**Usage:** /trae:run "自然语言任务描述" [options]
**Options:** --background, --json, --yolo, ...
**Examples:** ...
**Internal Execution:**
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" run "任务描述" [options]
```

**执行流程**：
1. 用户输入 `/trae:run "重构"` → Claude Code 识别 slash command
2. Claude Code 读取 `.md` 文件 → 知道该执行什么
3. Claude 的 **Bash 工具**运行 `node dist/index.js run "重构"`
4. `allowed-tools: Bash(trae-cli:*)` 告诉 Claude Code 该命令需要 `Bash` 工具权限

**关键特性**：
- **用户交互** — 用户主动输入 `/trae:xxx`
- **AI 自主调用的分离实现** — 通过 `.mcp.json`（见下文）
- **权限声明** — `allowed-tools` 指定所需的 Bash 工具范围

### OpenCode：Bun Tools（Agent 调用式）

```typescript
// .opencode/tools/trae-run.ts
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: "使用 Trae Agent 执行任意自然语言任务...",
  args: {
    prompt: tool.schema.string().describe("任务描述"),
    yolo: tool.schema.boolean().optional().describe("YOLO 模式..."),
    // ...
  },
  async execute(args, context) {
    const { $ } = await import("bun")
    const cliArgs: string[] = ["node", DIST_INDEX, "run"]
    cliArgs.push(args.prompt)
    if (args.yolo) cliArgs.push("--yolo")
    // ...
    const result = await $`${cliArgs}`.cwd(PLUGIN_DIR)
    return { text: result.stdout }
  },
})
```

**执行流程**：
1. OpenCode Agent 决定调用工具 → 选择 `trae-run`
2. OpenCode 验证参数 against Zod schema
3. 直接调用 `execute(args, context)` — **函数调用，非子进程**
4. `execute()` 内部通过 Bun `$` 壳命令 `spawn` 子进程

**关键特性**：
- **Agent 自主调用** — Agent 在 Tool Context 中决策是否调用
- **TypeScript 函数调用** — 不是 Bash 工具运行，而是直接函数执行
- **Rich Context** — `context` 提供 `sessionID`, `directory`, `worktree`, `abort` 等

### 两者本质差异

| 维度 | Claude Code Slash Command | OpenCode Bun Tool |
|------|--------------------------|-------------------|
| 触发者 | 用户（输入 `/trae:xxx`） | AI Agent（在 Tool Context 中决策） |
| 执行方式 | Claude 的 Bash 工具运行 `node dist/index.js` | 直接在插件进程中调用 `execute()` 函数 |
| 进程层级 | 3 层：Claude → Bash → node dist/index.js | 2 层：OpenCode → execute() → node dist/index.js |
| 安全性 | 基于 `allowed-tools` 的 Bash 权限控制 | 基于 Bun 运行时，在 OpenCode 的 Plugin 沙箱内 |
| 类型安全 | 无 — Markdown 文件，Claude AI 解析 | 完整 — TypeScript 类型推断 + Zod 运行时校验 |
| 用户可见性 | 在 `/help` 面板显示 | 在 `/` 工具面板展示（由 TUI 自动列出） |

**重要事实**：OpenCode 没有独立的"Slash Command"概念。所有工具都在同一面板中暴露，`/trae:xxx` 的 `/` 前缀是 **OpenCode TUI 的统一入口约定**，与 Claude Code 的 slash command 是不同概念。OpenCode 把 `tools/` 下所有工具都列在 `/` 面板，`trae-` 前缀只是文件名派生的。

---

## 4. 工具协议：MCP (JSON Schema) vs Bun Tool (Zod + TypeScript)

### Claude Code：MCP 工具（声明式 JSON Schema）

```json
// .mcp.json
{
  "tools": [
    {
      "name": "trae_run",
      "description": "使用 Trae Agent 执行任意自然语言任务...",
      "parameters": {
        "type": "object",
        "properties": {
          "prompt":         { "type": "string", "description": "任务描述" },
          "yolo":           { "type": "boolean", "description": "YOLO 模式..." },
          "allowed_tools":  { "type": "array", "items": { "type": "string" } },
          "background":     { "type": "boolean", "description": "后台执行" },
          // ...
        },
        "required": ["prompt"]
      }
    }
  ]
}
```

**MCP 执行模型**：
```
Claude LLM → 决定调用 "trae_run" → 发送 MCP 请求
  → Claude Code MCP Client → spawn("node", ["dist/index.js", "run", "--prompt", "重构"])
  → 捕获 stdout → 返回给 Claude
```

MCP 协议中，**工具定义和执行分离**：`.mcp.json` 只描述接口，执行由 Claude Code 的 MCP 服务器托管。 Claude Code 将 JSON 参数转换为 CLI 标志，调用子进程，捕获输出。

### OpenCode：Bun Tool（Zod + TypeScript 函数）

```typescript
export default tool({
  description: "使用 Trae Agent 执行任意自然语言任务...",
  args: {
    prompt: tool.schema.string().describe("任务描述"),
    yolo: tool.schema.boolean().optional().describe("YOLO 模式..."),
    allowed_tools: tool.schema.array(tool.schema.string()).optional(),
    background: tool.schema.boolean().optional(),
    // ...
  },
  async execute(args, context) {
    const { $ } = await import("bun")
    // 手动构建 CLI 参数
    const cliArgs = ["node", DIST_INDEX, "run"]
    cliArgs.push(args.prompt)
    if (args.yolo) cliArgs.push("--yolo")
    // ...
    const result = await $`${cliArgs}`.cwd(PLUGIN_DIR)
    return { text: result.stdout }
  },
})
```

**Bun Tool 执行模型**：
```
OpenCode LLM → 决定调用 "trae-run" → OpenCode 验证 args (Zod)
  → execute(args, context) → $`node dist/index.js run` (Bun shell)
  → 返回 { text: stdout }
```

**对比**：

| 维度 | MCP JSON Schema | Bun Tool Zod |
|------|----------------|-------------|
| 参数定义 | `{"type": "string"}` | `tool.schema.string()` |
| 类型推断 | 无 — 纯 JSON | 完整 — `z.infer<Args>` |
| 运行时校验 | Claude Code 框架做 | Zod 校验，失败抛异常 |
| IDE 支持 | 无 | 自动补全、悬停文档、类型错误 |
| 执行委托 | ✅ 框架管理子进程 | ❌ 自己写 `execute()` 逻辑 |
| 上下文信息 | 无 | `context: ToolContext`（session, dir, abort...） |
| 返回值类型 | 隐式 stdout（纯文本） | `{ output: string; metadata?: Record }` |

**关键差异**：MCP 工具是**契约式**的——只声明接口，执行全部委托给框架。Bun Tool 是**实现式**的——每个工具定义自己的执行逻辑和进程管理。

---

## 5. 生命周期钩子：hooks.json vs Plugin Event System

### Claude Code：声明式 hooks.json

```json
// hooks/hooks.json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [{
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/session-lifecycle-hook.mjs\" SessionStart",
          "timeout": 10
        }]
      }
    ],
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/stop-review-gate-hook.mjs\"",
          "timeout": 60
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": ".*trae:review.*",
        "hooks": [{
          "type": "command",
          "command": "node \"...\" PostReview",
          "timeout": 5
        }]
      }
    ]
  }
}
```

**钩子脚本实现** (`session-lifecycle-hook.mjs`):
```javascript
async function sessionStart() {
  const installed = checkTraeCliInstalled();
  const hasConfig = checkTraeConfig();
  const running = getRunningJobs();
  // 输出状态到 console → 被 Claude 捕获为上下文
}

async function sessionEnd() {
  cleanupStaleLogs();
  const running = getRunningJobs();
  // 提醒后台任务 + 清理
}

async function postReview() {
  // 记录审查执行到 reviews.jsonl
}
```

**Stop 钩子** (`stop-review-gate-hook.mjs`):
```javascript
async function stopGate() {
  const hasChanges = hasUncommittedChanges(); // git diff
  const runningJobs = getRunningJobs();
  // 有变更或运行中任务 → process.exit(1) 拦截停止
}
```

| 特性 | hooks.json 定义 |
|------|----------------|
| 可用钩子 | `SessionStart`、`SessionEnd`、`Stop`、`PostToolUse` |
| 匹配器 | `"startup"` 关键字 / 正则字符串 / 无（匹配所有） |
| 执行方式 | 框架 spawn 子进程 (`command` 字符串) |
| 超时控制 | 声明式 `timeout: 10`（秒，框架强制 kill） |
| 数据传输 | 无 stdin 输入（隐式环境变量） |
| 变量替换 | `${CLAUDE_PLUGIN_ROOT}`（框架替换） |

### OpenCode：命令式 Plugin Event Handler

```typescript
// .opencode/plugins/trae-hooks.ts
export const TraeHooksPlugin: Plugin = async ({ directory }) => {
  let currentSessionID: string | null = null

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case "session.created":
          // SessionStart
          const session = event.properties?.info
          currentSessionID = session.id
          await callHook("session-lifecycle-hook.mjs", "SessionStart", directory, {
            session_id: session.id,  // 通过 JSON stdin 传递
          })
          break

        case "session.deleted":
          // SessionEnd
          callHookSync("session-lifecycle-hook.mjs", "SessionEnd", directory, {
            session_id: session.id,
          })
          currentSessionID = null
          break

        case "server.instance.disposed":
          // SessionEnd 兜底（服务器退出而非显式删除会话）
          if (currentSessionID) {
            callHookSync("session-lifecycle-hook.mjs", "SessionEnd", directory, {
              session_id: currentSessionID,
            })
            currentSessionID = null
          }
      }
    },
  }
}
```

**`callHook` / `callHookSync` 实现**：
```typescript
async function callHook(script: string, hookType: string, cwd: string, payload?: Record) {
  const proc = Bun.spawn(["node", SCRIPT_DIR, script, hookType], {
    cwd,
    stdin: payload ? new Blob([JSON.stringify(payload) + "\n"]) : undefined,
  })
  // 捕获 stdout/stderr
  await proc.exited
}
```

| 特性 | OpenCode Plugin Events |
|------|----------------------|
| 可用事件 | 36+ 种（EventSessionCreated, EventSessionDeleted, ...） |
| 实际使用的 | `session.created` → SessionStart, `session.deleted` / `server.instance.disposed` → SessionEnd |
| 未映射的 | `Stop`（停止门控）、`PostToolUse`（审查记录） |
| 匹配方式 | 代码中 `switch (event.type)` |
| 执行方式 | `Bun.spawn()` / `Bun.spawnSync()` |
| 数据传输 | JSON 对象通过 stdin 传递 |
| 状态保持 | 闭包变量 `currentSessionID` |
| 异步支持 | `callHook` (async) / `callHookSync` (sync) |
| 错误处理 | `try/catch` 静默吞错（"plugin must not crash OpenCode"） |

**映射关系**：

```
Claude Code                     OpenCode
────────────                    ────────
SessionStart (startup)    ←→    session.created (+ payload via stdin)
SessionEnd                ←→    session.deleted / server.instance.disposed
Stop (gate)                     ❌ 未实现（无等价事件钩子）
PostToolUse (.trae:review.)     ❌ 未实现（可用 tool.execute.after 但需过滤）
```

**差异根因**：
- Claude Code 的 `Stop` 钩子绑定到用户停止操作——这是 TUI 层面的事件，OpenCode 的 Event 类型中无对应
- Claude Code 的 `PostToolUse` 通过正则匹配工具名（`.trae:review.`）——OpenCode 的 `tool.execute.after` 钩子可用于相同目的，但本项目未实现过滤

---

## 6. 命令文档：用户帮助 vs Agent 上下文

### Claude Code 命令文档

`commands/*.md` 为 **Slash Command 的完整规范**，同时服务两个受众：

1. **用户** — 在 `/help` 面板看到格式化输出
2. **Claude Code 框架** — 解析执行指令

```markdown
# /trae:run                          ← H1 标题 = 命令名
**Description:** ...                 ← 详细说明
**Usage:** /trae:run "任务" [options] ← 用法指南
**Options:**                         ← 参数列表
- `--background`: ...
**Examples:**                        ← 示例
/trae:run "重构用户模块"
**Internal Execution:**              ← 框架执行指令
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" run "任务描述" [options]
```

**Frontmatter**：
```yaml
description: 将任务委托给 Trae Agent 执行
allowed-tools: Bash(trae-cli:*)
```

### OpenCode 命令文档

`.opencode/commands/trae-*.md` 仅为 **Agent 可读的参考文档**，不含 Slash Command 语法：

```markdown
Execute the task by running the trae-plugin-cc CLI:

```bash
node "${CLAUDE_PLUGIN_ROOT}/dist/index.js" run $ARGUMENTS
```

Usage examples:
- `task "refactor the user module"`
- `task "fix the login bug" --yolo`
```

**Frontmatter** 仅有 `description:`，无 `allowed-tools`。

**关键差异**：

| 维度 | Claude Code commands/*.md | OpenCode .opencode/commands/trae-*.md |
|------|---------------------------|---------------------------------------|
| H1 标题 | `# /trae:<command>` | 无 |
| 格式 | 严格分段（Description/Usage/Options/Examples/Internal） | 自由段落 + 代码块 |
| Frontmatter | `description` + `allowed-tools` | 仅 `description` |
| 语言 | 中文 | 英文 |
| 变量占位 | 具体值（"任务描述"） | 抽象变量（`$ARGUMENTS`） |
| 作用 | 用户帮助 + 框架执行指令 | 仅为 Agent 提供执行参考 |

---

## 7. 安全模型：allowed-tools vs 无显式权限声明

### Claude Code：声明式 Bash 权限

Claude Code 的 Slash Commands 通过 `allowed-tools` 声明所需的 Bash 工具访问权限：

```markdown
# /trae:run
allowed-tools: Bash(trae-cli:*)

# /trae:review
allowed-tools: Bash(git:*), Bash(trae-cli:*)

# /trae:cancel
allowed-tools: Bash(kill)
```

**语义**：`Bash(trae-cli:*)` 表示该命令需要 `Bash` 工具能执行包含 `trae-cli` 的命令，`*` 是通配符。

**未声明 `allowed-tools` 的命令**（`setup`, `status`, `result`, `sessions`）：不需要特殊 Bash 工具权限，仅运行 `node dist/index.js`。

**MCP 工具**不声明 `allowed-tools` — 因为 MCP 工具的执行完全由 Claude Code 的 MCP 服务器托管，不在 Bash 工具链内。

### OpenCode：隐式信任

OpenCode 的 Plugin 代码运行在 Bun 环境内，**没有独立的权限声明系统**：

- `trae-setup.ts` → `Bun.spawn(["node", DIST_INDEX, "setup"])` — 无权限检查
- `trae-run.ts` → `Bun.$\`node dist/index.js run ...\`` — 无权限声明
- 所有 Bun 工具在 OpenCode Plugin 上下文中拥有完整执行权限

**根本原因**：Bun 工具的 `execute()` 是进程内函数调用（不是通过 Bash 工具间接执行），不存在 Claude Code 式的 "Bash 工具权限"概念。OpenCode 的权限控制粒度是 **Plugin 级别**（信任整个插件），而非**命令级别**。

---

## 8. 运行时与进程模型

### Claude Code

```
┌───────────────────────────────────────────┐
│           Claude Code (Node.js)            │
│                                            │
│  ┌─ Slash Command 触发 ──────────────────┐ │
│  │ Bash Tool → spawn("node", [...])      │ │
│  │  → dist/index.js → spawn("trae-cli")   │ │
│  └───────────────────────────────────────┘ │
│                                            │
│  ┌─ MCP 工具触发 ────────────────────────┐ │
│  │ MCP Server → spawn("node", [...])     │ │
│  │  → dist/index.js → spawn("trae-cli")   │ │
│  └───────────────────────────────────────┘ │
│                                            │
│  ┌─ 钩子触发 ────────────────────────────┐ │
│  │ hooks.json → spawn("node", [...])     │ │
│  │  → scripts/*.mjs                       │ │
│  └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

**运行时**：Node.js（根 `package.json`）
**进程数**：每个命令/工具/钩子 → 新的 `node` 进程 + `trae-cli` 子进程

### OpenCode

```
┌───────────────────────────────────────────┐
│           OpenCode (Bun)                   │
│                                            │
│  ┌─ Bun Tool 触发 ──────────────────────┐ │
│  │ execute(args, context)                │ │
│  │  → Bun.$\`node dist/index.js ...\``   │ │
│  │   → dist/index.js → spawn("trae-cli") │ │
│  └───────────────────────────────────────┘ │
│                                            │
│  ┌─ Plugin Hook 触发 ────────────────────┐ │
│  │ event({ event }) → Bun.spawn(...)     │ │
│  │  → scripts/*.mjs                       │ │
│  └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

**运行时**：Bun（`.opencode/package.json` 独立依赖树）
**进程数**：每个 Bun Tool 调用 → 新的 Bun 内函数执行 → `spawn("node", ...)` → `trae-cli`

---

## 9. 本项目的统一架构设计

基于两个平台的根本差异，本项目采用 **"共享核心 + 平台适配层"** 的双层架构：

### 共享核心（src/ → dist/index.js）

```
src/
├── index.ts              ← CLI 入口（argv 解析 → 命令分发）
├── commands/             ← 12 个命令处理器
│   ├── setup.ts
│   ├── run.ts
│   ├── review.ts
│   ├── sessions.ts
│   ├── acp.ts
│   ├── ...
└── utils/                ← 共享工具类
    ├── trae-executor.ts       ← trae-cli 子进程执行器
    ├── session-reader.ts      ← 会话文件读取器
    ├── auth-bridge.ts         ← 认证状态解析
    ├── acp-server-manager.ts  ← ACP 进程管理
    ├── acp-client.ts          ← ACP JSON-RPC 客户端
    ├── branch-detection.ts    ← git 分支检测
    └── ...
```

**编译**：esbuild 打包为 `dist/index.js`（单文件，含 shebang，Node externals）

### Claude Code 适配层

```
.claude-plugin/plugin.json    ← 插件 identity
commands/*.md                 ← 10 个 Slash Command 定义
.mcp.json                     ← 4 个 MCP 工具
hooks/hooks.json              ← 4 个生命周期钩子
scripts/*.mjs                 ← 钩子脚本实现
```

**调用链**：
- Slash Command: 用户 → `/trae:run` → Bash Tool → `node dist/index.js run`
- MCP: Claude AI → MCP `trae_run` → MCP Server → `node dist/index.js run`
- Hooks: 事件 → hooks.json → `node scripts/*.mjs`

### OpenCode 适配层

```
.opencode/
├── tools/trae-*.ts         ← 9 个 Bun 工具 (export default tool({...}))
├── commands/trae-*.md      ← 10 个命令参考文档
├── plugins/trae-hooks.ts   ← 事件钩子插件 (export const TraeHooksPlugin: Plugin)
└── package.json            ← @opencode-ai/plugin@1.14.20
```

**调用链**：
- Tools: Agent → `trae-run` → `execute()` → `Bun.$\`node dist/index.js run\``
- Commands: Agent → 读取 `.opencode/commands/trae-run.md` → 理解 CLI 参数形式
- Hooks: OpenCode 事件 → `TraeHooksPlugin` → `Bun.spawn("node", [script])`

### 桥接策略

| 问题 | 解决方式 |
|------|----------|
| MCP 4 个工具 vs 9 个 Bun 工具 | MCP 是 AI 自主调用的最小集（run/review/sessions/acp）；辅助操作（status/result/cancel/rescue/setup）只需 Slash Commands |
| Slash `/trae:review` + `/trae:adversarial-review` vs 1 个 `trae-review` 工具 | OpenCode 工具内部用 `adversarial` 布尔参数路由（`args.adversarial ? "adversarial-review" : "review"`） |
| `hooks.json` 4 个钩子 vs `trae-hooks.ts` 3 种事件 | OpenCode 无 `Stop`/`PostToolUse` 等价事件，选择性映射 |
| `commands/` vs `.opencode/commands/` | 两套独立文件——Claude Code 需要结构化 Markdown + slash syntax；OpenCode 需要简洁 Agent 指令 |

### 参数映射（run 命令完整对照）

| Slash Command | MCP 工具 | Bun Tool | CLI 参数 | 说明 |
|---|---|---|---|---|
| 用户输入 `/trae:run "x"` | Agent 调用 `trae_run({prompt:"x"})` | Agent 调用 `trae-run({prompt:"x"})` | `run "x"` | 统一 |
| `--yolo` / `-y` | `yolo: true` | `yolo: true` | `--yolo` | 统一 |
| `--resume` | `resume: "AUTO"` | `resume: "AUTO"` | `--resume AUTO` | 统一 |
| `--resume <id>` | `resume: "<id>"` | `resume: "<id>"` | `--resume <id>` | 统一 |
| `--worktree` | `worktree: "__auto__"` | `worktree: "__auto__"` | `--worktree __auto__` | 统一 |
| 无 | `json_output: true` | `json_output: true` | `--json` | snake_case 差异 |
| 无 | `allowed_tools: ["Bash"]` | `allowed_tools: ["Bash"]` | `--allowed-tool Bash` | snake_case + array |
| 无 | `disallowed_tools: ["Edit"]` | `disallowed_tools: ["Edit"]` | `--disallowed-tool Edit` | snake_case + array |

**MCP/Bun** 使用 `snake_case`（`json_output`, `allowed_tools`），Slash Command CLI 使用 `kebab-case`（`--json`, `--allowed-tool`）。Bun 工具的 `execute()` 负责转换映射。

---

## 10. 完整对比矩阵

| 维度 | Claude Code | OpenCode | 本项目处理策略 |
|------|-------------|----------|---------------|
| **运行时** | Node.js | Bun | 共享 CLI 用 Node.js（esbuild），OpenCode 工具用 Bun |
| **插件入口** | `.claude-plugin/plugin.json` | TypeScript `export const X: Plugin` | 两份独立配置 |
| **用户命令** | 10 个 Slash Commands (`/trae:xxx`) | 无独立 Slash Command，工具在 `/` 面板统一展示 | `commands/*.md` 定义 slash 命令；`.opencode/tools/` 定义工具 |
| **AI 工具** | 4 个 MCP 工具（JSON Schema） | 9 个 Bun 工具（Zod + TS） | MCP 定义最小 AI 工具集；Bun 工具覆盖全部 CLI 命令 |
| **工具注册** | `.mcp.json` 声明式 | `export default tool({...})` 命令式 | 两套独立定义，参数一致 |
| **生命周期** | `hooks/hooks.json` (4 个) | `plugins/trae-hooks.ts` (事件映射) | 复用同一批 `.mjs` 脚本，OpenCode 通过 `Bun.spawn` 触发 |
| **命令文档** | `commands/*.md` (含 slash 语法) | `.opencode/commands/*.md` (Agent 参考) | 两套独立文件 |
| **权限模型** | `allowed-tools` frontmatter | 无（Plugin 级信任） | Slash Commands 声明 `allowed-tools`；Bun 工具不需要 |
| **进程模型** | CLI 每调用启动新 `node` 进程 | Bun Tool 进程内调用 → 再 `spawn` `node` | 统一使用 `dist/index.js`（esbuild 单文件） |
| **类型安全** | 无（JSON + Markdown） | 完整（TypeScript + Zod） | 共享核心 `src/commands/` 自行解析 argv（无类型框架） |
| **工具合并** | `review` + `adversarial-review` (两个独立命令) | `trae-review` (一个工具，`adversarial` 布尔参数) | Bun 工具内部路由到两个 CLI 命令 |
| **依赖管理** | 根 `package.json` | `.opencode/package.json` | 两套独立 `package.json` |
| **Marketplace** | git URL + `claude plugin install` | 无 marketplace，本地发现 | 支持 Marketplace 安装 + 本地目录安装 |
