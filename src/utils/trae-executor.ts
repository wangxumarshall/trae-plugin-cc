import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { AuthBridge } from './auth-bridge';

export interface TraeTaskConfig {
  prompt: string;
  background?: boolean;
  jsonOutput?: boolean;
  yolo?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
  sessionId?: string;
  resume?: string;
  worktree?: string;
  queryTimeout?: string;
  bashToolTimeout?: string;
  configOverrides?: Record<string, string>;
}

export interface TraeTaskResult {
  taskId: string;
  output: string;
  exitCode: number | null;
  sessionId?: string;
  duration: number;
  jsonOutput?: any;
}

const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');

function ensurePluginDir() {
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

    if (config.allowedTools) {
      for (const tool of config.allowedTools) {
        args.push('--allowed-tool', tool);
      }
    }

    if (config.disallowedTools) {
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
      for (const [k, v] of Object.entries(config.configOverrides)) {
        args.push('-c', `${k}=${v}`);
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
    args: string[], env: NodeJS.ProcessEnv, taskId: string,
    logFile: string, pidFile: string, startTime: number
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

      const append = (chunk: Buffer) => {
        const text = chunk.toString();
        combinedOutput += text;
        fs.appendFileSync(logFile, text);
      };

      child.stdout?.on('data', append);
      child.stderr?.on('data', append);

      child.on('error', (error) => {
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
        reject(new Error(`执行失败: ${error.message}`));
      });

      child.on('close', (code) => {
        if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);

        let jsonOutput: any = undefined;
        let sessionId: string | undefined;

        if (parseJson && combinedOutput.trim()) {
          try {
            jsonOutput = JSON.parse(combinedOutput);
            sessionId = jsonOutput?.session_id;
          } catch {}
        }

        resolve({
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
