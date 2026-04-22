# Trae Plugin CC — 渐进式重构完整方案

## 生成时间
2026-04-22, 深度源码分析 + GitHub 开源项目对标研究

## 对标参考项目
- **aider** (43.7k⭐) — Python, CLI 架构, git 集成
- **plandex** (15.3k⭐) — Go, 模块化架构, REPL
- **copa-cmd** — CLI 参数解析最佳实践

---

# Phase 1: 修复关键 Bug (8 项)

## Fix 1: `src/commands/rescue.ts` — 无效 git 命令 (line 40)

**问题**: `git diff --stat -10` 不是有效的 git 命令

**修复**:
```diff
function getRecentChanges(): string {
  try {
-   return execSync('git diff --stat -10', { encoding: 'utf-8' }).trim();
+   return execSync('git log --stat -n 10 --oneline', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}
```

---

## Fix 2: `src/commands/run.ts` — `--resume=AUTO` 死代码路径 (line 23)

**问题**: `arg === '--resume' || arg === '--resume=AUTO'` 永远不会匹配，因为：
- `--resume` (无值) 被 line 20 的 `!args[i + 1].startsWith('-')` 排除后才会到这里
- `--resume=AUTO` 已经被 line 25 `arg.startsWith('--resume=')` 捕获

**修复**:
```diff
-   } else if (arg === '--resume' && args[i + 1] && !args[i + 1].startsWith('-')) {
+   } else if (arg === '--resume') {
+     if (args[i + 1] && !args[i + 1].startsWith('-')) {
+       config.resume = args[i + 1];
+       i++;
+     } else {
      config.resume = 'AUTO';
-   } else if (arg === '--resume' || arg === '--resume=AUTO') {
-     config.resume = 'AUTO';
-   } else if (arg.startsWith('--resume=')) {
+     }
+   } else if (arg.startsWith('--resume=')) {
      config.resume = arg.substring('--resume='.length);
-   } else if (arg === '--session-id' && args[i + 1]) {
```

---

## Fix 3: `src/utils/acp-server-manager.ts` — 缩进错误 + require() → import

**问题 1**: line 74 `const succeed = () => {` 缩进错误（少了 2 空格）
**问题 2**: line 85-86 在 TS 文件中使用 `require()` 与顶部 `import` 不一致
**问题 3**: line 103 `recordEvent('spawn:created'...)` 缩进异常

**修复**:
```typescript
// 顶部添加 import（替换 line 85-86 的 require）
import * as path from 'path';
import * as os from 'os';

// 替换 line 84-89 为：
const env: NodeJS.ProcessEnv = { ...process.env };
const homeBin = path.join(os.homedir(), '.local', 'bin');
const existingPath = env.PATH || '';
if (!existingPath.split(':').includes(homeBin)) {
  env.PATH = `${homeBin}:${existingPath}`;
}

// 修正 line 74-82 缩进为与 line 68-72 对齐
      const succeed = () => {
          if (settled) return;
          settled = true;
          const client = new AcpClient(child.stdin!, child.stdout!, child.stderr!);
          this.process = child;
          this.client = client;
          recordEvent('stdio:ready');
          resolve({ client });
        };

// 修正 line 103 缩进
      recordEvent('spawn:created', `pid=${child.pid || 'unknown'}`);
```

---

## Fix 4: `src/commands/review.ts` — 错误时 exit code 改为非零

**问题**: catch 块中仅 `console.error`，进程 exit 0

**修复**:
```diff
     } catch (error: any) {
         console.error('审查执行出错:', error.message);
+        process.exit(1);
     }
```

---

## Fix 5: `scripts/stop-review-gate-hook.mjs` — 改为真正可拦截

**问题**: 有 `--force` 时 exit 0，无 `--force` 时仍 exit 0。无法真正阻止 stop。

**修复**:
```diff
  console.log('─'.repeat(40));
  console.log('使用 --force 参数可强制退出');

- process.exit(0);
+ process.exit(1);  // 非零退出码才能真正阻止会话中止
```

