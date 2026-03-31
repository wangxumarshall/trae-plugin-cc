import * as fs from 'fs';
import * as path from 'path';

const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');
const STATE_DIR = path.join(PLUGIN_DIR, 'jobs');

export interface JobState {
    id: string;
    pid: number | null;
    status: 'running' | 'completed' | 'cancelled' | 'failed';
    type: 'review' | 'run' | 'adversarial-review';
    logFile: string;
    createdAt: number;
    updatedAt: number;
    command: string;
}

export function ensureStateDir() {
    if (!fs.existsSync(STATE_DIR)) {
        fs.mkdirSync(STATE_DIR, { recursive: true });
    }
}

export function saveJob(job: JobState) {
    ensureStateDir();
    const jobFile = path.join(STATE_DIR, `${job.id}.json`);
    job.updatedAt = Date.now();
    fs.writeFileSync(jobFile, JSON.stringify(job, null, 2), 'utf-8');
}

export function getJob(id: string): JobState | null {
    const jobFile = path.join(STATE_DIR, `${id}.json`);
    if (fs.existsSync(jobFile)) {
        try {
            return JSON.parse(fs.readFileSync(jobFile, 'utf-8')) as JobState;
        } catch {
            return null;
        }
    }
    return null;
}

export function listJobs(): JobState[] {
    if (!fs.existsSync(STATE_DIR)) {
        return [];
    }

    const files = fs.readdirSync(STATE_DIR).filter(f => f.endsWith('.json'));
    const jobs: JobState[] = [];

    for (const file of files) {
        try {
            const job = JSON.parse(fs.readFileSync(path.join(STATE_DIR, file), 'utf-8')) as JobState;
            // Verify if running jobs are actually running
            if (job.status === 'running' && job.pid) {
                try {
                    process.kill(job.pid, 0);
                } catch (e: any) {
                    if (e.code === 'ESRCH') {
                        job.status = 'failed'; // Process died unexpectedly
                        saveJob(job);
                    }
                }
            }
            jobs.push(job);
        } catch {
            // ignore invalid files
        }
    }

    return jobs.sort((a, b) => b.createdAt - a.createdAt); // newest first
}

export function status(args: string[]) {
    const id = args[0];

    if (id) {
        const job = getJob(id);
        if (!job) {
            console.log(`Job not found: ${id}`);
            return;
        }

        console.log(`Job ID: ${job.id}`);
        console.log(`Type: ${job.type}`);
        console.log(`Status: ${job.status}`);
        console.log(`Created: ${new Date(job.createdAt).toLocaleString()}`);
        console.log(`Log File: ${job.logFile}`);
        return;
    }

    const jobs = listJobs();
    if (jobs.length === 0) {
        console.log('No recent Trae jobs.');
        return;
    }

    console.log('Recent Trae Jobs:\n');
    console.log('ID'.padEnd(20) + 'TYPE'.padEnd(20) + 'STATUS'.padEnd(15) + 'CREATED');
    console.log('-'.repeat(80));
    jobs.forEach(job => {
        const date = new Date(job.createdAt).toLocaleString();
        console.log(`${job.id.padEnd(20)}${job.type.padEnd(20)}${job.status.padEnd(15)}${date}`);
    });
}

export function result(args: string[]) {
    const id = args[0];
    if (!id) {
        console.log('Please provide a task ID. Example: /trae:result 1633022... \nYou can use /trae:status to list tasks.');
        return;
    }

    const job = getJob(id);
    if (!job) {
        console.log(`Job not found: ${id}`);
        return;
    }

    if (!fs.existsSync(job.logFile)) {
        console.log(`Log file not found for job ${id}.`);
        return;
    }

    const content = fs.readFileSync(job.logFile, 'utf-8');
    console.log(`--- Results for Job ${id} (${job.type}) ---`);
    console.log(`Status: ${job.status}\n`);
    console.log(content);
}

export function cancel(args: string[]) {
    const id = args[0];
    if (!id) {
        console.log('Please provide a task ID. Example: /trae:cancel 1633022... \nYou can use /trae:status to list tasks.');
        return;
    }

    const job = getJob(id);
    if (!job) {
         console.log(`Job not found: ${id}`);
         return;
    }

    if (job.status !== 'running') {
        console.log(`Job ${id} is not running (Status: ${job.status}).`);
        return;
    }

    if (job.pid) {
        try {
            process.kill(job.pid, 'SIGKILL');
            console.log(`Force killed process (PID: ${job.pid}) for job ${id}.`);
        } catch (e: any) {
            if (e.code === 'ESRCH') {
                console.log(`Process for job ${id} was already dead.`);
            } else {
                 console.error(`Error killing process: ${e.message}`);
            }
        }
    }

    job.status = 'cancelled';
    saveJob(job);

    // Also append to log file to record cancellation
    if (fs.existsSync(job.logFile)) {
        fs.appendFileSync(job.logFile, '\n\n--- Job cancelled by user ---\n');
    }
}
