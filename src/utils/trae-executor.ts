import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AuthBridge } from './auth-bridge';
import { getPluginDir } from '../config';
import { TraeTaskConfig, TraeTaskResult } from '../types';

const PLUGIN_DIR = getPluginDir();

function ensurePluginDir(): void {
  if (!fs.existsSync(PLUGIN_DIR)) {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  }
}

export class TraeExecutor {
  private authBridge: AuthBridge;

  constructor() {
    this.authBridge = new AuthBridge();
  }

  async execute(config: TraeTaskConfig): Promise<TraeTaskResult> {
    ensurePluginDir();

    const taskId = Date.now().toString();
    const logFile = path.join(PLUGIN_DIR, `${taskId}.log`);
    const pidFile = path.join(PLUGIN_DIR, `${taskId}.pid`);
    const args = this.buildArgs(config);
    const env = this.authBridge.buildSpawnEnv();
    const startTime = Date.now();

    if (config.background) {
      return this.executeBackground(args, env, taskId, logFile, pidFile, startTime);
    }

    return this.executeForeground(args, env, taskId, logFile, pidFile, startTime, config.jsonOutput);
  }

  private buildArgs(config: TraeTaskConfig): string[] {
    const args: string[] = [];

    if (config.allowedTools?.length) {
      for (const tool of config.allowedTools) {
        args.push('--allowed-tool', tool);
      }
    }

    if (config.disallowedTools?.length) {
      for (const tool of config.disallowedTools) {
        args.push('--disallowed-tool', tool);
      }
    }

    if (config.yolo) args.push('--yolo');
    if (config.queryTimeout) args.push('--query-timeout', config.queryTimeout);
    if (config.bashToolTimeout) args.push('--bash-tool-timeout', config.bashToolTimeout);
    if (config.sessionId) args.push('--session-id', config.sessionId);

    if (config.resume) {
      if (config.resume === 'AUTO') {
        args.push('--resume');
      } else {
        args.push('--resume', config.resume);
      }
    }

    if (config.worktree) {
      if (config.worktree === '__auto__') {
        args.push('--worktree');
      } else {
        args.push('--worktree', config.worktree);
      }
    }

    if (config.configOverrides) {
      for (const [key, value] of Object.entries(config.configOverrides)) {
        args.push('-c', `${key}=${value}`);
      }
    }

    args.push('--print');

    if (config.jsonOutput) {
      args.push('--json');
    }

    args.push(config.prompt);

    return args;
  }

  private executeBackground(
    args: string[],
    env: NodeJS.ProcessEnv,
    taskId: string,
    logFile: string,
    pidFile: string,
    startTime: number,
  ): TraeTaskResult {
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const child = spawn('trae-cli', args, {
      detached: true,
      stdio: ['ignore', out, err],
      env,
    });

    child.unref();

    if (child.pid) {
      fs.writeFileSync(pidFile, child.pid.toString());
    }

    return {
      taskId,
      output: `任务已在后台启动 (ID: ${taskId})\n日志文件: ${logFile}`,
      exitCode: null,
      duration: Date.now() - startTime,
    };
  }

  private executeForeground(
    args: string[],
    env: NodeJS.ProcessEnv,
    taskId: string,
    logFile: string,
    pidFile: string,
    startTime: number,
    parseJson = false,
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

      const append = (chunk: Buffer): void => {
        const text = chunk.toString();
        combinedOutput += text;
        fs.appendFileSync(logFile, text);
      };

      const settle = (result: TraeTaskResult): void => {
        if (settled) return;
        settled = true;
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
        resolve(result);
      };

      const fail = (error: Error): void => {
        if (settled) return;
        settled = true;
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
        child.kill('SIGKILL');
        reject(error);
      };

      const TIMEOUT_MS = 5 * 60 * 1000;
      const timeout = setTimeout(() => {
        fail(new Error('任务执行超时 (300s)'));
      }, TIMEOUT_MS);

      child.stdout?.on('data', append);
      child.stderr?.on('data', append);

      child.on('error', (error) => {
        clearTimeout(timeout);
        fail(new Error(`执行失败: ${error.message}`));
      });

      child.on('close', (code) => {
        clearTimeout(timeout);

        let jsonOutput: Record<string, unknown> | undefined;
        let sessionId: string | undefined;

        if (parseJson && combinedOutput.trim()) {
          try {
            const parsed = JSON.parse(combinedOutput);
            jsonOutput = parsed;
            sessionId = parsed?.session_id;
          } catch {
            // Not valid JSON, skip parsing
          }
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
}