---

## Fix 6: `src/utils/trae-executor.ts` — 前台执行添加超时机制

**问题**: `executeForeground()` 无超时，`trae-cli` 可能永远阻塞

**修改 `executeForeground` 方法**:
```typescript
private executeForeground(
  args: string[], env: NodeJS.ProcessEnv, taskId: string,
  logFile: string, pidFile: string, startTime: number,
  parseJson: boolean = false
): Promise<TraeTaskResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('trae-cli', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    if (child.pid) {
      fs.writeFileSync(pidFile, child.pid.toString());
    }

    let combinedOutput = '';
    let settled = false;

    const append = (chunk: Buffer) => {
      const text = chunk.toString();
      combinedOutput += text;
      fs.appendFileSync(logFile, text);
    };

    const settle = (result: TraeTaskResult) => {
      if (settled) return;
      settled = true;
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      resolve(result);
    };

    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      child.kill('SIGKILL');
      reject(error);
    };

    // 超时处理 (默认 5 分钟)
    const TIMEOUT_MS = 5 * 60 * 1000;
    const timeout = setTimeout(() => {
      fail(new Error(`任务执行超时 (${TIMEOUT_MS / 1000}s)`));
    }, TIMEOUT_MS);

    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    child.on('error', (error) => {
      clearTimeout(timeout);
      fail(new Error(`执行失败: ${error.message}`));
    });

    child.on('close', (code) => {
      clearTimeout(timeout);

      let jsonOutput: any = undefined;
      let sessionId: string | undefined;

      if (parseJson && combinedOutput.trim()) {
        try {
          jsonOutput = JSON.parse(combinedOutput);
          sessionId = jsonOutput?.session_id;
        } catch {}
      }

      settle({
        taskId,
        output: combinedOutput,
        exitCode: code,
        sessionId,
        duration: Date.now() - startTime,
        jsonOutput,
      });
    });
  });
}
```

---

## Fix 7: `src/utils/acp-client.ts` — 添加请求超时机制

**问题**: `request()` 方法无超时，ACP Server 永不响应时 Promise 永远挂起

**修改 `request` 方法和新增属性**:
```typescript
export class AcpClient {
  // ... existing properties ...
  private requestTimeout: Map<number, NodeJS.Timeout> = new Map();
  private readonly REQUEST_TIMEOUT_MS = 60000; // 60 秒

  private request(method: string, params: any): Promise<any> {
    const id = ++this.messageId;

    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method} (${this.REQUEST_TIMEOUT_MS}ms)`));
      }, this.REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject });
      this.requestTimeout.set(id, timeout);

      this.stdin.write(JSON.stringify(message) + '\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          this.requestTimeout.delete(id);
          reject(new Error(`Failed to write to stdin: ${err.message}`));
        }
      });
    });
  }

  // 修改 handleMessages 中清理超时的部分
  private handleMessages(line: string) {
    let message: any;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      const timeout = this.requestTimeout.get(message.id);
      if (timeout) {
        clearTimeout(timeout);
        this.requestTimeout.delete(message.id);
      }
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
    } else if (message.method === 'session/update' && message.params) {
      for (const fn of this.onUpdates) {
        fn(message.params);
      }
    }
  }
}
```

---

## Fix 8: `.opencode/tools/*.ts` — 移除 `.quiet()` 隐藏 stderr

**问题**: 所有 9 个工具文件使用 `.quiet()` 隐藏 stderr，调试困难

**修复每个工具文件** (以 `trae-run.ts` 为例，其他 8 个同理):
```diff
- const result = await cmd.quiet();
+ const result = await cmd;
+ if (result.exitCode !== 0 && result.stderr) {
+   process.stderr.write(result.stderr);
+ }
  return result.stdout;
```

所有受影响文件:
- `.opencode/tools/trae-setup.ts`
- `.opencode/tools/trae-run.ts`
- `.opencode/tools/trae-review.ts`
- `.opencode/tools/trae-sessions.ts`
- `.opencode/tools/trae-acp.ts`
- `.opencode/tools/trae-status.ts`
- `.opencode/tools/trae-result.ts`
- `.opencode/tools/trae-cancel.ts`
- `.opencode/tools/trae-rescue.ts`

---

# Phase 2: 消除重复代码 (DRY) — 4 项

## Refactor 1: 创建 `src/config.ts` — 全局配置常量

**新建文件** `src/config.ts`:
```typescript
import * as path from 'path';
import * as os from 'os';

export const PLUGIN_DIR_NAME = '.claude-trae-plugin';

export function getPluginDir(): string {
  return path.join(process.cwd(), PLUGIN_DIR_NAME);
}

export function getCliCacheDirs(): string[] {
  const homeDir = os.homedir();
  return [
    path.join(homeDir, 'Library', 'Caches', 'trae-cli'),
    path.join(homeDir, 'Library', 'Caches', 'trae_cli'),
    path.join(homeDir, '.cache', 'trae-cli'),
    path.join(homeDir, '.cache', 'trae_cli'),
  ];
}

export function getTraeCliConfigPath(): string {
  return path.join(os.homedir(), '.trae', 'trae_cli.yaml');
}
```

---

## Refactor 2: 创建 `src/utils/env.ts` — 统一 PATH 构建

**新建文件** `src/utils/env.ts`:
```typescript
import * as path from 'path';
import * as os from 'os';

const HOME_BIN = path.join(os.homedir(), '.local', 'bin');

/**
 * Build a spawn environment with ~/.local/bin prepended to PATH if not present.
 * Consolidates duplicate logic from 6+ locations.
 */
