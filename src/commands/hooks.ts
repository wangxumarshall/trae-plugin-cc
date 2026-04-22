import { spawn } from 'child_process';
import path from 'path';

export async function handleHook(args: string[]) {
    const hookType = args[0];

    if (!hookType) {
        console.error('Usage: trae-plugin-cc hooks <session-start|session-end|stop-gate>');
        process.exit(1);
    }

    const hookMap: Record<string, { script: string; arg: string }> = {
        'session-start': { script: 'session-lifecycle-hook.mjs', arg: 'SessionStart' },
        'session-end': { script: 'session-lifecycle-hook.mjs', arg: 'SessionEnd' },
        'stop-gate': { script: 'stop-review-gate-hook.mjs', arg: '' },
    };

    const entry = hookMap[hookType];
    if (!entry) {
        console.error(`Unknown hook type: ${hookType}`);
        console.error(`Available: ${Object.keys(hookMap).join(', ')}`);
        process.exit(1);
    }

    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
    const scriptPath = path.join(pluginRoot, 'scripts', entry.script);

    const spawnArgs = entry.arg ? [scriptPath, entry.arg] : [scriptPath];

    return new Promise((resolve, reject) => {
        const child = spawn('node', spawnArgs, {
            stdio: 'inherit',
            detached: false
        });

        child.on('close', (code) => {
            if (code === 0) {
                resolve(undefined);
            } else {
                reject(new Error(`Hook exited with code ${code}`));
            }
        });

        child.on('error', reject);
    });
}
