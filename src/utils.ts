import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

export const execAsync = promisify(exec);

const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');

function isSafeGitRef(ref: string): boolean {
  return /^[A-Za-z0-9._\/-]+$/.test(ref);
}

export async function isTraeCliInstalled(): Promise<boolean> {
  try {
    await execAsync('which trae-cli');
    return true;
  } catch {
    return false;
  }
}

export async function getGitDiff(baseBranch: string = 'main'): Promise<string> {
  const safeBase = isSafeGitRef(baseBranch) ? baseBranch : 'main';

  try {
    const { stdout } = await execAsync(`git diff ${safeBase}...HEAD`);
    return stdout;
  } catch (error) {
    try {
      const { stdout } = await execAsync('git diff');
      return stdout;
    } catch {
      return '无法获取 git diff，可能不在 git 仓库中。';
    }
  }
}

export function ensurePluginDir() {
  if (!fs.existsSync(PLUGIN_DIR)) {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  }
}

export async function runTraeCli(prompt: string, background: boolean = false): Promise<string> {
  ensurePluginDir();
  const timestamp = Date.now();
  const logFile = path.join(PLUGIN_DIR, `${timestamp}.log`);
  const pidFile = path.join(PLUGIN_DIR, `${timestamp}.pid`);

  if (background) {
    const out = fs.openSync(logFile, 'a');
    const err = fs.openSync(logFile, 'a');

    const child = spawn('trae-cli', ['--print', prompt], {
      detached: true,
      stdio: ['ignore', out, err]
    });

    child.unref();

    if (child.pid) {
      fs.writeFileSync(pidFile, child.pid.toString());
    }

    return `任务已在后台启动 (ID: ${timestamp})。\n使用 /trae:status 查看状态，或查看日志文件：${logFile}`;
  }

  return new Promise((resolve, reject) => {
    const child = spawn('trae-cli', ['--print', prompt], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    if (child.pid) {
      fs.writeFileSync(pidFile, child.pid.toString());
    }

    let combinedOutput = '';

    const append = (chunk: Buffer, isErr: boolean = false) => {
      const text = chunk.toString();
      combinedOutput += text;
      fs.appendFileSync(logFile, text);
      if (isErr) {
        process.stderr.write(chunk);
      } else {
        process.stdout.write(chunk);
      }
    };

    child.stdout?.on('data', (chunk: Buffer) => append(chunk, false));
    child.stderr?.on('data', (chunk: Buffer) => append(chunk, true));

    child.on('error', (error) => {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      reject(new Error(`执行失败: ${error.message}`));
    });

    child.on('close', (code) => {
      if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
      if (code === 0) {
        resolve(combinedOutput);
      } else {
        reject(new Error(`执行失败: trae-cli 退出码 ${code}。日志: ${logFile}`));
      }
    });
  });
}

export { SessionReader } from './utils/session-reader';
export { AuthBridge } from './utils/auth-bridge';
export { ContextBridge } from './utils/context-bridge';
export { TraeExecutor } from './utils/trae-executor';
export { AcpClient } from './utils/acp-client';
export { AcpServerManager } from './utils/acp-server-manager';
