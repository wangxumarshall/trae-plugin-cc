import * as path from 'path';
import * as os from 'os';

const HOME_BIN = path.join(os.homedir(), '.local', 'bin');

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

export function isInPath(dirPath: string): boolean {
  const existingPath = process.env.PATH || '';
  return existingPath.split(':').includes(dirPath);
}
