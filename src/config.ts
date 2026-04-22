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
