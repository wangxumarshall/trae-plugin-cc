# ACP (Agent Communication Protocol) 协议详解

## 概述

ACP采用 **JSON-RPC 2.0 协议**，基于 STDIO（标准输入/输出）传输。

**核心用途**：允许外部进程（如本插件）通过子进程方式与 trae-cli 进行双向通信，实现 Agent-to-Agent 协作。

---

## 一、协议架构

```
┌──────────────────────────────────┐          stdin          ┌───────────────────────┐
│  本插件进程                      │ ──────────────────────► │  trae-cli 子进程      │
│                                  │                          │                       │
│  AcpServerManager                │                          │  trae-cli acp serve   │
│  ├─ spawn('trae-cli', ...)       │                          │                       │
│  └─ AcpClient                    │      ┌──────────────┐    │  解析 JSON-RPC 请求   │
│     ├─ stdin.write(JSON-RPC) ────┼─────►│              │    │  写入 stdout 响应     │
│     └─ stdout.read(JSON-RPC) ◄───┼──────│  JSON-RPC 2.0│◄───┤  推送 session/update  │
│                                  │      │  over STDIO  │    │                       │
└──────────────────────────────────┘      └──────────────┘    └───────────────────────┘
             stdout
```

### 传输层

| 配置 | 值 |
|------|-----|
| 启动命令 | `trae-cli acp serve [--yolo] [--allowed-tool N] [--disabled-tool N]` |
| stdio 模式 | `['pipe', 'pipe', 'pipe']`（stdin/stdout/stderr 全部管道化） |
| 消息分隔 | **Newline-delimited JSON** — 每行一个完整 JSON 对象，以 `\n` 结尾 |
| 环境变量 | PATH 预置 `~/.local/bin`，转发 `TRAECLI_PERSONAL_ACCESS_TOKEN` |

### 启动就绪检测（启发式）

`AcpServerManager` 不使用协议级握手判断就绪，而是采用 **5 秒超时启发式**：若 5 秒后子进程仍未退出（`exitCode === null`），则认为 ACP Server 已就绪。

---

## 二、JSON-RPC 协议规范

### 消息格式

