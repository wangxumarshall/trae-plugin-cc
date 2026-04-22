# trae-plugin-cc

The plugin bridges [**Claude Code**](https://claude.ai/code) and [**OpenCode**](https://opencode.ai) with ByteDance [**Trae Agent**](https://docs.trae.cn/cli) (`trae-cli`). Delegate natural language tasks, run code reviews, manage sessions, and enable Agent-to-Agent communication — all inheriting trae-cli's OAuth2 auth (no extra API keys needed).

## Features

| Feature | Description |
|---------|-------------|
| **Task Delegation** | Send natural language prompts to Trae Agent with YOLO mode, session resume, git worktree isolation, and fine-grained tool permissions |
| **Code Review** | Automatic git diff + professional review — standard or adversarial (extremely strict), with smart base branch detection and change-size estimation |
| **Session Management** | Query trae-cli's history: conversations, tool calls, context summaries, topic search, and bulk cleanup |
| **ACP Protocol** | JSON-RPC over STDIO for inter-agent communication (start/stop servers, discover agents, execute/stream tasks) |
| **Background Tasks** | Long-running tasks with PID tracking, status listing, result retrieval, and cancellation |
| **Lifecycle Hooks** | Auto-triggered on session start/end/stop: env checks, background task reminders, uncommitted-change gates |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        trae-plugin-cc                             │
│                                                                    │
│  ┌──────────────────────┐          ┌──────────────────────────┐   │
│  │    Claude Code       │          │       OpenCode           │   │
│  ├──────────────────────┤          ├──────────────────────────┤   │
│  │ 10 Slash Commands    │          │  9 Tools + 10 Commands   │   │
│  │    commands/*.md     │          │    tools/ + commands/    │   │
│  │ 4  MCP Tools (.json) │          │  Event Hooks (.ts)       │   │
│  │ 4  Lifecycle Hooks   │          │    plugins/              │   │
│  └──────────┬───────────┘          └──────────┬───────────────┘   │
│             │                                  │                    │
│  ┌──────────▼──────────────────────────────────▼───────────────┐   │
│  │              Core CLI (src/ → dist/index.js)                 │   │
│  │  setup | run | review | adversarial-review | sessions |      │   │
│  │  acp | status | result | cancel | rescue | hooks            │   │
│  └──────────────────────────┬──────────────────────────────────┘   │
│                             │                                       │
│                    ┌─────────▼──────────┐                          │
│                    │    trae-cli        │                          │
│                    │  (OAuth2 inherit)  │                          │
│                    └────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

Both platforms share the same core CLI (`dist/index.js`). Claude Code uses slash commands (`/trae:*`), MCP tools for AI-autonomous invocation, and lifecycle hooks; OpenCode uses Bun tools (`.opencode/tools/`) and command descriptions (`.opencode/commands/`) — all ultimately invoking `node dist/index.js <command>`.

## Prerequisites

- **Node.js 18+** (runtime)
- **trae-cli** installed and authenticated

```bash
# Verify trae-cli
trae-cli --help

# Verify auth (should show model + login URL)
cat ~/.trae/trae_cli.yaml
```

## Installation

### Claude Code

**Option 1: Marketplace (recommended)**

```bash
claude plugin marketplace add https://github.com/wangxumarshall/idea0015-trae-plugin-cc
claude plugin install trae
claude plugin list | grep trae
```

Scope: `--scope user` (global) | `--scope project` (current project) | `--scope local` (current session)

**Option 2: Local directory**

```bash
git clone https://github.com/wangxumarshall/idea0015-trae-plugin-cc.git
cd idea0015-trae-plugin-cc
npm install   # ⚡ auto-builds dist/ via postinstall
claude plugin marketplace add "$(pwd)"
claude plugin install trae
```

### OpenCode

```bash
git clone https://github.com/wangxumarshall/idea0015-trae-plugin-cc.git
cd idea0015-trae-plugin-cc
npm install   # ⚡ auto-builds dist/ via postinstall
cd .opencode && npm install && cd ..
```

OpenCode auto-discovers tools in `.opencode/tools/` and commands in `.opencode/commands/`.

### Verify Installation

```bash
node dist/index.js setup
```

Expected output:
```
✅ trae-cli 已安装并可用！

## 认证状态
  已认证: ✅
  模型: GLM-5
  登录地址: https://console.enterprise.trae.cn
```

> **What `npm install` does**: Automatically runs `npm run build` via the `postinstall` hook, producing `dist/index.js` (the runtime CLI). If you `git pull` new source changes, run `npm run build` again.

## Quick Start

**Claude Code** (slash commands — user types directly):

```
/trae:run "重构用户认证模块"           # execute task
/trae:run "修复登录bug" --yolo         # skip tool confirmations
/trae:review                           # standard review
/trae:adversarial-review               # adversarial review
/trae:sessions list                    # list sessions
/trae:acp run "分析代码质量"            # execute via ACP
```

Claude Code additionally auto-registers 4 MCP tools (`trae_run`, `trae_review`, `trae_sessions`, `trae_acp`) for AI-autonomous invocation.

**OpenCode** (Bun tools — agent calls tools):

| Tool | CLI | Description |
|------|-----|-------------|
| `trae-setup` | `setup` | Check env & auth |
| `trae-run` | `run` | Execute task |
| `trae-review` | `review` / `adversarial-review` | Code review |
| `trae-sessions` | `sessions` | Session management (9 actions) |
| `trae-acp` | `acp` | ACP protocol (6 actions) |
| `trae-status` | `status` | Background task status |
| `trae-result` | `result` | Get task output |
| `trae-cancel` | `cancel` | Cancel task |
| `trae-rescue` | `rescue` | Failure diagnosis |

OpenCode's TUI `/` panel lists available tools from `.opencode/tools/`; `trae-` prefix comes from filenames, not from this plugin.

## Commands Reference

All commands map to `node dist/index.js <command> [args]`.
In **Claude Code**, users type `/trae:<command>` (slash commands).
In **OpenCode**, agents call `trae-<command>` tools — parameters are passed as named arguments, not CLI flags.

### `setup`

Verify trae-cli installation and auth status. Run once before first use.

<table><tr><td>Claude Code</td><td>

```
/trae:setup
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-setup** tool (no parameters)
</td></tr></table>

---

### `run`

Delegate a natural language task to Trae Agent.

<table><tr><td>Claude Code</td><td>

```
/trae:run "描述任务" [options]
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-run** tool with parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `prompt` | string | Yes | 任务描述 |
| `resume` | string | No | 恢复会话：会话ID 或 `"AUTO"` 自动恢复最近会话 |
| `session_id` | string | No | 指定新会话 ID |
| `yolo` | boolean | No | 跳过工具权限确认 |
| `allowed_tools` | string[] | No | 自动批准的工具列表，如 `["Bash", "Edit", "Replace"]` |
| `disallowed_tools` | string[] | No | 自动拒绝的工具列表 |
| `json_output` | boolean | No | 返回结构化 JSON 输出 |
| `background` | boolean | No | 后台执行 |
| `worktree` | string | No | 隔离的 git worktree，`"__auto__"` 自动生成名称 |
| `query_timeout` | string | No | 单次查询超时，如 `"30s"`, `"5m"` |
| `bash_tool_timeout` | string | No | Bash 工具超时 |
| `inject_context` | string | No | 注入指定会话的上下文到 prompt 中 |
</td></tr></table>

**OpenCode usage examples** (agent calls tool with these parameters):
- `trae-run(prompt="重构用户模块")`
- `trae-run(prompt="修复登录bug", yolo=true)`
- `trae-run(prompt="生成项目文档", background=true)`
- `trae-run(prompt="分析代码库", json_output=true)`
- `trae-run(prompt="继续任务", resume="AUTO")`
- `trae-run(prompt="继续任务", resume="0d3cbdc3-e365-468e-982c-fb3d5849f5cc")`
- `trae-run(prompt="实验性变更", worktree="__auto__")`
- `trae-run(prompt="运行脚本", allowed_tools=["Bash", "Edit"])`
- `trae-run(prompt="继续优化", inject_context="abc123")`

**Claude Code usage examples:**
```bash
/trae:run "重构认证模块" --background --json
/trae:run "继续" --resume --yolo
/trae:run "修复 bug" --worktree --allowed-tool Edit --allowed-tool Bash
```

---

### `review` / `adversarial-review`

Code review with automatic git diff.

<table><tr><td>Claude Code</td><td>

```
/trae:review
/trae:adversarial-review
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-review** tool with parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `base_branch` | string | No | 基准分支，默认自动检测 |
| `adversarial` | boolean | No | 设为 `true` 启用对抗性审查模式 |
| `background` | boolean | No | 后台执行（大 diff 推荐） |
| `yolo` | boolean | No | 跳过确认 |
| `json_output` | boolean | No | 返回结构化 JSON 输出 |
| `session_id` | string | No | 指定会话 ID |

- 标准审查：`trae-review()`
- 对抗性审查：`trae-review(adversarial=true)`
</td></tr></table>

自动检测基准分支并估算审查大小，大变更推荐后台模式。

---

### `sessions`

Manage trae-cli's historical sessions (reads from file cache directly — no HTTP calls).

<table><tr><td>Claude Code</td><td>

```
/trae:sessions <action> [options]
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-sessions** tool with parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | Yes | `list`, `detail`, `conversation`, `tools`, `context`, `recent`, `find`, `delete`, `delete-smoke` |
| `session_id` | string | No | 会话 ID（detail/conversation/tools/context/delete 需要） |
| `cwd` | string | No | 按工作目录筛选（list/recent） |
| `limit` | number | No | 返回数量限制，默认 20 |
| `topic` | string | No | 搜索关键词（find action） |
</td></tr></table>

**Action reference:**

| action | 需要 session_id | 描述 |
|--------|----------------|------|
| `list` | No | 列出所有会话 |
| `recent` | No | 最近一次会话 |
| `detail` | Yes | 查看会话元数据 + 事件计数 |
| `conversation` | Yes | 查看对话消息 |
| `tools` | Yes | 查看工具调用统计 + 记录（最多30条） |
| `context` | Yes | 查看完整上下文摘要 |
| `find` | No | 按关键词搜索（使用 `topic` 参数） |
| `delete` | Yes | 删除一个会话 |
| `delete-smoke` | No | 批量删除 ID/title 中包含 "smoke" 的会话 |

---

### `acp`

ACP protocol: **JSON-RPC over STDIO** (not HTTP). Enables Agent-to-Agent communication.

<table><tr><td>Claude Code</td><td>

```
/trae:acp <action> [options]
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-acp** tool with parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `action` | enum | Yes | `start`, `stop`, `status`, `agents`, `run`, `stream` |
| `prompt` | string | No | 任务描述（run/stream 需要） |
| `yolo` | boolean | No | YOLO 模式（start/run） |
| `allowed_tools` | string[] | No | 允许的工具（start） |
| `disabled_tools` | string[] | No | 禁用的工具（start） |
</td></tr></table>

> **Note**: `acp start` is a blocking call — it holds the process alive for the STDIO pipe. Use `agents`, `run`, or `stream` for interactive use (they auto-start the server).

---

### `status`

List all background tasks (reads `.claude-trae-plugin/` for PID files).

<table><tr><td>Claude Code</td><td>

```
/trae:status
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-status** tool (no parameters)
</td></tr></table>

---

### `result`

Get output of a background task.

<table><tr><td>Claude Code</td><td>

```
/trae:result <task-id>
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-result** tool with parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string | Yes | 后台任务 ID（时间戳） |
</td></tr></table>

---

### `cancel`

Force-kill a background task (SIGKILL).

<table><tr><td>Claude Code</td><td>

```
/trae:cancel <task-id>
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-cancel** tool with parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `task_id` | string | Yes | 要取消的后台任务 ID（时间戳） |
</td></tr></table>

---

### `rescue`

Diagnose recent task failures, collect error logs and git status.

<table><tr><td>Claude Code</td><td>

```
/trae:rescue [--context text]
```
</td></tr><tr><td>OpenCode</td><td>

Call **trae-rescue** tool with parameters:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `context` | string | No | 提供额外的上下文信息帮助诊断 |
</td></tr></table>

---

### Lifecycle Hooks

Auto-triggered — no manual invocation needed.

| Hook | Trigger | Behavior |
|------|---------|----------|
| `SessionStart` | Claude Code startup / OpenCode session.created | Check trae-cli, remind background tasks |
| `SessionEnd` | Claude Code exit / OpenCode session.deleted | Clean old logs, remind running tasks |
| `Stop` | User stops operation | Gate on uncommitted changes |
| `PostToolUse` | After `/trae:review` | Log review results |

---

### `hooks <type>` (internal)

Internal hook handler — invoked by lifecycle scripts, not users.

```bash
trae-plugin-cc hooks session-start|session-end|stop-gate
```

## Project Structure

```
trae-plugin-cc/
├── .claude-plugin/          # Claude Code plugin + marketplace manifest
├── commands/                # Slash command docs (*.md)
├── .mcp.json                # 4 MCP tool definitions
├── hooks/hooks.json         # Claude Code lifecycle hooks
├── scripts/                 # Hook scripts (*.mjs)
├── src/                     # Core CLI (TypeScript → dist/index.js)
│   ├── index.ts             # Entrypoint
│   ├── commands/            # Command handlers
│   └── utils/               # TraeExecutor, SessionReader, AuthBridge, AcpClient...
├── .opencode/               # OpenCode integration
│   ├── tools/               # 9 Bun tools (*.ts)
│   ├── commands/            # 10 command docs (*.md)
│   ├── plugins/             # Event hooks
│   └── package.json         # OpenCode deps (@opencode-ai/plugin)
└── tests/                   # Jest tests
```

## Development

```bash
npm run build          # esbuild → dist/index.js (run after ANY src/ change)
npm test               # jest (all tests)
cd .opencode && npm install && cd ..   # OpenCode deps (once)
```

### Build After Pulling Updates

When you pull new code from the repository:

```bash
git pull
npm run build   # required if src/ files changed
```

> `npm install` also builds (via `postinstall`), so either command works after a `git pull`.

### ⚠️ Build Rule

`npm run build` uses **esbuild** (bundled single file with shebang) — this is the **production entrypoint**. `npm run build:tsc` produces separate `.js` files for module imports but is not used at runtime.

| Command | Output | Used By |
|---------|--------|---------|
| `npm run build` | `dist/index.js` (bundled) | **Runtime CLI** |
| `npm run build:tsc` | `dist/**/*.js` (separate) | Direct module imports |

**Always run `npm run build` after modifying `src/` before testing.** This applies to OpenCode too — its tools spawn `dist/index.js`.

## Session Cache Paths

trae-cli stores sessions on disk (read directly by this plugin):

| Platform | Path |
|----------|------|
| macOS | `~/Library/Caches/trae_cli/sessions/` |
| Linux | `~/.cache/trae_cli/sessions/` |

## License

MIT
