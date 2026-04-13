#!/usr/bin/env node

import { setup } from './commands/setup';
import { review } from './commands/review';
import { runTask } from './commands/run';
import { status, result, cancel } from './commands/jobs';
import { handleHook } from './commands/hooks';
import { rescue } from './commands/rescue';
import { sessions } from './commands/sessions';
import { acp } from './commands/acp';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const cmdArgs = args.slice(1);

  if (!command) {
    console.log('用法: trae <command> [args]');
    console.log('命令: setup, review, adversarial-review, run, status, result, cancel, sessions, acp');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'setup':
        await setup(cmdArgs);
        break;
      case 'review':
        await review(cmdArgs, false);
        break;
      case 'adversarial-review':
        await review(cmdArgs, true);
        break;
      case 'run':
        await runTask(cmdArgs);
        break;
      case 'status':
        status(cmdArgs);
        break;
      case 'result':
        result(cmdArgs);
        break;
      case 'cancel':
        cancel(cmdArgs);
        break;
      case 'hooks':
        await handleHook(cmdArgs);
        break;
      case 'rescue':
        await rescue(cmdArgs);
        break;
      case 'sessions':
        await sessions(cmdArgs);
        break;
      case 'acp':
        await acp(cmdArgs);
        break;
      default:
        console.log(`未知命令: ${command}`);
        console.log('可用命令: setup, review, adversarial-review, run, status, result, cancel, sessions, acp');
        process.exit(1);
    }
  } catch (error: any) {
    console.error('执行失败:', error.message);
    process.exit(1);
  }
}

main();
