import { AcpServerManager } from '../utils/acp-server-manager';

const serverManager = new AcpServerManager();

export async function acp(args: string[]): Promise<void> {
  const action = args[0] || 'status';

  const handlers: Record<string, () => Promise<void>> = {
    start: () => startServer(args),
    stop: stopServer,
    status: serverStatus,
    agents: listAgents,
    run: () => runViaAcp(args),
    stream: () => streamViaAcp(args),
  };

  const handler = handlers[action];
  if (!handler) {
    console.log('用法: acp <action> [options]');
    console.log('动作:');
    console.log('  start    启动 ACP Server');
    console.log('  stop     停止 ACP Server');
    console.log('  status   查看服务器状态');
    console.log('  agents   发现可用 Agent');
    console.log('  run      通过 ACP 执行任务');
    console.log('  stream   通过 ACP 流式执行任务');
    return;
  }

  await handler();
}

async function startServer(args: string[]): Promise<void> {
  const options: { yolo?: boolean; allowedTools?: string[]; disabledTools?: string[] } = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--yolo') {
      options.yolo = true;
    } else if (args[i] === '--allowed-tool' && args[i + 1]) {
      options.allowedTools = options.allowedTools || [];
      options.allowedTools.push(args[i + 1]);
      i++;
    } else if (args[i] === '--disabled-tool' && args[i + 1]) {
      options.disabledTools = options.disabledTools || [];
      options.disabledTools.push(args[i + 1]);
      i++;
    }
  }

  console.log('正在启动 ACP Server...');

  try {
    await serverManager.start(options);
    console.log('\nACP Server 已启动');
    console.log('  传输: STDIO JSON-RPC');
    console.log('\n使用 acp run "任务" 执行任务');
    console.log('使用 acp stream "任务" 流式执行');
    await new Promise(() => {});
  } catch (error: unknown) {
    console.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function stopServer(): Promise<void> {
  if (!serverManager.isRunning()) {
    console.log('ACP Server 未运行。');
    return;
  }

  console.log('正在停止 ACP Server...');
  await serverManager.stop();
  console.log('ACP Server 已停止。');
}

async function serverStatus(): Promise<void> {
  const status = serverManager.getStatus();

  console.log('\nACP Server 状态\n');
  console.log(`  运行中: ${status.running ? '是' : '否'}`);
  if (status.running) {
    console.log('  传输: STDIO JSON-RPC');
    console.log('  健康检查: 正常');
  } else {
    console.log('\n使用 acp start 启动服务器');
  }
}

async function listAgents(): Promise<void> {
  if (!serverManager.isRunning()) {
    console.log('正在启动 ACP Server...');
    try {
      await serverManager.start({ yolo: true });
    } catch (error: unknown) {
      console.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  }

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  try {
    // start() already called initialize() — initialize() is idempotent.
    const initResult = await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });
    console.log('\nAgent 信息\n');
    if (initResult.agentInfo) {
      console.log(`  名称: ${initResult.agentInfo.name}`);
      console.log(`  版本: ${initResult.agentInfo.version}`);
    }
    console.log(`  协议版本: ${initResult.protocolVersion}`);
    console.log('\n能力');
    console.log(`  加载会话: ${initResult.agentCapabilities.loadSession ? '是' : '否'}`);
    console.log(`  MCP HTTP: ${initResult.agentCapabilities.mcpCapabilities?.http ? '是' : '否'}`);
    console.log(`  MCP SSE: ${initResult.agentCapabilities.mcpCapabilities?.sse ? '是' : '否'}`);
    console.log(`  会话列表: ${initResult.agentCapabilities.sessionCapabilities?.list ? '是' : '否'}`);
  } catch (error: unknown) {
    console.error(`获取 Agent 信息失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await serverManager.stop();
  }
}

async function runViaAcp(args: string[]): Promise<void> {
  if (!await ensureServerRunning()) return;

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  const prompt = args.slice(1).join(' ');
  if (!prompt) {
    console.log('请提供任务描述: acp run "任务"');
    return;
  }

  console.log(`通过 ACP 执行任务: ${prompt.substring(0, 50)}...`);

  try {
    console.log('正在初始化...');
    await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });
    console.log('初始化成功');

    const cwd = process.cwd();
    console.log('正在创建会话...');
    if (!client.getSessionId()) {
      await client.createSession(cwd, []);
    }
    console.log(`会话已创建: ${client.getSessionId()}`);

    console.log('\n--- 开始执行 ---\n');
    let output = '';
    const result = await client.sessionPrompt(prompt, (update) => {
      if (update.update?.content?.text) {
        output += update.update.content.text;
        process.stdout.write(update.update.content.text);
      }
    });

    console.log('\n--- 执行结束 ---\n');
    if (output) {
      console.log('输出\n');
      console.log(output);
    }
    console.log(`\n停止原因: ${result.stopReason || 'completed'}`);
  } catch (error: unknown) {
    console.error(`\n执行失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    console.log('正在停止 ACP Server...');
    await serverManager.stop();
  }
}

async function streamViaAcp(args: string[]): Promise<void> {
  if (!await ensureServerRunning()) return;

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  const prompt = args.slice(1).join(' ');
  if (!prompt) {
    console.log('请提供任务描述: acp stream "任务"');
    return;
  }

  console.log(`通过 ACP 流式执行任务: ${prompt.substring(0, 50)}...`);

  try {
    await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });

    const cwd = process.cwd();
    if (!client.getSessionId()) {
      await client.createSession(cwd, []);
    }

    console.log('\n--- 流式输出 ---\n');
    await client.sessionPrompt(prompt, (update) => {
      if (update.update?.content?.text) {
        process.stdout.write(update.update.content.text);
      }
    });
    console.log('\n--- 流式输出结束 ---');
  } catch (error: unknown) {
    console.error(`\n执行失败: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await serverManager.stop();
  }
}

async function ensureServerRunning(): Promise<boolean> {
  if (!serverManager.isRunning()) {
    console.log('ACP Server 未运行。正在启动...');
    try {
      await serverManager.start({ yolo: true });
      return true;
    } catch (error: unknown) {
      console.error(`启动失败: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  return true;
}
