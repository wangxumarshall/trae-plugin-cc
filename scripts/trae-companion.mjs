#!/usr/bin/env node
/**
 * trae-companion.mjs - Unified entry point for trae-plugin-cc
 */

import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';
import { getRunningJobs } from './job-utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PLUGIN_ROOT = join(__dirname, '..');

const SUPPORTED_COMMANDS = [
  'setup', 'review', 'adversarial-review', 'run',
  'status', 'result', 'cancel', 'rescue', 'estimate'
];

const RAW_ARGS = process.argv.slice(2);
const FLAGS = {
  json: RAW_ARGS.includes('--json'),
  verbose: RAW_ARGS.includes('--verbose')
};

function outputJson(data) {
  if (FLAGS.json) console.log(JSON.stringify(data, null, 2));
}

function error(msg) {
  console.error(msg);
  if (FLAGS.json) console.log(JSON.stringify({ error: msg }, null, 2));
}

function checkTraeCli() {
  try {
    execSync('which trae-cli', { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function checkTraeConfig() {
  return existsSync(join(process.cwd(), '.trae', 'trae_config.yaml'));
}

function detectBaseBranch() {
  const branches = ['main', 'master', 'develop', 'dev'];
  try {
    const upstream = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { encoding: 'utf-8' }).trim();
    if (upstream) {
      const base = upstream.split('/').pop();
      if (base && branches.includes(base.toLowerCase())) return base;
    }
  } catch {}
  return 'main';
}

function estimateReviewSize(baseBranch = 'main') {
  let added = 0, deleted = 0, files = 0, untracked = [];

  try {
    const stats = execSync(`git diff --shortstat ${baseBranch}...HEAD`, { encoding: 'utf-8' }).trim();
    const m = stats.match(/(\d+)\s+files? changed.*?(\d+)\s+insertions.*?(\d+)\s+deletions/);
    if (m) { files = parseInt(m[1]) || 0; added = parseInt(m[2]) || 0; deleted = parseInt(m[3]) || 0; }
  } catch {}

  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (status) untracked = status.split('\n').filter(l => l.startsWith('??')).map(l => l.substring(3).trim());
  } catch {}

  const total = added + deleted;
  let time = 'quick', bg = false, reason = '变更较小，可以同步等待';

  if (total >= 100 && total < 500) { time = 'moderate'; bg = true; reason = '变更适中，建议后台运行'; }
  else if (total >= 500 && total < 2000) { time = 'lengthy'; bg = true; reason = '变更较大，建议后台运行'; }
  else if (total >= 2000) { time = 'very_large'; bg = true; reason = '变更非常大，建议后台运行或拆分'; }

  return { baseBranch, linesAdded: added, linesDeleted: deleted, filesChanged: files, untrackedFiles: untracked, estimatedTime: time, recommendation: { useBackground: bg, reason } };
}

async function runSetup() {
  const installed = checkTraeCli();
  const configured = checkTraeConfig();
  if (FLAGS.json) {
    outputJson({ command: 'setup', installed, configured, status: installed && configured ? 'ready' : 'needs_setup' });
  } else {
    console.log('🔍 [Trae] Setup Check');
    console.log(installed && configured ? '✅ OK' : '⚠️ 需要配置');
  }
}

async function runEstimate(args) {
  let base = args.includes('--base') ? args[args.indexOf('--base') + 1] : detectBaseBranch();
  const est = estimateReviewSize(base);
  if (FLAGS.json) outputJson({ command: 'estimate', ...est });
  else {
    console.log(`📊 基准分支: ${est.baseBranch}, 变更: +${est.linesAdded}/-${est.linesDeleted}, 文件: ${est.filesChanged}`);
    console.log(`💡 ${est.recommendation.reason}`);
  }
}

async function runStatus() {
  const jobs = getRunningJobs();
  if (FLAGS.json) outputJson({ command: 'status', running: jobs.length, jobs });
  else console.log(jobs.length ? `运行中: ${jobs.length}个` : '无运行任务');
}

async function main() {
  if (!RAW_ARGS.length) { console.log('用法: trae-companion <cmd>'); process.exit(1); }

  const cmd = RAW_ARGS[0];
  if (!SUPPORTED_COMMANDS.includes(cmd)) { error(`未知命令: ${cmd}`); process.exit(1); }

  const cmdArgs = RAW_ARGS.slice(1).filter(a => a !== '--json' && a !== '--verbose');

  try {
    switch (cmd) {
      case 'setup': await runSetup(); break;
      case 'estimate': await runEstimate(cmdArgs); break;
      case 'status': await runStatus(); break;
      default:
        const cli = join(PLUGIN_ROOT, 'dist', 'index.js');
        const child = spawn('node', [cli, cmd, ...cmdArgs], { stdio: 'inherit' });
        child.on('close', process.exit);
    }
  } catch (e) { error(e.message); process.exit(1); }
}

main();