export function buildSpawnEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  const existingPath = env.PATH || '';
  if (!existingPath.split(':').includes(HOME_BIN)) {
    env.PATH = `${HOME_BIN}:${existingPath}`;
  }
  if (process.env.TRAECLI_PERSONAL_ACCESS_TOKEN) {
    env.TRAECLI_PERSONAL_ACCESS_TOKEN = process.env.TRAECLI_PERSONAL_ACCESS_TOKEN;
  }
  return env;
}

/**
 * Check if a path is already in the PATH environment variable.
 */
export function isInPath(dirPath: string): boolean {
  const existingPath = process.env.PATH || '';
  return existingPath.split(':').includes(dirPath);
}
```

**然后修改以下文件中的引用**:

`src/utils/auth-bridge.ts` — 替换 `buildSpawnEnv()` 方法:
```diff
-  buildSpawnEnv(): NodeJS.ProcessEnv {
-    const env = { ...process.env };
-    const homeBin = path.join(os.homedir(), '.local', 'bin');
-    const existingPath = env.PATH || '';
-    if (!existingPath.split(':').includes(homeBin)) {
-      env.PATH = `${homeBin}:${existingPath}`;
-    }
-    return env;
-  }
+  buildSpawnEnv(): NodeJS.ProcessEnv {
+    return buildSpawnEnv();  // 从 env.ts 导入
+  }
```

`src/utils.ts` — 替换 `getTraeCliEnv()`:
```diff
- function getTraeCliEnv(): NodeJS.ProcessEnv {
-   const env = { ...process.env };
-   const homeBin = path.join(os.homedir(), '.local', 'bin');
-   const existingPath = env.PATH || '';
-   if (!existingPath.split(':').includes(homeBin)) {
-     env.PATH = `${homeBin}:${existingPath}`;
-   }
-   return env;
- }
+ import { buildSpawnEnv } from './utils/env';
+ // 在 isTraeCliInstalled 中使用:
+ const env = buildSpawnEnv();
```

`src/utils/acp-server-manager.ts` — 替换 row 84-92:
```diff
- const env: NodeJS.ProcessEnv = { ...process.env };
- const homeBin = require('path').join(require('os').homedir(), '.local', 'bin');
- const existingPath = env.PATH || '';
- if (!existingPath.split(':').includes(homeBin)) {
-   env.PATH = `${homeBin}:${existingPath}`;
- }
+ import { buildSpawnEnv } from './env';
+ const env = buildSpawnEnv();
```

`scripts/session-lifecycle-hook.mjs` — 替换 PATH 构建:
```diff
- // duplicate PATH logic
+ import { buildSpawnEnv } from '../dist/utils/env.js';
+ const env = buildSpawnEnv();
```

---

## Refactor 3: 移除 `scripts/trae-companion.mjs` 死代码

**选项 A (推荐)**: 删除该文件。它复制了 50% 的 `src/` 逻辑，且有独立的 config 路径导致行为不一致。

**选项 B**: 合并到主入口（如果确实需要独立入口）。

由于它未被 `hooks.json` 或任何 OpenCode 工具引用，**建议直接删除**。

---

## Refactor 4: 统一 `src/utils.ts` 和 `TraeExecutor` 的 `runTraeCli` 实现

`runTraeCli()` (utils.ts line 57-123) 和 `TraeExecutor.execute()` 做相同的事情但实现不同。

**修改 `rescue.ts` 使用 TraeExecutor 替代 runTraeCli**:
```diff
- import { runTraeCli } from '../utils';
+ import { TraeExecutor, TraeTaskConfig } from '../utils/trae-executor';

