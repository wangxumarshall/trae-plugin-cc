import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

export const execAsync = promisify(exec);

const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');

export async function isTraeCliInstalled(): Promise<boolean> {
  try {
    await execAsync('which trae-cli');
    return true;
  } catch {
    return false;
  }
}

export async function getGitDiff(baseBranch: string = 'main'): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff ${baseBranch}...HEAD`);
    return stdout;
  } catch (error) {
    try {
        const { stdout } = await execAsync(`git diff`);
        return stdout;
    } catch(e) {
        return "Cannot get git diff. You may not be in a git repository.";
    }
  }
}

export function ensurePluginDir() {
  if (!fs.existsSync(PLUGIN_DIR)) {
    fs.mkdirSync(PLUGIN_DIR, { recursive: true });
  }
}

// Write large prompts to a temp file to avoid "Argument list too long" errors
export function writeTempPrompt(prompt: string): string {
    ensurePluginDir();
    const tempDir = path.join(PLUGIN_DIR, 'tmp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    const filename = path.join(tempDir, `prompt_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);
    fs.writeFileSync(filename, prompt, 'utf-8');
    return filename;
}

export async function runTraeCli(
    prompt: string,
    background: boolean = false,
    type: 'review' | 'run' | 'adversarial-review' = 'run'
): Promise<string> {
    const { JobState, saveJob, ensureStateDir } = require('./commands/jobs');

    // Check if the prompt is large and should be handled via file
    const isLarge = prompt.length > 30000;
    let commandToRun: string;
    let spawnArgs: string[];

    if (isLarge) {
        const promptFile = writeTempPrompt(prompt);
        // Using cat to pipe the file content into trae-cli run if trae-cli supports stdin reading,
        // or passing the file if it supports reading from file.
        // Assuming `trae-cli run` takes the full prompt. We'll use cat inside bash for shell execution.
        commandToRun = `cat "${promptFile}" | trae-cli run`;
        spawnArgs = ['-c', `cat "${promptFile}" | trae-cli run`];
    } else {
        const escapedPrompt = prompt.replace(/"/g, '\\"');
        commandToRun = `trae-cli run "${escapedPrompt}"`;
        spawnArgs = ['-c', commandToRun];
    }

    if (background) {
        ensureStateDir();
        const timestamp = Date.now();
        const id = timestamp.toString();
        const logFile = path.join(PLUGIN_DIR, `${id}.log`);

        const out = fs.openSync(logFile, 'a');
        const err = fs.openSync(logFile, 'a');

        // Spawn a bash shell to handle piping if necessary
        const child = spawn('bash', spawnArgs, {
            detached: true,
            stdio: ['ignore', out, err]
        });

        child.unref();

        const job: any = {
            id,
            pid: child.pid || null,
            status: 'running',
            type,
            logFile,
            createdAt: timestamp,
            updatedAt: timestamp,
            command: isLarge ? 'trae-cli run [large prompt file]' : 'trae-cli run [prompt]'
        };

        saveJob(job);

        // Setup background process completion handler
        // To accurately track when it finishes, we can spawn a tracker process, or rely on status checks
        // For simplicity, we just save the initial running state here. The status command checks if pid is running.

        return `Job started in background (ID: ${id}).\nUse /trae:status to view progress or check the log file: ${logFile}`;
    } else {
        try {
            const { stdout, stderr } = await execAsync(commandToRun, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer for large outputs
            return stdout || stderr;
        } catch (error: any) {
            throw new Error(`Execution failed: ${error.message}\n${error.stdout}\n${error.stderr}`);
        }
    }
}
