import * as fs from 'fs';
import * as path from 'path';
import { getPluginDir } from '../config';
import { BackgroundJob } from '../types';

const PLUGIN_DIR = getPluginDir();

export function getJobs(): BackgroundJob[] {
  if (!fs.existsSync(PLUGIN_DIR)) {
    return [];
  }

  const files = fs.readdirSync(PLUGIN_DIR);
  const pids = files.filter(f => f.endsWith('.pid')).map(f => f.replace('.pid', ''));

  return pids.map(pid => {
    const timestamp = parseInt(pid, 10);
    const logFile = path.join(PLUGIN_DIR, `${pid}.log`);
    const pidFile = path.join(PLUGIN_DIR, `${pid}.pid`);

    let status = '未知';
    if (fs.existsSync(pidFile)) {
      try {
        const processId = fs.readFileSync(pidFile, 'utf-8').trim();
        process.kill(parseInt(processId, 10), 0);
        status = '运行中';
      } catch (e: unknown) {
        const err = e as NodeJS.ErrnoException;
        if (err.code === 'ESRCH') {
          status = '已完成或已中止';
        } else {
          status = '无法验证状态';
        }
      }
    } else {
      status = '已完成或已中止';
    }

    return { id: pid, timestamp, status, logFile, pidFile };
  });
}

export function status(args: string[]): void {
  const jobs = getJobs();
  if (jobs.length === 0) {
    console.log('当前没有运行或记录的后台任务。');
    return;
  }

  console.log('后台任务状态:\n');
  for (const job of jobs) {
    const date = new Date(job.timestamp).toLocaleString();
    console.log(`[ID: ${job.id}] (${date}) 状态: ${job.status}`);
  }
}

export function result(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.log('请提供任务 ID。例如: result 1633022...\n你可以用 status 获取任务 ID。');
    return;
  }

  const logFile = path.join(PLUGIN_DIR, `${id}.log`);
  if (!fs.existsSync(logFile)) {
    console.log(`找不到 ID 为 ${id} 的日志文件。`);
    return;
  }

  const content = fs.readFileSync(logFile, 'utf-8');
  console.log(`任务 ${id} 的结果输出:\n`);
  console.log(content);
}

export function cancel(args: string[]): void {
  const id = args[0];
  if (!id) {
    console.log('请提供要取消的任务 ID。例如: cancel 1633022...\n你可以用 status 获取任务 ID。');
    return;
  }

  const pidFile = path.join(PLUGIN_DIR, `${id}.pid`);
  if (!fs.existsSync(pidFile)) {
    console.log(`找不到 ID 为 ${id} 的任务记录。它可能已经完成或被清理。`);
    return;
  }

  try {
    const pidStr = fs.readFileSync(pidFile, 'utf-8').trim();
    const pid = parseInt(pidStr, 10);

    process.kill(pid, 'SIGKILL');
    console.log(`已发送强制终止信号给任务 ${id} (PID: ${pid})。`);
    fs.unlinkSync(pidFile);
  } catch (e: unknown) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === 'ESRCH') {
      console.log(`任务 ${id} 的进程已经不再运行。`);
    } else {
      console.error(`取消任务时发生错误: ${err.message}`);
    }
  }
}
