import { getGitDiff, runTraeCli } from '../utils';
import { detectBaseBranch, estimateReviewSize, formatEstimate } from '../utils/branch-detection';

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

    // Auto-detect base branch if not specified
    if (!args.includes('--base')) {
        console.log('🔍 自动检测基准分支...');
        baseBranch = await detectBaseBranch();
    }

    // Estimate review size
    console.log(`📊 分析变更大小...`);
    const estimate = await estimateReviewSize(baseBranch);
    console.log(formatEstimate(estimate));

    // Auto-set background if recommended
    if (!background && estimate.recommendation.useBackground) {
        console.log('💡 自动启用后台模式 (使用 --background 覆盖)');
        background = true;
    }

    console.log(`\n获取与 ${baseBranch} 的差异...`);
    const diff = await getGitDiff(baseBranch);

    if (!diff.trim()) {
         console.log('没有检测到任何代码变更。');
         return;
    }

    let reviewPrompt = isAdversarial
        ? `作为一位极度严苛的对抗性代码审查员，请仔细检查以下变更。你需要专门挑刺、质疑假设、找出所有潜在的安全漏洞、性能瓶颈、逻辑错误或不符合最佳实践的地方。务必吹毛求疵，给出致命的反馈意见。`
        : `请对以下代码变更进行标准的专业代码审查。找出潜在的错误、性能问题、提出改进建议，并总结主要变动：`;

    const prompt = `${reviewPrompt}\n\n代码变更如下:\n\`\`\`diff\n${diff}\n\`\`\``;

    console.log('提交代码审查请求到 Trae Agent...');
    try {
        const result = await runTraeCli(prompt, background);
        if (background) {
            console.log('\n审查结果:\n');
            console.log(result);
        }
    } catch (error: any) {
        console.error('审查执行出错:', error.message);
    }
}