遵循 [JSON-RPC 2.0](https://www.jsonrpc.org/specification) 规范：

```typescript
// 请求 (Client → Server)
{
  "jsonrpc": "2.0",
  "id": 1,                           // 递增的消息 ID
  "method": "initialize",            // 方法名
  "params": { ... }                  // 参数
}

// 成功响应 (Server → Client)
{
  "id": 1,
  "result": { ... }
}

// 错误响应 (Server → Client)
{
  "id": 1,
  "error": {
    "message": "错误描述"           // 可能还有 code, data 字段
  }
}

// 通知 (Server → Client, 无 id, 无需响应)
{
  "method": "session/update",
  "params": { ... }
}
```

### 协议方法全览

| 方法 | 方向 | 类型 | 说明 |
|------|------|------|------|
| `initialize` | C→S | Request | 协议握手，交换客户端/Agent 信息 |
| `session/new` | C→S | Request | 创建新会话 |
| `session/load` | C→S | Request | 加载已有历史会话 |
| `session/prompt` | C→S | Request | 向会话发送任务指令 |
| `session/cancel` | C→S | Request | 取消当前正在执行的任务 |
| `session/update` | S→C | Notification | 服务端实时推送更新（流式） |

### 完整协议交互序列

```
┌─ Client ──────────────────────────────────┐          ┌─ trae-cli (acp serve) ───────────────┐
│                                           │          │                                       │
│  (spawn 子进程, stdio=pipe)               │          │                                       │
│                                           │  [5s]    │  (初始化认证, 启动服务)                │
│                                           │ ◄─────── │                                       │
│  initialize                               │          │                                       │
│  {                                        │─────────►│                                       │
│    jsonrpc: "2.0", id: 1,                 │          │  initialize response                  │
│    method: "initialize",                  │          │◄───────── {                             │
│    params: {                              │          │    id: 1,                             │
│      protocolVersion: 1,                  │          │    result: {                          │
│      clientCapabilities: {},              │          │      protocolVersion: 1,              │
│      clientInfo: {                        │          │      agentInfo: {                     │
│        name: "trae-plugin-cc",            │          │        name: "trae-agent",            │
│        version: "1.0.0"                   │          │        title: "...",                  │
│      }                                    │          │        version: "x.y.z"               │
│    }                                      │          │      },                               │
│  }                                        │          │      agentCapabilities: {             │
│                                           │          │        loadSession: true,             │
│                                           │          │        promptCapabilities: {...},     │
│                                           │          │        mcpCapabilities: {             │
│                                           │          │          http: true, sse: false       │
│                                           │          │        },                             │
│                                           │          │        sessionCapabilities: {         │
│                                           │          │          list: true                   │
│                                           │          │        }                              │
│                                           │          │      },                               │
│                                           │          │      authMethods: [...]               │
│                                           │          │    }                                  │
│                                           │          │  }                                    │
│                                           │          │                                       │
│  session/new                              │          │                                       │
│  {                                        │─────────►│  session/new response                 │
│    jsonrpc: "2.0", id: 2,                 │----------│◄───────── {                             │
│    method: "session/new",                 │          │    id: 2,                             │
│    params: {                              │          │    result: {                          │
│      cwd: "/path/to/project",             │          │      sessionId: "abc-123-def",        │
│      mcpServers: []                       │          │      models: {                        │
│    }                                      │          │        availableModels: [...],        │
│  }                                        │          │        currentModelId: "..."          │
│                                           │          │      },                               │
│                                           │          │      modes: {                         │
│                                           │          │        availableModes: [...],         │
│                                           │          │        currentModeId: "..."           │
│                                           │          │      }                                │
│                                           │          │    }                                  │
│                                           │          │  }                                    │
│                                           │          │                                       │
│  session/prompt                           │          │                                       │
│  {                                        │─────────►│  (Agent 开始工作)                     │
│    jsonrpc: "2.0", id: 3,                 │          │                                       │
│    method: "session/prompt",              │          │  session/update (通知 #1)             │
│    params: {                              │          │◄───────── {                             │
│      sessionId: "abc-123-def",            │          │    method: "session/update"           │
│      prompt: [{                           │          │    params: {                          │
│        type: "text",                      │          │      sessionId: "abc-123-def"         │
│        text: "重构用户模块"               │          │      update: {                        │
│      }]                                   │          │        sessionUpdate: "agent_message",│
│    }                                      │          │        content: {                     │
│  }                                        │          │          type: "text",                │
│                                           │          │          text: "我来分析一下..."      │
│                                           │          │        }                              │
│                                           │          │      }                                │
│                                           │          │    }                                  │
│                                           │          │  }                                    │
│                                           │          │                                       │
│                                           │          │  session/update (通知 #2)             │
│                                           │          │◄───────── {                             │
│                                           │          │    method: "session/update"           │
│                                           │          │    params: { ...                      │
│                                           │          │      update: {                        │
│                                           │          │        content: {                     │
│                                           │          │          text: "\n```typescript\n..." │
│                                           │          │        }                              │
│                                           │          │      }                                │
│                                           │          │    }                                  │
│                                           │          │  }                                    │
│                                           │          │                                       │
│                                           │          │  session/prompt response              │
│                                           │          │◄───────── {                             │
│                                           │          │    id: 3,                             │
│                                           │          │    result: {                          │
│                                           │          │      stopReason: "end_turn",          │
│                                           │          │      ...                              │
│                                           │          │    }                                  │
│                                           │          │  }                                    │
│                                           │          │                                       │
│  session/cancel (可选)                    │          │                                       │
│  {                                        │─────────►│                                       │
│    jsonrpc: "2.0", id: 4,                 │          │                                       │
│    method: "session/cancel",              │          │                                       │
│    params: { sessionId: "..." }           │          │                                       │
│  }                                        │          │                                       │
│                                           │          │                                       │
│  关闭 stdin + SIGTERM                     │─────────►│  (退出)                               │
└───────────────────────────────────────────┘          └───────────────────────────────────────┘
```

---

## 三、代码架构（3 个核心文件）

### 3.1 `src/commands/acp.ts` — CLI 命令入口

| 函数 | 行号 | 职责 |
|------|------|------|
| `acp(args)` | 5 | 主路由：解析 action → 分发到子函数 |
| `startServer(args)` | 33 | 解析 `--yolo / --allowed-tool / --disabled-tool`，调用 `serverManager.start()`，然后 `await new Promise(() => {})` 永远阻塞 |
| `stopServer()` | 67 | 调用 `serverManager.stop()` |
| `serverStatus()` | 78 | 调用 `serverManager.getStatus()` 返回运行状态 |
| `listAgents()` | 91 | 自动启动 → `initialize()` → 打印 agentInfo/capabilities → finally 停止 |
| `runViaAcp(args)` | 129 | 自动启动 → initialize → createSession → sessionPrompt（累积输出）→ finally 停止 |
| `streamViaAcp(args)` | 182 | 与 runViaAcp 完全相同，仅回调改为 `process.stdout.write()` 实现流式刷新 |

**全局单例**：`const serverManager = new AcpServerManager()` — 同一进程内共享。

### 3.2 `src/utils/acp-server-manager.ts` — 进程生命周期管理

**Class: `AcpServerManager`**

| 成员 | 行号 | 说明 |
|------|------|------|
| `process: ChildProcess \| null` | 13 | 子进程引用 |
| `client: AcpClient \| null` | 14 | 客户端引用 |
| `start(options?)` | 16-144 | 启动子进程，5 秒启发式就绪检测，诊断事件追踪 |
| `stop()` | 147-161 | stdin.end() → SIGTERM → 等 3s → SIGKILL |
| `isRunning()` | 164-166 | `process !== null && exitCode === null` |
| `getClient()` | 168-169 | 返回 AcpClient 实例 |
| `getStatus()` | 172-180 | 返回 `{ running, baseUrl }` |

**启动流程** (`start`)：

1. 若已运行 → 直接返回（防重入）
2. 构建 CLI 参数：`['acp', 'serve']` + 可选 `--yolo / --allowed-tool / --disabled-tool`
3. 环境变量：PATH 预置 `~/.local/bin`，转发 `TRAECLI_PERSONAL_ACCESS_TOKEN`
4. `spawn('trae-cli', args, { stdio: ['pipe','pipe','pipe'], env })`
5. 注册 `stdout/stderr` 数据监听用于诊断
6. `setTimeout(() => ..., 5000)` — 5 秒后检查 `child.exitCode === null`：存活则 `succeed()`，否则 `fail()`
7. `succeed()` → `new AcpClient(child.stdin!, child.stdout!, child.stderr!)` → 保存引用 → resolve

**诊断系统**：启动过程中记录时间线事件（`spawn:start`, `spawn:created`, `process:error`, `process:close`, `startup:timeout`, `stdio:ready`）和最近 8 条输出片段，启动失败时附带诊断信息。

### 3.3 `src/utils/acp-client.ts` — JSON-RPC 2.0 客户端实现

**Class: `AcpClient`**

| 成员 | 行号 | 说明 |
|------|------|------|
| `stdin: Writable` | 44 | 管道写端（发往 trae-cli） |
| `stdout: Readable` | 45 | 管道读端（接收 trae-cli 响应） |
| `stderr: Readable` | 46 | 错误日志流 |
| `messageId: number` | 47 | 自增消息 ID，从 0 开始 |
| `pendingRequests: Map<number, PendingRequest>` | 48 | 待响应请求 |
| `requestTimeouts: Map<number, Timeout>` | 49 | 请求超时计时器 |
| `initialized: boolean` | 50 | 是否已完成 initialize |
| `sessionId: string \| null` | 51 | 当前会话 ID |
| `onUpdates: Array<Function>` | 52 | session/update 回调列表 |
| `buffer: string` | 53 | 不完整 JSON 行缓冲 |
| `REQUEST_TIMEOUT_MS = 60000` | 54 | 单请求 60 秒超时 |

**核心方法**：

| 方法 | 签名 | 行号 | 说明 |
|------|------|------|------|
| `initialize(clientInfo)` | `→ Promise<AcpInitializeResult>` | 78 | 发送 `initialize` 请求，设置 `initialized = true`。重复调用抛 `Already initialized` |
| `createSession(cwd, mcpServers)` | `→ Promise<AcpSessionNewResult>` | 93 | 发送 `session/new`，保存 `sessionId` |
| `loadSession(sessionId, cwd, mcpServers)` | `→ Promise<void>` | 107 | 发送 `session/load`。代码存在但未被任何命令调用 |
| `sessionPrompt(prompt, onUpdate?)` | `→ Promise<AcpSessionPromptResult>` | 121 | 发送 `session/prompt`，注册回调接收 `session/update` 通知，完成后清理回调 |
| `sessionCancel()` | `→ Promise<void>` | 145 | 发送 `session/cancel` |
| `getSessionId()` | `→ string \| null` | 153 | 获取当前会话 ID |
| `handleMessages(line)` | `private` | 157 | 解析 JSON 行 → 有 id 则匹配 pending request → 无 id 且 method=update 则调用回调 |
| `request(method, params)` | `private` | 186 | 构建 JSON-RPC 请求 → 注册 60s 超时 → 写入 stdin → 返回 Promise |

**消息解析逻辑**（构造函数 L66-75）：

```typescript
this.stdout.on('data', (chunk: Buffer) => {
  this.buffer += chunk.toString();           // 追加到缓冲
  const lines = this.buffer.split('\n');     // 按换行分割
  this.buffer = lines.pop() || '';           // 最后一行不完整，保留
  for (const line of lines) {                // 处理所有完整行
    if (line.trim()) this.handleMessages(line);
  }
});
```

**消息分发逻辑**（`handleMessages` L157-184）：

```
有 id 且 pendingRequests 中 → 清除超时 → resolve/reject → 从 Map 删除
method === "session/update" → 遍历 onUpdates 数组调用回调
其他所有消息 → 静默忽略（包括可能的 session/error、session/progress 等）
```

**接口类型定义**（L3-36）：

```typescript
interface AcpInitializeResult {
  protocolVersion: number;
  agentCapabilities: {
    loadSession?: boolean;
    promptCapabilities?: Record<string, any>;
    mcpCapabilities?: { http: boolean; sse: boolean };
    sessionCapabilities?: Record<string, any>;
  };
  agentInfo?: { name: string; title: string; version: string };
  authMethods: any[];
}

