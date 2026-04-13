import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { runTraeCli } from '../utils';

const PLUGIN_DIR = '.claude-trae-plugin';

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
    // Fixed command, no user input - safe
    return execSync('git status --short', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function getRecentChanges(): string {
  try {
    // Fixed command, no user input - safe
    return execSync('git diff --stat -10', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

export async function rescue(args: string[]) {
  let context = '';
  let retries = 3;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--context' && args[i + 1]) {
      context = args[i + 1];
      i++;
    } else if (args[i] === '--retries' && args[i + 1]) {
      retries = parseInt(args[i + 1]) || 3;
      i++;
    } else if (args[i] === '--force') {
      force = true;
    }
  }

  console.log('🔧 [Trae Plugin] Rescue Mode');
  console.log('─'.repeat(40));

  const lastError = getLastError();
  const gitStatus = getGitStatus();
  const recentChanges = getRecentChanges();

  console.log('📊 收集故障信息...');

  if (lastError) {
    console.log('\n📝 最近错误:');
    const errorLines = lastError.split('\n').slice(-10);
    console.log(errorLines.join('\n'));
  }

  if (gitStatus) {
    console.log('\n📁 当前变更:');
    console.log(gitStatus);
  }

  if (recentChanges) {
    console.log('\n📈 最近提交:');
    console.log(recentChanges);
  }

  if (context) {
    console.log('\n📋 用户提供上下文:');
    console.log(context);
  }

  console.log('\n🔍 正在分析问题...');

  const diagnosisPrompt = `作为 Trae Agent 的故障诊断助手，请分析以下失败上下文并提供恢复建议：

${lastError ? `错误输出:\n${lastError}\n` : ''}
${gitStatus ? `Git 状态:\n${gitStatus}\n` : ''}
${context ? `附加上下文:\n${context}\n` : ''}

请提供:
1. 问题诊断: 可能的原因是什么？
2. 恢复建议: 应该尝试什么操作？
3. 预防建议: 如何避免类似问题？`;

  try {
    console.log('─'.repeat(40));
    const result = await runTraeCli(diagnosisPrompt, false);
    console.log('\n💡 诊断结果:');
    console.log(result);
  } catch (error: any) {
    console.error('❌ 诊断失败:', error.message);
  }

  console.log('─'.repeat(40));
}