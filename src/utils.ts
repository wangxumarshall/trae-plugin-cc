import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import { buildSpawnEnv } from './utils/env';
import { getPluginDir } from './config';

export const execAsync = promisify(exec);

const PLUGIN_DIR = getPluginDir();

function isSafeGitRef(ref: string): boolean {
  return /^[A-Za-z0-9._\/-]+$/.test(ref);
}

export async function isTraeCliInstalled(): Promise<boolean> {
  try {
    const env = buildSpawnEnv();
    await execAsync('which trae-cli', { env });
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

export { SessionReader } from './utils/session-reader';
export { AuthBridge } from './utils/auth-bridge';
export { ContextBridge } from './utils/context-bridge';
export { TraeExecutor } from './utils/trae-executor';
export { AcpClient } from './utils/acp-client';
export { AcpServerManager } from './utils/acp-server-manager';
