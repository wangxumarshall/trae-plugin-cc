# Trae Plugin for Claude Code

一个"寄生式" Claude Code 插件，将字节跳动开源的 LLM 软件工程 Agent [trae-cli](https://github.com/bytedance/trae-agent) 无缝集成到 Claude Code 中。

灵感来自 `openai/codex-plugin-cc`，本插件允许你通过斜杠命令（`/trae:` 前缀）在 Claude Code 内部直接执行 `trae-cli`，**无需额外运行时、二次认证或浪费 Token**。

## 核心理念

**"寄生式"架构**意味着：

- **不引入新运行时** — 完全依赖本地已安装的 `trae-cli`
- **不处理 Token 或 LLM 调用** — 让 `trae-cli` 使用自己的配置（`trae_config.yaml`）
- **进程隔离** — 通过 `child_process.spawn` 启动 `trae-cli` 子进程，与 Claude Code 的 Token/配置完全隔离
- **上下文继承** — 插件与 Claude Code 运行在同一工作目录，`trae-cli` 自然继承代码库上下文

## 特性

- **零额外运行时**：完全依赖本地 `trae-cli` 安装
- **上下文注入**：自动抓取 Git diff 并直接传给 Trae Agent 审查
- **对抗性审查**：让 Trae Agent 严苛审查变更，专挑问题、质疑假设
- **任务委托**：Claude Code 卡住时，将任务交给 Trae Agent 尝试解决
- **后台任务**：长时间运行的审查和任务可放到后台，稍后查看状态
- **审查门（Review Gate）**：确保代码质量，启用 Stop Hook 后，Claude Code 在停止前会提醒你先做 `/trae:review`
- **智能审查预处理**：自动检测基准分支、估算变更规模、推荐执行模式
- **故障诊断**：任务失败时自动收集上下文，让 Trae Agent 分析原因并给出恢复建议

## 前置条件

必须在机器上全局安装 `trae-cli`。

如果尚未安装，安装插件后在 Claude Code 中运行 `/trae:setup`，或手动执行：

```bash
git clone https://github.com/bytedance/trae-agent.git
cd trae-agent
uv sync --all-extras
cp trae_config.yaml.example trae_config.yaml
# 编辑 trae_config.yaml 填入你的 provider/API key
uv tool install .
```

确保 `trae-cli --help` 在终端中可以正常运行。

## 安装

在 Claude Code 中执行：

```bash
/plugin marketplace add wangxumarshall/trae-plugin-cc
/plugin install trae@wangxumarshall-trae-plugin-cc
/reload-plugins
```

然后验证安装：

```bash
/trae:setup
```

## 命令

### 标准审查与对抗性审查

- `/trae:review [--base main] [--background]`：对当前 Git 变更与 `main`（或指定基准分支）进行标准的专业代码审查
- `/trae:adversarial-review [--base main] [--background]`：进行对抗性审查，Trae Agent 会专门挑刺、质疑假设、寻找深层逻辑错误

> 插件会自动获取 `git diff`，无需手动指定。

**智能预处理流程**：

1. **自动检测基准分支** — 四级 fallback 策略：当前分支 upstream → 当前分支是否为主分支 → 远程 HEAD 分支 → 逐一尝试 main/master/develop/dev/mainline
2. **估算变更规模** — 按变更行数分级：`快速`(<100行) → `中等`(<500行) → `较长`(<2000行) → `非常长`(≥2000行)
3. **智能建议** — 变更≥100行时自动推荐后台模式，可直接自动启用

### 任务委托

- `/trae:run "重构用户模块" [--background]`：将自然语言任务委托给 Trae Agent 执行

### 后台任务管理

使用 `--background` 运行命令后，可通过以下命令管理：

- `/trae:status`：列出所有后台任务及其运行状态
- `/trae:result <Task ID>`：获取指定任务的输出结果
- `/trae:cancel <Task ID>`：强制终止指定后台任务

### 故障诊断

- `/trae:rescue [--context "额外信息"] [--retries 3] [--force]`：当任务失败时，自动收集最近错误日志、Git 状态等信息，让 Trae Agent 分析问题原因并提供恢复建议

### 环境检查

- `/trae:setup`：检查 `trae-cli` 安装状态和配置文件，引导完成初始化

## 架构详解

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code IDE                       │
│                                                          │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │ Slash 命令    │    │  Hooks 生命周期钩子            │   │
│  │ /trae:*      │    │  SessionStart/End/Stop/Post   │   │
│  └──────┬───────┘    └──────────┬───────────────────┘   │
│         │                       │                        │
│         ▼                       ▼                        │
│  ┌──────────────────────────────────────────────────┐   │
│  │           plugin.json + .mcp.json                │   │
│  │     (Claude Code 插件注册 & MCP 工具声明)          │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         │                                │
│         ┌───────────────┼───────────────┐               │
│         ▼               ▼               ▼               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ TypeScript │  │  .mjs 脚本  │  │ commands/  │        │
│  │  编译入口   │  │  Hook 执行  │  │  .md 命令  │        │
│  │ dist/      │  │  scripts/   │  │  定义文件   │        │
│  └─────┬──────┘  └─────┬──────┘  └────────────┘        │
│        │               │                                 │
│        ▼               ▼                                 │
│  ┌──────────────────────────────────────────────────┐   │
│  │         child_process.spawn('trae-cli')          │   │
│  │              (寄生式执行核心)                      │   │
│  └──────────────────────┬───────────────────────────┘   │
│                         ▼                                │
│              ┌──────────────────┐                        │
│              │   trae-cli 进程   │                        │
│              │ (独立 LLM Agent)  │                        │
│              └──────────────────┘                        │
└─────────────────────────────────────────────────────────┘
```

### 核心模块

| 模块 | 文件 | 职责 |
|------|------|------|
| CLI 入口 | `src/index.ts` | 解析命令行参数，路由到对应处理器 |
| 工具层 | `src/utils.ts` | trae-cli 安装检测、Git diff 获取、子进程执行引擎 |
| 审查模块 | `src/commands/review.ts` | 标准/对抗性审查，智能预处理 |
| 分支检测 | `src/utils/branch-detection.ts` | 基准分支自动检测、变更规模估算 |
| 任务委托 | `src/commands/run.ts` | 自然语言任务透传给 trae-cli |
| 任务管理 | `src/commands/jobs.ts` | 后台任务状态查询、结果获取、强制终止 |
| 故障诊断 | `src/commands/rescue.ts` | 收集失败上下文，让 Trae Agent 诊断问题 |
| 钩子代理 | `src/commands/hooks.ts` | 将钩子调用转发到 .mjs 脚本 |
| 伴生入口 | `scripts/trae-companion.mjs` | 独立 ESM 入口，支持 --json 输出 |

### 插件注册机制

- **`plugin.json`** — 声明插件名称（`trae`）、描述、版本和仓库地址
- **`marketplace.json`** — 市场注册信息，定义插件来源 URL 和 `strict: true` 模式
- **`.mcp.json`** — MCP（Model Context Protocol）工具声明，暴露 `trae_run` 工具给 Claude，接受 `prompt` 参数，使 Claude Code 可直接调用 Trae Agent 作为工具
- **`commands/*.md`** — 每个斜杠命令的声明文件，包含 `description`（Claude Code 用于理解命令用途）和 `allowed-tools`（声明命令执行时需要的权限，如 `Bash(git:*)`、`Bash(trae-cli:*)`）

### 钩子系统

| 钩子 | 触发时机 | 作用 |
|------|---------|------|
| `SessionStart` | Claude Code 会话启动 | 检查 trae-cli 安装/配置状态，报告运行中任务 |
| `SessionEnd` | 会话结束 | 清理7天以上的旧日志，提醒未完成的后台任务 |
| `Stop` | Claude Code 停止前 | **审查门**：检测未提交变更和运行中任务，提醒用户先做 review |
| `PostToolUse` | 使用 `trae:review` 后 | PostReview 占位（预留扩展） |

### 数据流

```
用户输入 /trae:review
    │
    ▼
Claude Code 解析 slash command → 读取 commands/review.md
    │
    ▼
执行: npx trae-plugin-cc review [--base main] [--background]
    │
    ▼
dist/index.ts → review()
    │
    ├→ detectBaseBranch()     自动检测基准分支
    ├→ estimateReviewSize()   估算变更规模
    ├→ getGitDiff()           获取代码差异
    ├→ 构建 review prompt
    └→ runTraeCli(prompt)     spawn trae-cli 子进程
         │
         ▼
    trae-cli run --print "审查提示词 + diff"
         │
         ▼
    Trae Agent (独立 LLM) 处理并返回结果
         │
         ▼
    结果流式输出到 stdout + 写入 .claude-trae-plugin/{timestamp}.log
```

### 运行时数据

所有运行时数据存放在 `.claude-trae-plugin/` 目录下：

- `{timestamp}.log` — 任务输出日志
- `{timestamp}.pid` — 进程 PID 文件（文件存在表示任务运行中）

### 安全设计

1. **Git Ref 注入防护** — `isSafeGitRef()` 使用正则 `/^[A-Za-z0-9._\/-]+$/` 校验分支名，防止命令注入
2. **固定命令执行** — 所有 `execSync` 调用都使用硬编码命令，不拼接用户输入
3. **进程隔离** — `trae-cli` 在独立子进程中运行，不共享 Claude Code 的 Token/配置
4. **PID 文件管理** — 进程结束后自动清理 PID 文件，cancel 时使用 SIGKILL 确保终止

## 技术栈

| 层面 | 技术 |
|------|------|
| 语言 | TypeScript (strict mode) |
| 运行时 | Node.js (ES2022 target, CommonJS modules) |
| 构建 | `tsc` → `dist/` |
| 测试 | Jest 30 + ts-jest 29 |
| 插件框架 | Claude Code Plugin (plugin.json + .mcp.json + hooks.json) |
| Hook 脚本 | ESM (.mjs)，独立于 TypeScript 编译链 |
| 外部依赖 | `trae-cli`（字节 Trae Agent CLI，Python/uv 工具链） |
| 进程管理 | `child_process.spawn` / `exec` |
| 状态持久化 | 文件系统（`.claude-trae-plugin/` 目录） |

## Author

Created by wangxumarshall.
