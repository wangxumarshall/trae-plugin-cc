import { runTraeCli } from '../utils';

export async function runTask(args: string[]) {
    const background = args.includes('--background');
    const promptArgs = args.filter(a => a !== '--background');
    const prompt = promptArgs.join(' ');

    if (!prompt) {
        console.log('请提供要执行的任务描述，例如: /trae:run "重构用户模块"');
        return;
    }

    console.log('正将任务委托给 Trae Agent...');
    try {
        const result = await runTraeCli(prompt, background);
        if (background) {
            console.log('\n任务执行结果:\n');
            console.log(result);
        }
    } catch (error: any) {
         console.error('任务执行出错:', error.message);
    }
}
