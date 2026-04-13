#!/usr/bin/env node
/**
 * stop-review-gate-hook.mjs
 * Optional review gate that prompts for review before stopping
 */

import { execSync } from 'child_process';
import { getRunningJobs } from './job-utils.mjs';

function hasUncommittedChanges() {
  try {
    // Check for staged, unstaged, and untracked changes
    const staged = execSync('git diff --cached --name-only', { encoding: 'utf-8' }).trim();
    if (staged) return true;

    const unstaged = execSync('git diff --name-only', { encoding: 'utf-8' }).trim();
    if (unstaged) return true;

    const untracked = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (untracked) return true;

    return false;
  } catch {
    return false;
  }
}

async function stopGate() {
  const force = process.argv.includes('--force');

  if (force) {
    console.log('⏭️  [Trae Plugin] Stop gate bypassed (--force)');
    process.exit(0);
  }

  const hasChanges = hasUncommittedChanges();
  const runningJobs = getRunningJobs();

  if (!hasChanges && runningJobs.length === 0) {
    process.exit(0);
  }

  console.log('⚠️  [Trae Plugin] Stop Gate');
  console.log('─'.repeat(40));

  if (hasChanges) {
    console.log('📝 检测到未提交的代码变更');
    console.log('   建议在离开前运行 /trae:review 进行审查');
  }

  if (runningJobs.length > 0) {
    console.log(`📋 有 ${runningJobs.length} 个后台任务仍在运行`);
  }

  console.log('─'.repeat(40));
  console.log('使用 --force 参数可强制退出');

  process.exit(0);
}

stopGate();