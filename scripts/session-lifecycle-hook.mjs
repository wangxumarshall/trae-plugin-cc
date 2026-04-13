#!/usr/bin/env node
/**
 * session-lifecycle-hook.mjs
 * Handles SessionStart and SessionEnd events for trae-plugin-cc
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { getPluginDir, getRunningJobs } from './job-utils.mjs';

const CONFIG_FILE = '.trae/trae_config.yaml';

function checkTraeCliInstalled() {
  // Use execSync only with fixed commands, no user input
  try {
    execSync('which trae-cli', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkTraeConfig() {
  const configPath = join(process.cwd(), CONFIG_FILE);
  return existsSync(configPath);
}

function cleanupStaleLogs() {
  const pluginDir = getPluginDir();
  if (!existsSync(pluginDir)) return;

  const now = Date.now();
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  try {
    const files = readdirSync(pluginDir);
    const logs = files.filter(f => f.endsWith('.log'));

    for (const logFile of logs) {
      const logPath = join(pluginDir, logFile);
      const mtime = statSync(logPath).mtimeMs;
      if (now - mtime > sevenDays) {
        try {
          unlinkSync(logPath);
          const pidFile = logFile.replace('.log', '.pid');
          const pidPath = join(pluginDir, pidFile);
          if (existsSync(pidPath)) unlinkSync(pidPath);
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } catch {
    // Ignore errors
  }
}

async function sessionStart() {
  console.log('🔍 [Trae Plugin] Session Start Check');
  console.log('─'.repeat(40));

  const installed = checkTraeCliInstalled();
  const hasConfig = checkTraeConfig();

  if (installed && hasConfig) {
    console.log('✅ trae-cli 已安装并配置');
  } else {
    if (!installed) {
      console.log('⚠️  trae-cli 未安装');
    }
    if (!hasConfig) {
      console.log('⚠️  配置文件不存在');
    }
    console.log('\n运行 /trae:setup 进行初始化');
  }

  const running = getRunningJobs();
  if (running.length > 0) {
    console.log(`📋 后台任务: ${running.length} 个运行中`);
  }

  console.log('─'.repeat(40));
}

async function sessionEnd() {
  console.log('🔍 [Trae Plugin] Session End Cleanup');
  console.log('─'.repeat(40));

  cleanupStaleLogs();

  const running = getRunningJobs();
  if (running.length > 0) {
    console.log(`⚠️  有 ${running.length} 个后台任务仍在运行:`);
    for (const id of running) {
      console.log(`   - ${id}`);
    }
    console.log('使用 /trae:status 查看状态');
  } else {
    console.log('✅ 无运行中的任务');
  }

  console.log('─'.repeat(40));
}

async function postReview() {
  // Post-review hook - placeholder for tracking
  process.exit(0);
}

// Main handler
const hookType = process.argv[2];

switch (hookType) {
  case 'SessionStart':
    sessionStart();
    break;
  case 'SessionEnd':
    sessionEnd();
    break;
  case 'PostReview':
    postReview();
    break;
  default:
    console.error('Unknown hook type:', hookType);
    process.exit(1);
}