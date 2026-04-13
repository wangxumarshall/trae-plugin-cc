#!/usr/bin/env node
/**
 * job-utils.mjs - Shared utilities for background job management
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const PLUGIN_DIR = '.claude-trae-plugin';

export function getPluginDir(baseDir = process.cwd()) {
  return join(baseDir, PLUGIN_DIR);
}

export function getRunningJobs() {
  const pluginDir = getPluginDir();
  if (!existsSync(pluginDir)) return [];

  try {
    const files = readdirSync(pluginDir);
    const pidFiles = files.filter(f => f.endsWith('.pid'));
    const running = [];

    for (const pidFile of pidFiles) {
      try {
        const pid = parseInt(readFileSync(join(pluginDir, pidFile), 'utf-8').trim());
        process.kill(pid, 0);
        running.push(pidFile.replace('.pid', ''));
      } catch {
      }
    }
    return running;
  } catch {
    return [];
  }
}

export function isJobRunning(jobName) {
  const runningJobs = getRunningJobs();
  return runningJobs.includes(jobName);
}