interface AcpSessionNewResult {
  sessionId: string;
  models?: { availableModels: any[]; currentModelId: string };
  modes?: { availableModes: any[]; currentModeId: string };
}

interface AcpSessionUpdate {
  sessionId: string;
  update: {
    sessionUpdate: string;
    content?: { type: string; text: string };
  };
}

interface AcpSessionPromptResult {
  stopReason: string;
}
```

---

## 四、六种操作模式详析

### 4.1 `acp start` — 阻塞长驻模式

```
serverManager.start(options)
    → spawn('trae-cli', ['acp', 'serve', ...], { stdio: 'pipe' })
    → 5s 后检查进程存活 → succeed()
    → await new Promise(() => {})  // 永久阻塞（L61）
```

**目的**：保持 Node.js 进程不退出，从而子进程存活。适用于需要长期运行 ACP Server 的场景。

**已知问题**：由于 `await new Promise(() => {})` 永远不 resolve，`stopServer()` 在同一进程中永远不会执行到。因此 `start` 和 `stop` 无法在同一进程配合使用。

### 4.2 `acp stop` — 停止服务

```
serverManager.isRunning()  → false (新进程, 无前序状态)  → "ACP Server 未运行"
```

**已知 Bug**：每个 CLI 调用是独立进程，`AcpServerManager` 无跨进程状态（无 PID 文件、无 Unix socket）。因此 `acp stop` 在终端中单独调用时**始终无效**，`acp status` 也始终显示"未运行"。

### 4.3 `acp status` — 状态查询

调用 `serverManager.getStatus()` 返回 `{ running: false, baseUrl: '' }`（独立进程下）。

### 4.4 `acp agents` — 发现 Agent

```
serverManager.start({ yolo: true })          // 自动启动
client.initialize({ name, version })         // 握手获取 agentInfo
打印 → agentInfo.name, agentInfo.version
     → protocolVersion
     → agentCapabilities.loadSession/mcpCapabilities/sessionCapabilities
