import { SessionReader } from '../utils/session-reader';
import { ContextBridge } from '../utils/context-bridge';
import { formatEstimate } from '../utils/branch-detection';

const reader = new SessionReader();
const bridge = new ContextBridge();

export async function sessions(args: string[]): Promise<void> {
  const action = args[0] || 'list';

  const handlers: Record<string, (args: string[]) => void> = {
    list: listSessions,
    detail: detailSession,
    conversation: conversationSession,
    tools: toolsSession,
    context: contextSession,
    recent: recentSession,
    find: findSession,
    delete: deleteSession,
    'delete-smoke': deleteSmokeSessions,
  };

  const handler = handlers[action];
  if (!handler) {
    console.log('用法: sessions <action> [options]');
    console.log('动作:');
    console.log('  list          列出所有会话 (默认)');
    console.log('  recent        查看最近会话');
    console.log('  detail <id>   查看会话详情');
    console.log('  conversation <id>  获取对话历史');
    console.log('  tools <id>    获取工具调用记录');
    console.log('  context <id>  获取完整上下文摘要');
    console.log('  find <topic>  按主题搜索会话');
    console.log('  delete <id>   删除会话');
    console.log('  delete-smoke  删除标题或ID包含"smoke"的会话');
    return;
  }

  handler(args);
}

function parseCommonOptions(args: string[], startFrom: number): { cwd?: string; limit: number } {
  let cwd: string | undefined;
  let limit = 20;

  for (let i = startFrom; i < args.length; i++) {
    if (args[i] === '--cwd' && args[i + 1]) {
      cwd = args[i + 1];
      i++;
    } else if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    }
  }

  return { cwd, limit };
}

function listSessions(args: string[]): void {
  const { cwd, limit } = parseCommonOptions(args, 1);
  const sessions = reader.listSessions({ cwd, limit });

  if (sessions.length === 0) {
    console.log('没有找到任何会话记录。');
    return;
  }

  const columns: TableColumn[] = [
    { header: 'ID', width: 36, value: row => (row.id as string).substring(0, 36) },
    { header: '模型', width: 14, value: row => (row.model_name as string).padEnd(14) },
    {
      header: '工作目录',
      width: 48,
      value: row => {
        const p = row.cwd as string;
        return p.length > 48 ? '...' + p.substring(p.length - 45) : p.padEnd(48);
      },
    },
    {
      header: '标题',
      width: 30,
      value: row => {
        const t = row.title as string;
        return t.length > 30 ? t.substring(0, 27) + '...' : t;
      },
    },
  ];

  const rows = sessions.map(s => ({
    id: s.id,
    model_name: s.metadata.model_name,
    cwd: s.metadata.cwd,
    title: s.metadata.title,
  }));

  console.log(`\n找到 ${sessions.length} 个会话:\n`);
  console.log(formatTable(columns, rows));
  console.log('\n使用 sessions detail <id> 查看详情');
}

function detailSession(args: string[]): void {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: sessions detail <session-id>');
    return;
  }

  const meta = reader.getSession(sessionId);
  if (!meta) {
    console.log(`会话 ${sessionId} 不存在。`);
    return;
  }

  console.log('\n会话详情\n');
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
      if ((e as Record<string, unknown>)[key]) {
        eventTypes[key] = (eventTypes[key] || 0) + 1;
      }
    }
  }

  console.log('\n  事件统计:');
  for (const [type, count] of Object.entries(eventTypes)) {
    console.log(`    ${type}: ${count}`);
  }
}

function conversationSession(args: string[]): void {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: sessions conversation <session-id>');
    return;
  }

  const [, , ...rest] = args;
  const { limit } = parseCommonOptions(rest, 0);
  const messages = reader.getConversation(sessionId, { limit });

  if (messages.length === 0) {
    console.log('该会话没有对话记录。');
    return;
  }

  console.log(`\n对话历史 (${messages.length} 条消息)\n`);

  for (const msg of messages) {
    const roleLabel = msg.role === 'user' ? '用户' : '助手';
    const content = msg.content.length > 500
      ? msg.content.substring(0, 500) + '...'
      : msg.content;

    console.log(`${roleLabel} [${msg.timestamp}]:`);
    console.log(`${content}`);
    if (msg.toolCalls?.length) {
      console.log(`  调用工具: ${msg.toolCalls.join(', ')}`);
    }
    console.log('');
  }
}

