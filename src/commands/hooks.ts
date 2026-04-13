import { spawn } from 'child_process';
import path from 'path';

export async function handleHook(args: string[]) {
    const hookType = args[0];

    if (!hookType) {
        console.error('Usage: trae-plugin-cc hooks <session-start|session-end|stop-gate>');
        process.exit(1);
    }

    const scriptMap: Record<string, string> = {
        'session-start': 'session-lifecycle-hook.mjs',
        'session-end': 'session-lifecycle-hook.mjs',
        'stop-gate': 'stop-review-gate-hook.mjs'
    };

    const script = scriptMap[hookType];
    if (!script) {
        console.error(`Unknown hook type: ${hookType}`);
        console.error(`Available: ${Object.keys(scriptMap).join(', ')}`);
        process.exit(1);
    }

    // Get plugin root from environment variable or use default path
    const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
    const scriptPath = path.join(pluginRoot, 'scripts', script);

    return new Promise((resolve, reject) => {
        const child = spawn('node', [scriptPath], {
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