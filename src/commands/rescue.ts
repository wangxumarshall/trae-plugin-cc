import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { TraeExecutor } from '../utils/trae-executor';
import { getPluginDir } from '../config';

const PLUGIN_DIR = getPluginDir();

function getLastError(): string | null {
  const pluginDir = join(process.cwd(), PLUGIN_DIR);
  if (!existsSync(pluginDir)) return null;

  try {
    const files = readdirSync(pluginDir);
    const logs = files.filter(f => f.endsWith('.log'));

    if (logs.length === 0) return null;

    logs.sort().reverse();
    const latestLog = logs[0];
    const logPath = join(pluginDir, latestLog);

    return readFileSync(logPath, 'utf-8');
  } catch {
    return null;
  }
}

function getGitStatus(): string {
  try {
    return execSync('git status --short', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function getRecentChanges(): string {
  try {
    return execSync('git log --stat -n 10 --oneline', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function collectDiagnostics(): {
  lastError: string | null;
  gitStatus: string;
  recentChanges: string;
} {
  return {
    lastError: getLastError(),
    gitStatus: getGitStatus(),
    recentChanges: getRecentChanges(),
  };
}

function formatDiagnosticContext(context: {
  lastError: string | null;
  gitStatus: string;
  recentChanges: string;
  userContext: string;
}): string {
  const parts: string[] = [
    '作为 Trae Agent 的故障诊断助手，请分析以下失败上下文并提供恢复建议：',
    '',
  ];

  if (context.lastError) {
    parts.push(`错误输出:\n${context.lastError}`);
  }
  if (context.gitStatus) {
    parts.push(`Git 状态:\n${context.gitStatus}`);
  }
  if (context.userContext) {
    parts.push(`附加上下文:\n${context.userContext}`);
  }

  parts.push(
    '请提供:',
    '1. 问题诊断: 可能的原因是什么？',
    '2. 恢复建议: 应该尝试什么操作？',
    '3. 预防建议: 如何避免类似问题？',
  );

  return parts.join('\n');
}

export async function rescue(args: string[]): Promise<void> {
  let context = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--context' && args[i + 1]) {
      context = args[i + 1];
      i++;
    }
  }

  console.log('Rescue Mode');
  console.log('─'.repeat(40));

  const diagnostics = collectDiagnostics();

  console.log('收集故障信息...');

  if (diagnostics.lastError) {
    console.log('\n最近错误:');
    const errorLines = diagnostics.lastError.split('\n').slice(-10);
    console.log(errorLines.join('\n'));
  }

  if (diagnostics.gitStatus) {
    console.log('\n当前变更:');
    console.log(diagnostics.gitStatus);
  }

  if (diagnostics.recentChanges) {
    console.log('\n最近提交:');
    console.log(diagnostics.recentChanges);
  }

  if (context) {
    console.log('\n用户上下文:');
    console.log(context);
  }

  console.log('\n正在分析问题...');

  const diagnosisPrompt = formatDiagnosticContext({
    ...diagnostics,
    userContext: context,
  });

  try {
    console.log('─'.repeat(40));
    const executor = new TraeExecutor();
    const result = await executor.execute({ prompt: diagnosisPrompt });
    console.log('\n诊断结果:');
    console.log(result.output);
  } catch (error: unknown) {
    console.error('诊断失败:', error instanceof Error ? error.message : String(error));
  }

  console.log('─'.repeat(40));
}
