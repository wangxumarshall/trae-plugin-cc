import { TraeExecutor, TraeTaskConfig } from '../utils/trae-executor';
import { ContextBridge } from '../utils/context-bridge';

const executor = new TraeExecutor();
const bridge = new ContextBridge();

export async function runTask(args: string[]) {
  const config: TraeTaskConfig = { prompt: '' };
  const promptParts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--background') {
      config.background = true;
    } else if (arg === '--json') {
      config.jsonOutput = true;
    } else if (arg === '--yolo' || arg === '-y') {
      config.yolo = true;
    } else if (arg === '--resume' || arg === '--resume=AUTO') {
      config.resume = 'AUTO';
    } else if (arg.startsWith('--resume=')) {
      config.resume = arg.substring('--resume='.length);
    } else if (arg === '--resume' && args[i + 1]) {
      config.resume = args[i + 1];
      i++;
    } else if (arg === '--session-id' && args[i + 1]) {
      config.sessionId = args[i + 1];
      i++;
    } else if (arg === '--worktree' || arg === '-w') {
      config.worktree = '__auto__';
    } else if (arg.startsWith('--worktree=')) {
      config.worktree = arg.substring('--worktree='.length);
    } else if (arg === '--worktree' && args[i + 1]) {
      config.worktree = args[i + 1];
      i++;
    } else if (arg === '--allowed-tool' && args[i + 1]) {
      config.allowedTools = config.allowedTools || [];
      config.allowedTools.push(args[i + 1]);
      i++;
    } else if (arg === '--disallowed-tool' && args[i + 1]) {
      config.disallowedTools = config.disallowedTools || [];
      config.disallowedTools.push(args[i + 1]);
      i++;
    } else if (arg === '--query-timeout' && args[i + 1]) {
      config.queryTimeout = args[i + 1];
      i++;
    } else if (arg === '--bash-tool-timeout' && args[i + 1]) {
      config.bashToolTimeout = args[i + 1];
      i++;
    } else if (arg === '-c' && args[i + 1]) {
      const override = args[i + 1];
      config.configOverrides = config.configOverrides || {};
      const eqIdx = override.indexOf('=');
      if (eqIdx > 0) {
        config.configOverrides[override.substring(0, eqIdx)] = override.substring(eqIdx + 1);
      }
      i++;
    } else if (arg === '--inject-context' && args[i + 1]) {
      const sessionId = args[i + 1];
      const context = bridge.buildContextFromSession(sessionId);
      if (context) {
        promptParts.push(context);
      }
      i++;
    } else if (!arg.startsWith('-')) {
      promptParts.push(arg);
    }
  }

  config.prompt = promptParts.join(' ');

  if (!config.prompt) {
    console.log('请提供要执行的任务描述，例如:');
    console.log('  /trae:run "重构用户模块"');
    console.log('  /trae:run "修复bug" --yolo');
    console.log('  /trae:run "继续任务" --resume');
    console.log('  /trae:run "新任务" --session-id my-session');
    console.log('  /trae:run "隔离开发" --worktree');
    console.log('  /trae:run "任务" --json');
    console.log('  /trae:run "任务" --inject-context <session-id>');
    return;
  }

  if (config.resume) {
    console.log(`恢复会话: ${config.resume === 'AUTO' ? '自动检测最近会话' : config.resume}`);
  }

  if (config.worktree) {
    console.log(`使用隔离 worktree: ${config.worktree === '__auto__' ? '自动生成' : config.worktree}`);
  }

  console.log('正将任务委托给 Trae Agent...');

  try {
    const result = await executor.execute(config);

    if (config.jsonOutput && result.jsonOutput) {
      console.log('\n## 结构化输出\n');
      console.log(JSON.stringify(result.jsonOutput, null, 2));
      if (result.sessionId) {
        console.log(`\n会话 ID: ${result.sessionId}`);
      }
    } else if (config.background) {
      console.log('\n' + result.output);
    } else {
      if (result.sessionId) {
        console.log(`\n会话 ID: ${result.sessionId}`);
        console.log(`使用 /trae:run "继续" --resume ${result.sessionId} 恢复该会话`);
      }
    }
  } catch (error: any) {
    console.error('任务执行出错:', error.message);
  }
}