function toolsSession(args: string[]): void {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: sessions tools <session-id>');
    return;
  }

  const toolCalls = reader.getToolCalls(sessionId);

  if (toolCalls.length === 0) {
    console.log('该会话没有工具调用记录。');
    return;
  }

  console.log(`\n工具调用记录 (${toolCalls.length} 次)\n`);

  const toolStats: Record<string, number> = {};
  for (const tc of toolCalls) {
    toolStats[tc.name] = (toolStats[tc.name] || 0) + 1;
  }

  console.log('统计');
  for (const [name, count] of Object.entries(toolStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${name}: ${count} 次`);
  }

  console.log('\n详细记录\n');
  for (const tc of toolCalls.slice(0, 30)) {
    const inputStr = typeof tc.input === 'string'
      ? tc.input.substring(0, 100)
      : JSON.stringify(tc.input).substring(0, 100);
    const status = tc.isError ? '错误' : '成功';

    console.log(`${status} ${tc.name} [${tc.timestamp}]`);
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

function contextSession(args: string[]): void {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: sessions context <session-id>');
    return;
  }

  const summary = reader.getContextSummary(sessionId);
  console.log(summary);
}

function recentSession(args: string[]): void {
  const [, , ...rest] = args;
  const { cwd } = parseCommonOptions(rest, 0);

  const recent = reader.getRecentSession(cwd);
  if (!recent) {
    console.log('没有找到最近的会话。');
    return;
  }

  console.log('\n最近会话\n');
  console.log(`  ID:       ${recent.id}`);
  console.log(`  标题:     ${recent.metadata.title}`);
  console.log(`  工作目录: ${recent.metadata.cwd}`);
  console.log(`  模型:     ${recent.metadata.model_name}`);
  console.log(`  更新时间: ${recent.updated_at}`);
  console.log(`\n使用 run "继续" --resume ${recent.id} 恢复该会话`);
}

function findSession(args: string[]): void {
  const topic = args.slice(1).join(' ');
  if (!topic) {
    console.log('请提供搜索关键词: sessions find <topic>');
    return;
  }

  const match = reader.findSessionByTopic(topic);
  if (!match) {
    console.log(`没有找到包含 "${topic}" 的会话。`);
    return;
  }

  console.log('\n找到匹配会话\n');
  console.log(`  ID:       ${match.id}`);
  console.log(`  标题:     ${match.metadata.title}`);
  console.log(`  工作目录: ${match.metadata.cwd}`);
  console.log(`  模型:     ${match.metadata.model_name}`);
  console.log(`  更新时间: ${match.updated_at}`);
}

function deleteSession(args: string[]): void {
  const sessionId = args[1];
  if (!sessionId) {
    console.log('请提供会话 ID: sessions delete <session-id>');
    return;
  }

  const success = reader.deleteSession(sessionId);
  if (success) {
    console.log(`会话 ${sessionId} 已删除。`);
  } else {
    console.log(`删除会话 ${sessionId} 失败。`);
  }
}

function deleteSmokeSessions(args: string[]): void {
  const allSessions = reader.listSessions();
  const smokeSessions = allSessions.filter(s =>
    s.id.toLowerCase().includes('smoke') ||
    s.metadata.title.toLowerCase().includes('smoke'),
  );

  if (smokeSessions.length === 0) {
    console.log('没有找到包含 "smoke" 的会话。');
    return;
  }

  console.log(`\n找到 ${smokeSessions.length} 个包含 "smoke" 的会话:\n`);
  for (const s of smokeSessions) {
    console.log(`  - ${s.id.substring(0, 36)} | ${s.metadata.title}`);
  }

  let deleted = 0;
  let failed = 0;

  for (const s of smokeSessions) {
    const success = reader.deleteSession(s.id);
    if (success) {
      deleted++;
    } else {
      failed++;
    }
  }

  console.log(`\n删除完成: 成功 ${deleted} 个，失败 ${failed} 个`);
}

function formatTable(columns: TableColumn[], rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';

  const headers = columns.map(col => col.header);
  const lines: string[] = [];

  lines.push(headers.join(' | '));
  lines.push(columns.map(col => '-'.repeat(col.width)).join('-+-'));

  for (const row of rows) {
    const cells = columns.map(col => {
      const value = col.value(row);
      if (value.length <= col.width) return value.padEnd(col.width);
      return value.substring(0, col.width - 3) + '...';
    });
    lines.push(cells.join(' | '));
  }

  return lines.join('\n');
}

interface TableColumn {
  header: string;
  width: number;
  value: (row: Record<string, unknown>) => string;
}
