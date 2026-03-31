import { getGitDiff, runTraeCli } from '../utils';

export async function review(args: string[], isAdversarial: boolean = false) {
    let baseBranch = 'main';
    let background = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--base' && args[i + 1]) {
            baseBranch = args[i + 1];
            i++;
        }
        if (args[i] === '--background') {
            background = true;
        }
    }

    console.log(`Fetching diff against ${baseBranch}...`);
    const diff = await getGitDiff(baseBranch);

    if (!diff.trim() || diff.includes('Cannot get git diff')) {
         console.log('No code changes detected or not a git repository.');
         return;
    }

    let reviewPrompt = isAdversarial
        ? `As an extremely strict, adversarial code reviewer, carefully examine the following changes. You must actively find flaws, challenge assumptions, and seek out all potential security vulnerabilities, performance bottlenecks, logic errors, or deviations from best practices. Be hyper-critical and provide fatal feedback.`
        : `Please perform a standard, professional code review on the following code changes. Identify potential bugs, performance issues, suggest improvements, and summarize the main changes:`;

    const prompt = `${reviewPrompt}\n\nCode changes:\n\`\`\`diff\n${diff}\n\`\`\``;

    console.log('Submitting code review request to Trae Agent...');
    try {
        const type = isAdversarial ? 'adversarial-review' : 'review';
        const result = await runTraeCli(prompt, background, type);
        console.log('\nReview Result:\n');
        console.log(result);
    } catch (error: any) {
        console.error('Review execution error:', error.message);
    }
}
