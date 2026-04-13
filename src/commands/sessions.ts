import { SessionReader } from '../utils/session-reader';
import { ContextBridge } from '../utils/context-bridge';

const reader = new SessionReader();
const bridge = new ContextBridge();

export async function sessions(args: string[]) {
  const action = args[0] || 'list';

  switch (action) {
    case 'list':
      return listSessions(args);
    case 'detail':
      return detailSession(args);
    case 'conversation':
      return conversationSession(args);
    case 'tools':
      return toolsSession(args);
    case 'context':
      return contextSession(args);
    case 'recent':
      return recentSession(args);
    case 'find':
      return findSession(args);
    case 'delete':
      return deleteSession(args);
    default:
      console.log('用法: /trae:sessions <action> [options]');
      console.log('动作:');
      console.log('  list          列出所有会话 (默认)');
      console.log('  recent        查看最近会话');
      console.log('  detail <id>   查看会话详情');
      console.log('  conversation <id>  获取对话历史');
      console.log('  tools <id>    获取工具调用记录');
      console.log('  context <id>  获取完整上下文摘要');
      console.log('  find <topic>  按主题搜索会话');
      console.log('  delete <id>   删除会话');
  }
}

function listSessions(args: string[]) {
  let cwd: string | undefined;
  let limit = 20;

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) {
      cwd = args[i + 1];
      i++;
    }
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  const sessions = reader.listSessions({ cwd, limit });

  if (sessions.length === 0) {
    console.log('没有找到任何会话记录。');
    return;
  }

  console.log(`\n找到 ${sessions.length} 个会话:\n`);
  console.log(`  ID                                   | 模型          | 工作目录                                         | 标题`);
  console.log(`  ${'-'.repeat(36)}-+-${'-'.repeat(14)}-+-${'-'.repeat(48)}-+-${'-'.repeat(30)}`);

  for (const s of sessions) {
    const shortId = s.id.substring(0, 36);
    const model = s.metadata.model_name.padEnd(14);
    const cwd = s.metadata.cwd.length > 48
      ? '...' + s.metadata.cwd.substring(s.metadata.cwd.length - 45)
      : s.metadata.cwd.padEnd(48);
    const title = s.metadata.title.length > 30
      ? s.metadata.title.substring(0, 27) + '...'
      : s.metadata.title;

    console.log(`  ${shortId} | ${model} | ${cwd} | ${title}`);
  }

  console.log(`\n使用 /trae:sessions detail <id> 查看详情`);
}

function detailSession(args: string[]) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: /trae:sessions detail <session-id>');
    return;
  }

  const meta = reader.getSession(sessionId);
  if (!meta) {
    console.log(`会话 ${sessionId} 不存在。`);
    return;
  }

  console.log('\n## 会话详情\n');
  console.log(`  ID:       ${meta.id}`);
  console.log(`  标题:     ${meta.metadata.title}`);
  console.log(`  工作目录: ${meta.metadata.cwd}`);
  console.log(`  模型:     ${meta.metadata.model_name}`);
  console.log(`  权限模式: ${meta.metadata.permission_mode}`);
  console.log(`  创建时间: ${meta.created_at}`);
  console.log(`  更新时间: ${meta.updated_at}`);

  const events = reader.getEvents(sessionId);
  const eventTypes: Record<string, number> = {};
  for (const e of events) {
    for (const key of ['message', 'tool_call', 'tool_call_output', 'state_update', 'agent_start']) {
      if ((e as any)[key]) {
        eventTypes[key] = (eventTypes[key] || 0) + 1;
      }
    }
  }

  console.log('\n  事件统计:');
  for (const [type, count] of Object.entries(eventTypes)) {
    console.log(`    ${type}: ${count}`);
  }
}

