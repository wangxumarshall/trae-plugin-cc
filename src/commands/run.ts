import { runTraeCli } from '../utils';

export async function runTask(args: string[]) {
    const background = args.includes('--background');
    const promptArgs = args.filter(a => a !== '--background');
    const prompt = promptArgs.join(' ');

    if (!prompt) {
        console.log('Please provide a task description, e.g., /trae:run "Refactor user module"');
        return;
    }

    console.log('Delegating task to Trae Agent...');
    try {
        const result = await runTraeCli(prompt, background, 'run');
        console.log('\nTask Result:\n');
        console.log(result);
    } catch (error: any) {
         console.error('Task execution error:', error.message);
    }
}