finally → serverManager.stop()               // 自动停止
```

每次调用是**一次性**的：启动 → 查询 → 停止。

### 4.5 `acp run "任务"` — 一次性执行

```
serverManager.start({ yolo: true })          // 自动启动
client.initialize()                          // 握手
client.createSession(cwd, [])                // 新建会话
output = ''
client.sessionPrompt(prompt, (update) => {   // 发起任务
  output += update.update.content.text       // 累积输出
})
打印最终结果 + stopReason
finally → serverManager.stop()               // 自动停止
```

### 4.6 `acp stream "任务"` — 一次性流式执行

与 `run` 流程完全相同，唯一区别：

```typescript
client.sessionPrompt(prompt, (update) => {
  process.stdout.write(update.update.content.text)  // 实时打印
})
```

### run vs stream 对比

| 维度 | run | stream |
|------|-----|--------|
| 输出方式 | 累积到 `output` 变量，完成后一次性打印 | 每收到 update 立即 `process.stdout.write` |
| 用户体验 | 等待全部完成后才看到结果 | 实时看到 Agent 逐字输出 |
| 适用场景 | 需要完整结果处理（如管道传输给后续步骤） | 调试、长任务查看进度 |
| 代码差异 | L162-167, output += text | L216-219, stdout.write(text) |

---

## 五、平台集成差异

### Claude Code vs OpenCode

两种平台在 ACP 层面调用路径相同（都经过 `dist/index.js acp <action>`），但：

| 维度 | Claude Code (slash `/trae:acp`) | OpenCode (tool `trae-acp`) |
|------|--------|--------|
| 执行方式 | **进程内** — 直接 `import { acp }` 调用函数 | **子进程** — `spawn("node", [dist/index.js, "acp", ...])` |
| 状态保持 | `serverManager` 单例在同一进程内保持 | 每次调用是全新进程，无状态保持 |
| MCP 工具参数 | `action` + `prompt` + `yolo` + `allowed_tools` + `disabled_tools` | 相同（Bun 工具透传参数） |

---

## 六、已识别问题清单

### Bug

| # | 严重度 | 描述 | 位置 |
|---|--------|------|------|
| 1 | **高** | `stop` 命令跨进程无效 — 无 PID 文件或 IPC 机制，每次 CLI 调用是独立进程，`isRunning()` 总是 false | `acp.ts:67-76`, `acp-server-manager.ts:164-166` |
| 2 | **中** | `stop` 的 SIGKILL 无 try/catch，若进程已自然退出，`process.kill('SIGKILL')` 可能抛 `ESRCH` 异常 | `acp-server-manager.ts:154` |

### 设计问题

| # | 描述 | 位置 |
|---|------|------|
| 3 | **5 秒启动超时为启发式猜测** — 若 trae-cli 认证慢或需用户输入，则误判启动失败。应用协议级就绪通知替代 | `acp-server-manager.ts:130-143` |
| 4 | **`run/stream` 每次都在 `finally` 中 stop server** — 导致 `acp start --allowed-tool X` 启动的定制化服务无法被 `run` 复用，`run` 会自建新服务（yolo: true 无限制）然后杀掉 | `acp.ts:178, 226` |
| 5 | **无会话复用** — 每次 `run/agents` 创建新会话。`loadSession` 方法已实现但从未被任何命令调用，跨对话上下文保持不可用 | `acp-client.ts:107`, `acp.ts` 中零调用 |
| 6 | **客户端只处理 `session/update` 通知** — 其他服务端消息（如 `session/error`、`session/progress`、日志事件等）被 `handleMessages` 静默丢弃，可能遗漏重要信息 | `acp-client.ts:179-183` |
| 7 | **`start` 的永久阻塞使同进程内 stop 不可达** — `await new Promise(() => {})` 后代码不可到达，`startServer()` 中 try 块里的 `stop` 逻辑永不会执行 | `acp.ts:61` |

---

## 七、关键代码路径追踪

### 完整任务执行路径（`/trae:acp run "重构代码"`）

```
用户输入: /trae:acp run "重构代码"
  │
  ▼
