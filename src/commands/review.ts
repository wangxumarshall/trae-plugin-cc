import { getGitDiff } from '../utils';
import { TraeExecutor, TraeTaskConfig } from '../utils/trae-executor';
import { detectBaseBranch, estimateReviewSize, formatEstimate } from '../utils/branch-detection';

const executor = new TraeExecutor();

export async function review(args: string[], isAdversarial: boolean = false) {
    let baseBranch = 'main';
    const config: TraeTaskConfig = { prompt: '' };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--base' && args[i + 1]) {
            baseBranch = args[i + 1];
            i++;
        }
        if (args[i] === '--background') {
            config.background = true;
        }
        if (args[i] === '--yolo' || args[i] === '-y') {
            config.yolo = true;
        }
        if (args[i] === '--json') {
            config.jsonOutput = true;
        }
        if (args[i] === '--session-id' && args[i + 1]) {
            config.sessionId = args[i + 1];
            i++;
        }
    }

    if (!args.includes('--base')) {
        console.log('🔍 自动检测基准分支...');
        baseBranch = await detectBaseBranch();
    }

    console.log(`📊 分析变更大小...`);
    const estimate = await estimateReviewSize(baseBranch);
    console.log(formatEstimate(estimate));

    if (!config.background && estimate.recommendation.useBackground) {
        console.log('💡 自动启用后台模式 (使用 --background 覆盖)');
        config.background = true;
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

    config.prompt = `${reviewPrompt}\n\n代码变更如下:\n\`\`\`diff\n${diff}\n\`\`\``;

    console.log('提交代码审查请求到 Trae Agent...');
    try {
        const result = await executor.execute(config);

        if (config.jsonOutput && result.jsonOutput) {
            console.log('\n## 结构化审查结果\n');
            console.log(JSON.stringify(result.jsonOutput, null, 2));
        } else if (config.background) {
            console.log('\n审查结果:\n');
            console.log(result.output);
        }

        if (result.sessionId) {
            console.log(`\n会话 ID: ${result.sessionId}`);
            console.log(`使用 /trae:run "继续审查" --resume ${result.sessionId} 恢复该会话`);
        }
    } catch (error: any) {
        console.error('审查执行出错:', error.message);
    }
}
