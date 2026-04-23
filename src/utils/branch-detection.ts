import { execSync } from 'child_process';
import { DiffEstimate } from '../types';

const COMMON_BRANCHES = ['main', 'master', 'develop', 'dev', 'mainline'];

export async function detectBaseBranch(): Promise<string> {
  if (await hasUpstreamBranch()) {
    const upstream = await getUpstreamBranch();
    if (upstream) {
      const base = upstream.split('/').pop();
      if (base && COMMON_BRANCHES.includes(base.toLowerCase())) {
        return base;
      }
    }
  }

  const currentBranch = await getCurrentBranch();
  if (currentBranch && COMMON_BRANCHES.includes(currentBranch.toLowerCase()) && currentBranch !== 'HEAD') {
    return 'main';
  }

  const remoteDefault = await getRemoteDefaultBranch();
  if (remoteDefault) {
    return remoteDefault;
  }

  return await findFirstExistingBranch() || 'main';
}

async function hasUpstreamBranch(): Promise<boolean> {
  try {
    execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function getUpstreamBranch(): Promise<string> {
  try {
    return execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u}', {
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}

async function getCurrentBranch(): Promise<string> {
  try {
    return execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

async function getRemoteDefaultBranch(): Promise<string> {
  try {
    return execSync('git remote show origin | grep "HEAD branch" | sed "s/.*: //"', {
      encoding: 'utf-8',
    }).trim();
  } catch {
    return '';
  }
}

async function findFirstExistingBranch(): Promise<string | null> {
  for (const branch of COMMON_BRANCHES) {
    try {
      execSync(`git rev-parse --verify ${branch}`, { stdio: 'ignore' });
      return branch;
    } catch {
      continue;
    }
  }
  return null;
}

export async function getUntrackedFiles(): Promise<string[]> {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (!output) return [];

    return output
      .split('\n')
      .filter(line => line.startsWith('??'))
      .map(line => line.substring(3).trim());
  } catch {
    return [];
  }
}

export async function estimateReviewSize(baseBranch: string): Promise<DiffEstimate> {
  let linesAdded = 0;
  let linesDeleted = 0;
  let filesChanged = 0;

  const diffStats = await getDiffStats(baseBranch);
  if (diffStats) {
    filesChanged = diffStats.filesChanged;
    linesAdded = diffStats.linesAdded;
    linesDeleted = diffStats.linesDeleted;
  }

  const untrackedFiles = await getUntrackedFiles();
  const totalChanges = linesAdded + linesDeleted;

  const { estimatedTime, useBackground, reason } = classifyChanges(totalChanges);

  return {
    baseBranch,
    linesAdded,
    linesDeleted,
    filesChanged,
    untrackedFiles,
    estimatedTime,
    recommendation: { useBackground, reason },
  };
}

interface DiffStats {
  filesChanged: number;
  linesAdded: number;
  linesDeleted: number;
}

async function getDiffStats(baseBranch: string): Promise<DiffStats | null> {
  try {
    const output = execSync(`git diff --shortstat ${baseBranch}...HEAD`, {
      encoding: 'utf-8',
    }).trim();

    if (!output) return { filesChanged: 0, linesAdded: 0, linesDeleted: 0 };

    const filesMatch = output.match(/(\d+)\s+files? changed/);
    const insertionsMatch = output.match(/(\d+)\s+insertions/);
    const deletionsMatch = output.match(/(\d+)\s+deletions/);

    return {
      filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
      linesAdded: insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0,
      linesDeleted: deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0,
    };
  } catch {
    try {
      const output = execSync('git diff --shortstat', { encoding: 'utf-8' }).trim();
      if (!output) return { filesChanged: 0, linesAdded: 0, linesDeleted: 0 };

      const filesMatch = output.match(/(\d+)\s+files? changed/);
      return {
        filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
        linesAdded: 0,
        linesDeleted: 0,
      };
    } catch {
      return null;
    }
  }
}

function classifyChanges(totalChanges: number): {
  estimatedTime: DiffEstimate['estimatedTime'];
  useBackground: boolean;
  reason: string;
} {
  if (totalChanges < 100) {
    return { estimatedTime: 'quick', useBackground: false, reason: '变更较小，可以同步等待' };
  }
  if (totalChanges < 500) {
    return { estimatedTime: 'moderate', useBackground: true, reason: '变更适中，建议后台运行' };
  }
  if (totalChanges < 2000) {
    return { estimatedTime: 'lengthy', useBackground: true, reason: '变更较大，建议后台运行' };
  }
  return { estimatedTime: 'very_large', useBackground: true, reason: '变更非常大，建议后台运行或拆分审查' };
}

export function formatEstimate(estimate: DiffEstimate): string {
  const lines = [
    '审查估算:',
    `  基准分支: ${estimate.baseBranch}`,
    `  变更: +${estimate.linesAdded} -${estimate.linesDeleted} 行`,
    `  文件: ${estimate.filesChanged} 个`,
  ];

  if (estimate.untrackedFiles.length > 0) {
    lines.push(`  未跟踪: ${estimate.untrackedFiles.length} 个文件`);
  }

  const timeMap: Record<string, string> = {
    quick: '快速 (1-2分钟)',
    moderate: '中等 (5-10分钟)',
    lengthy: '较长 (10-30分钟)',
    very_large: '非常长 (30分钟+)',
  };

  lines.push(`  预计时间: ${timeMap[estimate.estimatedTime]}`);
  lines.push('');
  lines.push(`建议: ${estimate.recommendation.reason}`);

  return lines.join('\n');
}