- const result = await runTraeCli(diagnosisPrompt, false);
+ const executor = new TraeExecutor();
+ const result = await executor.execute({ prompt: diagnosisPrompt });
```

**然后从 `src/utils.ts` 中移除 `runTraeCli` 函数** (保留 barrel 导出)。

---

# Phase 3: 代码质量提升 — 4 项

## Refactor 5: 移除 `SessionReader` 死代码

**文件**: `src/utils/session-reader.ts`，line 91, 311-317

```diff
  export class SessionReader {
    private sessionsDir: string;
    private historyFile: string;
-   private jsonOutputCache: Map<string, JsonOutputSession> = new Map();
```

**移除以下方法** (从没人调用过):
```diff
- cacheJsonOutput(sessionId: string, output: JsonOutputSession): void {
-   this.jsonOutputCache.set(sessionId, output);
- }
- 
- getJsonOutputSession(sessionId: string): JsonOutputSession | null {
-   return this.jsonOutputCache.get(sessionId) || null;
- }
```

---

## Refactor 6: 修复 `AcpClient` — stderr 流未被使用

**文件**: `src/utils/acp-client.ts`

```diff
  constructor(stdin: Writable, stdout: Readable, stderr: Readable) {
    this.stdin = stdin;
    this.stdout = stdout;
    this.stderr = stderr;

+   // 收集 stderr 输出用于调试
+   const stderrChunks: string[] = [];
+   stderr.on('data', (chunk: Buffer) => {
+     stderrChunks.push(chunk.toString());
+   });

    this.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
```

---

## Refactor 7: 统一错误类型 (移除 `any`)

**新增** `src/types/errors.ts`:
```typescript
export class TraeCliError extends Error {
  public readonly code: string;
  constructor(message: string, code: string = 'UNKNOWN') {
    super(message);
    this.name = 'TraeCliError';
    this.code = code;
  }
}

export class AuthError extends TraeCliError {
  constructor(message: string) {
    super(message, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class ExecutionError extends TraeCliError {
  public readonly exitCode?: number;
  constructor(message: string, exitCode?: number) {
    super(message, 'EXECUTION_ERROR');
    this.name = 'ExecutionError';
    this.exitCode = exitCode;
  }
}

export class SessionNotFoundError extends TraeCliError {
  constructor(sessionId: string) {
    super(`Session not found: ${sessionId}`, 'SESSION_NOT_FOUND');
    this.name = 'SessionNotFoundError';
  }
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}

export function getErrorMessage(error: unknown): string {
  return isError(error) ? error.message : String(error);
}
```

**修改 `src/index.ts` 的 error handler**:
```diff
- } catch (error: any) {
-   console.error('执行失败:', error.message);
+ } catch (error: unknown) {
+   console.error('执行失败:', getErrorMessage(error));
    process.exit(1);
  }
```

所有命令文件中的 `catch (error: any)` 改为 `catch (error: unknown)` 并使用 `getErrorMessage(error)`。

---

## Refactor 8: 统一 PLUGIN_DIR — 全部使用 `src/config.ts`

**需修改的文件**:
- `src/utils.ts` (line 9)
- `src/utils/trae-executor.ts` (line 30)
- `src/commands/jobs.ts` (line 4)
- `src/commands/rescue.ts` (line 6)

每个文件将 `const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');` 替换为：
```diff
- const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');
+ import { getPluginDir } from '../config';
+ const PLUGIN_DIR = getPluginDir();
```

---

# Phase 4: 补充测试覆盖 (5 个测试文件)

## Test 1: `tests/commands/run.test.ts` — 完整参数测试

```typescript
import { runTask } from '../../src/commands/run';
import { TraeExecutor } from '../../src/utils/trae-executor';
import { ContextBridge } from '../../src/utils/context-bridge';

jest.mock('../../src/utils/trae-executor');
jest.mock('../../src/utils/context-bridge');

describe('runTask', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should execute task with basic prompt', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'done', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['execute this task']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'execute this task' })
    );
  });

  it('should pass --yolo flag', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'done', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['task', '--yolo']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'task', yolo: true })
    );
  });

  it('should pass --background flag', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'bg task', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['task', '--background']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'task', background: true })
    );
  });

  it('should pass --resume=AUTO', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'resumed', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['continue', '--resume']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'continue', resume: 'AUTO' })
    );
  });

  it('should pass --resume with session ID', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'resumed', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['continue', '--resume', 'session-abc']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'continue', resume: 'session-abc' })
    );
  });

  it('should pass --json flag', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: '{"result": "ok"}', exitCode: 0, jsonOutput: { result: 'ok' }, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['task', '--json']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'task', jsonOutput: true })
    );
  });

  it('should pass --worktree flag', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'worktree', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['task', '--worktree']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'task', worktree: '__auto__' })
    );
  });

  it('should pass --allowed-tool flag', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'done', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['task', '--allowed-tool', 'Read', '--allowed-tool', 'Edit']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'task', allowedTools: ['Read', 'Edit'] })
    );
  });

  it('should pass --disallowed-tool flag', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'done', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['task', '--disallowed-tool', 'Bash']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'task', disallowedTools: ['Bash'] })
    );
  });

  it('should return early when no prompt provided', async () => {
    const mockExecute = jest.fn();
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

    await runTask(['--yolo']);

    expect(mockExecute).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle --resume=AUTO in combined form', async () => {
    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '123', output: 'auto', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    await runTask(['task', '--resume=AUTO']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: 'task', resume: 'AUTO' })
    );
  });
});
```

---

## Test 2: `tests/commands/review.test.ts` — 完整覆盖

```typescript
import { review } from '../../src/commands/review';
import * as utils from '../../src/utils';
import { detectBaseBranch, estimateReviewSize } from '../../src/utils/branch-detection';
import { TraeExecutor } from '../../src/utils/trae-executor';

jest.mock('../../src/utils');
jest.mock('../../src/utils/branch-detection');
jest.mock('../../src/utils/trae-executor');

describe('review', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  it('should perform standard review', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('main');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'main',
      linesAdded: 10, linesDeleted: 5, filesChanged: 2, untrackedFiles: [], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('@@ diff @@');

    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '1', output: 'review done', exitCode: 0, sessionId: 's1', duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review([]);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('标准的专业代码审查'),
      })
    );
    consoleSpy.mockRestore();
  });

  it('should perform adversarial review', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('main');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'main',
      linesAdded: 10, linesDeleted: 5, filesChanged: 2, untrackedFiles: [], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('@@ diff @@');

    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '1', output: 'review done', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review([], true);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('极度严苛的对抗性代码审查员'),
      })
    );
    consoleSpy.mockRestore();
  });

  it('should return early when no diff', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('main');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'main',
      linesAdded: 0, linesDeleted: 0, filesChanged: 0, untrackedFiles: [], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('');

    const mockExecute = jest.fn();
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review([]);

    expect(mockExecute).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should parse --base flag', async () => {
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'develop',
      linesAdded: 10, linesDeleted: 5, filesChanged: 2, untrackedFiles: [], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('@@ diff @@');

    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '1', output: 'done', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review(['--base', 'develop']);

    expect(detectBaseBranch).not.toHaveBeenCalled();
    expect(utils.getGitDiff).toHaveBeenCalledWith('develop');
    consoleSpy.mockRestore();
  });

  it('should auto-enable background for large changes', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('main');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: true }, baseBranch: 'main',
      linesAdded: 600, linesDeleted: 400, filesChanged: 20, untrackedFiles: [], estimatedTime: 'lengthy',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('@@ diff @@');

    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '1', output: 'bg done', exitCode: 0, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review([]);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ background: true })
    );
    consoleSpy.mockRestore();
  });

  it('should pass --yolo and --json flags', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('main');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'main',
      linesAdded: 10, linesDeleted: 5, filesChanged: 2, untrackedFiles: [], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('@@ diff @@');

    const mockExecute = jest.fn().mockResolvedValue({
      taskId: '1', output: '{"review":"done"}', exitCode: 0, jsonOutput: { review: 'done' }, duration: 100,
    });
    (TraeExecutor as jest.Mock).mockImplementation(() => ({ execute: mockExecute }));

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review(['--yolo', '--json']);

    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({ yolo: true, jsonOutput: true })
    );
    consoleSpy.mockRestore();
  });
});
```

---

## Test 3: `tests/utils/trae-executor.test.ts`

```typescript
import { TraeExecutor } from '../../src/utils/trae-executor';
import { spawn } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  openSync: jest.fn().mockReturnValue(3),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('TraeExecutor', () => {
  let executor: TraeExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new TraeExecutor();
  });

  describe('buildArgs', () => {
    it('should build basic args with --print and prompt', async () => {
      const mockChild = {
        on: jest.fn((event, cb) => { if (event === 'close') cb(0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'test task' });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--print', 'test task']),
        expect.any(Object)
      );
    });

    it('should build args with --yolo', async () => {
      const mockChild = {
        on: jest.fn((event, cb) => { if (event === 'close') cb(0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'test', yolo: true });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--yolo', '--print', 'test']),
        expect.any(Object)
      );
    });

    it('should build args with --json', async () => {
      const mockChild = {
        on: jest.fn((event, cb) => { if (event === 'close') cb(0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'test', jsonOutput: true });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--print', '--json', 'test']),
        expect.any(Object)
      );
    });

    it('should build args with --resume', async () => {
      const mockChild = {
        on: jest.fn((event, cb) => { if (event === 'close') cb(0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'continue', resume: 'session-123' });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--resume', 'session-123', '--print', 'continue']),
        expect.any(Object)
      );
    });

    it('should build args with --worktree', async () => {
      const mockChild = {
        on: jest.fn((event, cb) => { if (event === 'close') cb(0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'test', worktree: '__auto__' });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--worktree', '--print', 'test']),
        expect.any(Object)
      );
    });

    it('should build args with allowed/disallowed tools', async () => {
      const mockChild = {
        on: jest.fn((event, cb) => { if (event === 'close') cb(0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({
        prompt: 'test',
        allowedTools: ['Read', 'Edit'],
        disallowedTools: ['Bash'],
      });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining([
          '--allowed-tool', 'Read',
          '--allowed-tool', 'Edit',
          '--disallowed-tool', 'Bash',
          '--print', 'test',
        ]),
        expect.any(Object)
      );
    });
  });

  describe('background execution', () => {
    it('should spawn detached process for background tasks', async () => {
      const mockChild = {
        on: jest.fn(),
        unref: jest.fn(),
        stdout: null,
        stderr: null,
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      const result = await executor.execute({ prompt: 'bg task', background: true });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.any(Array),
        expect.objectContaining({ detached: true })
      );
      expect(mockChild.unref).toHaveBeenCalled();
      expect(result.background).toBe(true);
    });
  });
});
```

---

## Test 4: `tests/utils/env.test.ts`

```typescript
import { buildSpawnEnv, isInPath } from '../../src/utils/env';

describe('env utilities', () => {
  describe('buildSpawnEnv', () => {
    it('should prepend ~/.local/bin to PATH if not present', () => {
      const originalPath = process.env.PATH;
      process.env.PATH = '/usr/bin:/bin';

      const env = buildSpawnEnv();
      expect(env.PATH).toMatch(/^.*\.local\/bin:/);

      process.env.PATH = originalPath;
    });

    it('should not duplicate ~/.local/bin if already in PATH', () => {
      const originalPath = process.env.PATH;
      process.env.PATH = '/Users/test/.local/bin:/usr/bin:/bin';

      const env = buildSpawnEnv();
      expect(env.PATH).toBe('/Users/test/.local/bin:/usr/bin:/bin');

      process.env.PATH = originalPath;
    });

    it('should forward TRAECLI_PERSONAL_ACCESS_TOKEN', () => {
      const originalToken = process.env.TRAECLI_PERSONAL_ACCESS_TOKEN;
      process.env.TRAECLI_PERSONAL_ACCESS_TOKEN = 'test-token';

      const env = buildSpawnEnv();
      expect(env.TRAECLI_PERSONAL_ACCESS_TOKEN).toBe('test-token');

      process.env.TRAECLI_PERSONAL_ACCESS_TOKEN = originalToken;
    });
  });

  describe('isInPath', () => {
    it('should return true if dir is in PATH', () => {
      const originalPath = process.env.PATH;
      process.env.PATH = '/usr/local/bin:/usr/bin';

      expect(isInPath('/usr/local/bin')).toBe(true);
      expect(isInPath('/not/in/path')).toBe(false);

      process.env.PATH = originalPath;
    });
  });
});
```

---

## Test 5: `tests/utils/auth-bridge.test.ts`

```typescript
import { AuthBridge } from '../../src/utils/auth-bridge';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

jest.mock('fs');
jest.mock('js-yaml');

describe('AuthBridge', () => {
  let bridge: AuthBridge;

  beforeEach(() => {
    jest.clearAllMocks();
    bridge = new AuthBridge();
  });

  describe('loadConfig', () => {
    it('should return null if config file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(bridge.loadConfig()).toBeNull();
    });

    it('should parse and cache YAML config', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('model:\n  name: claude-sonnet');
      (yaml.load as jest.Mock).mockReturnValue({ model: { name: 'claude-sonnet' } });

      const config = bridge.loadConfig();
      expect(config).toEqual({ model: { name: 'claude-sonnet' } });
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);

      // Should return cached value
      bridge.loadConfig();
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return null on parse error', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid: yaml: :');
      (yaml.load as jest.Mock).mockImplementation(() => { throw new Error('bad yaml'); });

      expect(bridge.loadConfig()).toBeNull();
    });
  });

  describe('getters', () => {
    it('should return default login URL when not configured', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(bridge.getLoginBaseUrl()).toBe('https://console.enterprise.trae.cn');
    });

    it('should return model name from config', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('model:\n  name: claude-3.5');
      (yaml.load as jest.Mock).mockReturnValue({ model: { name: 'claude-3.5' } });

      expect(bridge.getModelName()).toBe('claude-3.5');
    });
  });
});
```

---

# Phase 5: 构建验证 + 端到端测试

## 构建验证步骤

```bash
# 1. 编译
npm run build

# 2. 运行所有单元测试
npm test

# 3. 验证构建输出
ls -la dist/index.js
head -1 dist/index.js  # 应该是 #!/usr/bin/env node
```

## 端到端测试清单 (模拟人类操作)

### E2E-1: setup 命令
```bash
# 验证 trae-cli 安装检查
node dist/index.js setup

# 预期输出: 显示安装状态、认证状态、模型信息
```

### E2E-2: run 命令
```bash
# 基本任务
node dist/index.js run "解释一下这个仓库是什么"

# 带 yolo
node dist/index.js run "列出当前目录的文件" --yolo

# 后台模式
node dist/index.js run "分析代码结构" --background

# 检查后台状态
node dist/index.js status

# 查看后台结果
node dist/index.js result <task-id>

# JSON 输出
node dist/index.js run "输出 hello world" --json

# 恢复会话
node dist/index.js run "继续" --resume <session-id>

# worktree 隔离
node dist/index.js run "开发新功能" --worktree
```

### E2E-3: review 命令
```bash
# 标准审查 (需要在有变更的仓库)
node dist/index.js review

# 指定基准分支
node dist/index.js review --base develop

# 对抗性审查
node dist/index.js adversarial-review

# yolo 模式
node dist/index.js review --yolo
```

### E2E-4: sessions 命令
```bash
# 列出所有会话
node dist/index.js sessions list

# 列出最近 5 个
node dist/index.js sessions list --limit 5

# 查看详情
node dist/index.js sessions detail <session-id>

# 查看对话
node dist/index.js sessions conversation <session-id>

# 查看工具调用
node dist/index.js sessions tools <session-id>

# 查看上下文
node dist/index.js sessions context <session-id>

# 最近会话
node dist/index.js sessions recent

# 搜索
node dist/index.js sessions find "用户模块"
```

### E2E-5: rescue 命令
```bash
# 基本救援
node dist/index.js rescue

# 带上下文
node dist/index.js rescue --context "用户报告功能失效"
```

### E2E-6: acp 命令
```bash
# 状态检查
node dist/index.js acp status
```

### E2E-7: cancel 命令
```bash
# 取消任务
node dist/index.js cancel <task-id>
```

---

# 总结

| Phase | 项 | 变更文件 | 行数变化 |
|-------|----|----------|----------|
| 1 | Fix 1 | `src/commands/rescue.ts` | +1/-2 |
| 1 | Fix 2 | `src/commands/run.ts` | ~8行重构 |
| 1 | Fix 3 | `src/utils/acp-server-manager.ts` | ~10行重构 |
| 1 | Fix 4 | `src/commands/review.ts` | +1 |
| 1 | Fix 5 | `scripts/stop-review-gate-hook.mjs` | +1/-1 |
| 1 | Fix 6 | `src/utils/trae-executor.ts` | ~20行重构 |
| 1 | Fix 7 | `src/utils/acp-client.ts` | ~15行增加 |
| 1 | Fix 8 | `.opencode/tools/*.ts` (9 files) | +4/-1 each |
| 2 | Ref 1 | `src/config.ts` (new) | +25 |
| 2 | Ref 2 | `src/utils/env.ts` (new) | +30 |
| 2 | Ref 3 | `scripts/trae-companion.mjs` (delete) | -131 |
| 2 | Ref 4 | `src/commands/rescue.ts` + `src/utils.ts` | ~10/-30 |
| 3 | Ref 5 | `src/utils/session-reader.ts` | -8 |
| 3 | Ref 6 | `src/utils/acp-client.ts` | +6 |
| 3 | Ref 7 | `src/types/errors.ts` (new) + all commands | ~50 + ~20 |
| 3 | Ref 8 | 4 files (config统一) | ~8 |
| 4 | Tests | 5 new test files | ~600+ |

**总计预估**: ~25 文件变更, ~750 行增加, ~250 行删除