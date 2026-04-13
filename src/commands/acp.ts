import { AcpServerManager } from '../utils/acp-server-manager';
import { AcpClient } from '../utils/acp-client';
import { TraeExecutor, TraeTaskConfig } from '../utils/trae-executor';

const serverManager = new AcpServerManager();

export async function acp(args: string[]) {
  const action = args[0] || 'status';

  switch (action) {
    case 'start':
      return startServer(args);
    case 'stop':
      return stopServer();
    case 'status':
      return serverStatus();
    case 'agents':
      return listAgents();
    case 'run':
      return runViaAcp(args);
    case 'stream':
      return streamViaAcp(args);
    default:
      console.log('用法: /trae:acp <action> [options]');
      console.log('动作:');
      console.log('  start    启动 ACP Server');
      console.log('  stop     停止 ACP Server');
      console.log('  status   查看服务器状态');
      console.log('  agents   发现可用 Agent');
      console.log('  run      通过 ACP 执行任务');
      console.log('  stream   通过 ACP 流式执行任务');
  }
}

async function startServer(args: string[]) {
  const options: { yolo?: boolean; allowedTools?: string[]; disabledTools?: string[] } = {};

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--yolo') {
      options.yolo = true;
    }
    if (args[i] === '--allowed-tool' && args[i + 1]) {
      options.allowedTools = options.allowedTools || [];
      options.allowedTools.push(args[i + 1]);
      i++;
    }
    if (args[i] === '--disabled-tool' && args[i + 1]) {
      options.disabledTools = options.disabledTools || [];
      options.disabledTools.push(args[i + 1]);
      i++;
    }
  }

  console.log('正在启动 ACP Server...');

  try {
    const result = await serverManager.start(options);
    console.log(`\n✅ ACP Server 已启动`);
    console.log(`  端口: ${result.port}`);
    console.log(`  地址: ${result.baseUrl}`);
    console.log(`\n使用 /trae:acp agents 查看可用 Agent`);
    console.log(`使用 /trae:acp run "任务" 执行任务`);
  } catch (error: any) {
    console.error(`❌ 启动失败: ${error.message}`);
  }
}

async function stopServer() {
  if (!serverManager.isRunning()) {
    console.log('ACP Server 未运行。');
    return;
  }

  console.log('正在停止 ACP Server...');
  await serverManager.stop();
  console.log('✅ ACP Server 已停止。');
}

async function serverStatus() {
  const status = serverManager.getStatus();

  console.log('\n## ACP Server 状态\n');
  console.log(`  运行中: ${status.running ? '✅' : '❌'}`);
  if (status.running) {
    console.log(`  端口: ${status.port}`);
    console.log(`  地址: ${status.baseUrl}`);

    const client = serverManager.getClient();
    if (client) {
      const healthy = await client.healthCheck();
      console.log(`  健康检查: ${healthy ? '✅ 正常' : '❌ 异常'}`);
    }
  } else {
    console.log('\n使用 /trae:acp start 启动服务器');
  }
}

async function listAgents() {
  const status = serverManager.getStatus();

  if (!status.running) {
    console.log('ACP Server 未运行。使用 /trae:acp start 启动。');
    return;
  }

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  try {
    const agents = await client.discoverAgents();

    if (agents.length === 0) {
      console.log('没有发现可用的 Agent。');
      return;
    }

    console.log(`\n## 发现 ${agents.length} 个 Agent\n`);

    for (const agent of agents) {
      console.log(`### ${agent.name}`);
      console.log(`  描述: ${agent.description}`);
      if (agent.metadata) {
        console.log(`  元数据: ${JSON.stringify(agent.metadata)}`);
      }
      console.log('');
    }
  } catch (error: any) {
    console.error(`获取 Agent 列表失败: ${error.message}`);
  }
}

async function runViaAcp(args: string[]) {
  const status = serverManager.getStatus();

  if (!status.running) {
    console.log('ACP Server 未运行。正在启动...');
    try {
      await serverManager.start({ yolo: true });
    } catch (error: any) {
      console.error(`启动失败: ${error.message}`);
      return;
    }
  }

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  const prompt = args.slice(1).join(' ');
  if (!prompt) {
    console.log('请提供任务描述: /trae:acp run "任务"');
    return;
  }

  console.log(`正在通过 ACP 执行任务: ${prompt.substring(0, 50)}...`);

  try {
    const result = await client.runAgent({
      agent_name: 'trae-agent',
      input: [{
        role: 'user',
        parts: [{ content: prompt, content_type: 'text/plain' }],
      }],
    });

    console.log('\n## 执行结果\n');
    console.log(`  Run ID: ${result.run_id}`);
    console.log(`  Session ID: ${result.session_id}`);
    console.log(`  状态: ${result.status}`);

    if (result.output && result.output.length > 0) {
      console.log('\n### 输出\n');
      for (const out of result.output) {
        for (const part of out.parts) {
          console.log(part.content);
        }
      }
    }

    if (result.error) {
      console.log(`\n❌ 错误: ${result.error}`);
    }
  } catch (error: any) {
    console.error(`执行失败: ${error.message}`);
  }
}

async function streamViaAcp(args: string[]) {
  const status = serverManager.getStatus();

  if (!status.running) {
    console.log('ACP Server 未运行。正在启动...');
    try {
      await serverManager.start({ yolo: true });
    } catch (error: any) {
      console.error(`启动失败: ${error.message}`);
      return;
    }
  }

  const client = serverManager.getClient();
  if (!client) {
    console.log('无法获取 ACP Client。');
    return;
  }

  const prompt = args.slice(1).join(' ');
  if (!prompt) {
    console.log('请提供任务描述: /trae:acp stream "任务"');
    return;
  }

  console.log(`正在通过 ACP 流式执行任务: ${prompt.substring(0, 50)}...`);
  console.log('--- 流式输出 ---\n');

  try {
    await client.runStream(
      {
        agent_name: 'trae-agent',
        input: [{
          role: 'user',
          parts: [{ content: prompt, content_type: 'text/plain' }],
        }],
      },
      (event) => {
        if (event.output) {
          for (const out of event.output) {
            if (out.parts) {
              for (const part of out.parts) {
                console.log(part.content);
              }
            }
          }
        }
        if (event.status) {
          console.log(`[状态: ${event.status}]`);
        }
      }
    );

    console.log('\n--- 流式输出结束 ---');
  } catch (error: any) {
    console.error(`\n执行失败: ${error.message}`);
  }
}