function conversationSession(args: string[]) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: /trae:sessions conversation <session-id>');
    return;
  }

  let limit = 50;
  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  const messages = reader.getConversation(sessionId, { limit });

  if (messages.length === 0) {
    console.log('该会话没有对话记录。');
    return;
  }

  console.log(`\n## 对话历史 (${messages.length} 条消息)\n`);

  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? '👤 用户' : '🤖 助手';
    const content = msg.content.length > 500
      ? msg.content.substring(0, 500) + '...'
      : msg.content;

    console.log(`**${roleLabel}** [${msg.timestamp}]:`);
    console.log(`${content}`);
    if (msg.toolCalls?.length) {
      console.log(`  📎 调用工具: ${msg.toolCalls.join(', ')}`);
    }
    console.log('');
  }
}

function toolsSession(args: string[]) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: /trae:sessions tools <session-id>');
    return;
  }

  const toolCalls = reader.getToolCalls(sessionId);

  if (toolCalls.length === 0) {
    console.log('该会话没有工具调用记录。');
    return;
  }

  console.log(`\n## 工具调用记录 (${toolCalls.length} 次)\n`);

  const toolStats: Record<string, number> = {};
  for (const tc of toolCalls) {
    toolStats[tc.name] = (toolStats[tc.name] || 0) + 1;
  }

  console.log('### 统计');
  for (const [name, count] of Object.entries(toolStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count} 次`);
  }

  console.log('\n### 详细记录\n');
  for (const tc of toolCalls.slice(0, 30)) {
    const inputStr = typeof tc.input === 'string'
      ? tc.input.substring(0, 100)
      : JSON.stringify(tc.input).substring(0, 100);
    const status = tc.isError ? '❌' : '✅';

    console.log(`${status} **${tc.name}** [${tc.timestamp}]`);
    console.log(`  输入: ${inputStr}${inputStr.length >= 100 ? '...' : ''}`);
    if (tc.output) {
      const outputStr = typeof tc.output === 'string'
        ? tc.output.substring(0, 100)
        : JSON.stringify(tc.output).substring(0, 100);
      console.log(`  输出: ${outputStr}${outputStr.length >= 100 ? '...' : ''}`);
    }
    console.log('');
  }
}

function contextSession(args: string[]) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: /trae:sessions context <session-id>');
    return;
  }

  const summary = reader.getContextSummary(sessionId);
  console.log(summary);
}

function recentSession(args: string[]) {
  let cwd: string | undefined;
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) {
      cwd = args[i + 1];
      i++;
    }
  }

  const recent = reader.getRecentSession(cwd);
  if (!recent) {
    console.log('没有找到最近的会话。');
    return;
  }

  console.log('\n## 最近会话\n');
  console.log(`  ID:       ${recent.id}`);
  console.log(`  标题:     ${recent.metadata.title}`);
  console.log(`  工作目录: ${recent.metadata.cwd}`);
  console.log(`  模型:     ${recent.metadata.model_name}`);
  console.log(`  更新时间: ${recent.updated_at}`);
  console.log(`\n使用 /trae:run "继续" --resume ${recent.id} 恢复该会话`);
}

function findSession(args: string[]) {
  const topic = args.slice(1).join(' ');
  if (!topic) {
    console.log('请提供搜索关键词: /trae:sessions find <topic>');
    return;
  }

  const match = reader.findSessionByTopic(topic);
  if (!match) {
    console.log(`没有找到包含 "${topic}" 的会话。`);
    return;
  }

  console.log('\n## 找到匹配会话\n');
  console.log(`  ID:       ${match.id}`);
  console.log(`  标题:     ${match.metadata.title}`);
  console.log(`  工作目录: ${match.metadata.cwd}`);
  console.log(`  模型:     ${match.metadata.model_name}`);
  console.log(`  更新时间: ${match.updated_at}`);
}

function deleteSession(args: string[]) {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: /trae:sessions delete <session-id>');
    return;
  }

  const success = reader.deleteSession(sessionId);
  if (success) {
    console.log(`会话 ${sessionId} 已删除。`);
  } else {
    console.log(`删除会话 ${sessionId} 失败。`);
  }
}