src/index.ts → acp(['run', '重构代码'])
  │
  ▼
src/commands/acp.ts:17 → runViaAcp(args)
  │
  ├─ L130: serverManager.isRunning()? false
  ├─ L133: serverManager.start({ yolo: true })
  │     │
  │     ├─ L100: spawn('trae-cli', ['acp', 'serve', '--yolo'], { stdio: ['pipe','pipe','pipe'] })
  │     ├─ L130: setTimeout(5000) → 检查 exitCode === null → succeed()
  │     └─ L79:  new AcpClient(child.stdin, child.stdout, child.stderr)
  │
  ├─ L155: client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' })
  │     │
  │     ├─ L189: 发送 → {"jsonrpc":"2.0","id":1,"method":"initialize","params":{...}}
  │     └─ L78:  接收 ← {"id":1,"result":{"protocolVersion":1,"agentInfo":{...},...}}
  │
  ├─ L159: client.createSession(cwd, [])
  │     │
  │     ├─ L98:  发送 → {"jsonrpc":"2.0","id":2,"method":"session/new","params":{"cwd":"/path",...}}
  │     └─ L93:  接收 ← {"id":2,"result":{"sessionId":"abc-123"}}
  │
  ├─ L163: client.sessionPrompt("重构代码", callback)
  │     │
  │     ├─ L134: 发送 → {"jsonrpc":"2.0","id":3,"method":"session/prompt",
  │     │                 "params":{"sessionId":"abc-123","prompt":[{"type":"text","text":"重构代码"}]}}
  │     │
  │     ├─ L179: 接收 ← {"method":"session/update","params":{"sessionId":"abc-123",
  │     │              "update":{"content":{"text":"我来分析..."}}}}
  │     │              → callback(update) → output += text
  │     │
  │     ├─ L179: 接收 ← {"method":"session/update","params":{
  │     │              "update":{"content":{"text":"\n```ts\nimport ..."}}}}
  │     │              → callback(update) → output += text
  │     │
  │     └─ L165: 接收 ← {"id":3,"result":{"stopReason":"end_turn"}}
  │                → resolve → return result
  │
  ├─ L169-174: 打印 output + stopReason
  │
  └─ L178: finally { serverManager.stop() }
        │
        ├─ L149: stdin.end()
        ├─ L150: process.kill('SIGTERM')
        ├─ L151-157: setTimeout(3000) → kill('SIGKILL') if still alive
        └─ L159: process = null, client = null
```
