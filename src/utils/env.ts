import * as path from 'path';
import * as os from 'os';

const HOME_BIN = path.join(os.homedir(), '.local', 'bin');

export function buildSpawnEnv(envOverrides?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const base = { ...process.env, ...(envOverrides || {}) };
  const existingPath = base.PATH || '';

  if (!existingPath.split(path.delimiter).includes(HOME_BIN)) {
    base.PATH = `${HOME_BIN}:${existingPath}`;
  }

  if (process.env.TRAECLI_PERSONAL_ACCESS_TOKEN) {
    base.TRAECLI_PERSONAL_ACCESS_TOKEN = process.env.TRAECLI_PERSONAL_ACCESS_TOKEN;
  }

  return base;
}

export function isInPath(dirPath: string): boolean {
  const existingPath = process.env.PATH || '';
  return existingPath.split(path.delimiter).includes(dirPath);
}
