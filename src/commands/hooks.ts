import { spawn } from 'child_process';
import path from 'path';

interface HookDefinition {
  script: string;
  arg: string;
}

const HOOK_MAP: Record<string, HookDefinition> = {
  'session-start': { script: 'session-lifecycle-hook.mjs', arg: 'SessionStart' },
  'session-end': { script: 'session-lifecycle-hook.mjs', arg: 'SessionEnd' },
  'stop-gate': { script: 'stop-review-gate-hook.mjs', arg: '' },
};

export async function handleHook(args: string[]): Promise<void> {
  const hookType = args[0];

  if (!hookType) {
    console.error('Usage: hooks <session-start|session-end|stop-gate>');
    process.exit(1);
  }

  const entry = HOOK_MAP[hookType];
  if (!entry) {
    console.error(`Unknown hook type: ${hookType}`);
    console.error(`Available: ${Object.keys(HOOK_MAP).join(', ')}`);
    process.exit(1);
  }

  const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
  const scriptPath = path.join(pluginRoot, 'scripts', entry.script);

  const spawnArgs = entry.arg ? [scriptPath, entry.arg] : [scriptPath];

  return new Promise((resolve, reject) => {
    const child = spawn('node', spawnArgs, {
      stdio: 'inherit',
      detached: false,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Hook exited with code ${code}`));
      }
    });

    child.on('error', reject);
  });
}
