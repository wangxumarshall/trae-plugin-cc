import * as fs from 'fs';
import * as path from 'path';
import { getCliCacheDirs } from '../config';
import {
  SessionMeta,
  SessionEvent,
  ConversationMessage,
  ToolCallRecord,
  FileTrackStatus,
} from '../types';

export class SessionReader {
  private sessionsDir: string;
  private historyFile: string;

  constructor() {
    const cacheDir = this.findCacheDir();
    this.sessionsDir = path.join(cacheDir, 'sessions');
    this.historyFile = path.join(cacheDir, 'history.jsonl');
  }

  private findCacheDir(): string {
    const candidates = getCliCacheDirs();
    return candidates.find(dir => fs.existsSync(dir)) || candidates[0];
  }

  listSessions(options?: { cwd?: string; limit?: number }): SessionMeta[] {
    if (!fs.existsSync(this.sessionsDir)) return [];

    const sessions = fs.readdirSync(this.sessionsDir)
      .filter(dir => fs.existsSync(path.join(this.sessionsDir, dir, 'session.json')))
      .map(dir => this.readSessionJson(dir))
      .filter((s): s is SessionMeta => s !== null)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

    const filtered = options?.cwd
      ? sessions.filter(s => s.metadata.cwd === options.cwd)
      : sessions;

    return options?.limit ? filtered.slice(0, options.limit) : filtered;
  }

  private readSessionJson(dir: string): SessionMeta | null {
    try {
      const content = fs.readFileSync(
        path.join(this.sessionsDir, dir, 'session.json'),
        'utf-8',
      );
      return JSON.parse(content) as SessionMeta;
    } catch {
      return null;
    }
  }

  getSession(sessionId: string): SessionMeta | null {
    const filePath = path.join(this.sessionsDir, sessionId, 'session.json');
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SessionMeta;
    } catch {
      return null;
    }
  }

  getEvents(sessionId: string): SessionEvent[] {
    const filePath = path.join(this.sessionsDir, sessionId, 'events.jsonl');
    if (!fs.existsSync(filePath)) return [];

    return fs.readFileSync(filePath, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => this.parseJson<SessionEvent>(line))
      .filter((e): e is SessionEvent => e !== null);
  }

  getConversation(sessionId: string, options?: { limit?: number }): ConversationMessage[] {
    const events = this.getEvents(sessionId);
    const messages = events
      .filter(e => e.message)
      .map(e => {
        const msg = e.message!.message;
        const content = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.map(c => c.text || '').join('\n')
            : '';

        return {
          role: msg.role,
          content,
          toolCalls: msg.tool_calls?.map(tc => tc.function.name),
          timestamp: e.created_at,
        };
      });

    return options?.limit ? messages.slice(-options.limit) : messages;
  }

  getToolCalls(sessionId: string): ToolCallRecord[] {
    const events = this.getEvents(sessionId);
    const callMap = new Map<string, ToolCallRecord>();

    for (const e of events) {
      if (e.tool_call) {
        callMap.set(e.tool_call.tool_call_id, {
          id: e.tool_call.tool_call_id,
          name: e.tool_call.tool_info.name,
          input: e.tool_call.input,
          timestamp: e.created_at,
        });
      }
    }

    for (const e of events) {
      if (e.tool_call_output) {
        const call = callMap.get(e.tool_call_output.tool_call_id);
        if (call) {
          call.output = e.tool_call_output.output;
          call.isError = e.tool_call_output.is_error;
        }
      }
    }

    return Array.from(callMap.values());
  }

  getFileTrackStatus(sessionId: string): FileTrackStatus {
    const events = this.getEvents(sessionId);
    for (const e of events) {
      if (e.state_update?.updates?.file_track_status) {
        return e.state_update.updates.file_track_status as FileTrackStatus;
      }
    }
    return {};
  }

  getRecentSession(cwd?: string): SessionMeta | null {
    const sessions = this.listSessions({ cwd });
    return sessions[0] || null;
  }

  findSessionByTopic(topic: string): SessionMeta | null {
    const sessions = this.listSessions();
    const lowerTopic = topic.toLowerCase();
    return sessions.find(s => s.metadata.title.toLowerCase().includes(lowerTopic)) || null;
  }

  getContextSummary(sessionId: string): string {
    const meta = this.getSession(sessionId);
    if (!meta) return '会话不存在';

    const conversation = this.getConversation(sessionId, { limit: 20 });
    const toolCalls = this.getToolCalls(sessionId);

    const sections: string[] = [
      `## 会话: ${meta.metadata.title}`,
      `- ID: ${meta.id}`,
      `- 工作目录: ${meta.metadata.cwd}`,
      `- 模型: ${meta.metadata.model_name}`,
      `- 权限模式: ${meta.metadata.permission_mode}`,
      `- 创建时间: ${meta.created_at}`,
      `- 更新时间: ${meta.updated_at}`,
      '',
      `### 最近对话 (${conversation.length} 条消息)`,
    ];

    for (const msg of conversation) {
      const content = msg.content.length > 200
        ? msg.content.substring(0, 200) + '...'
        : msg.content;
      let line = `**${msg.role}**: ${content}`;
      if (msg.toolCalls?.length) {
        line += ` [调用工具: ${msg.toolCalls.join(', ')}]`;
      }
      sections.push(line);
      sections.push('');
    }

    sections.push(`### 工具调用统计 (${toolCalls.length} 次)`);
    const toolStats = this.countToolCalls(toolCalls);
    for (const [name, count] of Object.entries(toolStats)) {
      sections.push(`- ${name}: ${count} 次`);
    }

    return sections.join('\n');
  }

  private countToolCalls(toolCalls: ToolCallRecord[]): Record<string, number> {
    return toolCalls.reduce<Record<string, number>>((stats, tc) => {
      stats[tc.name] = (stats[tc.name] || 0) + 1;
      return stats;
    }, {});
  }

  getHistory(): Array<{ content: string; mode: string; timestamp: string }> {
    if (!fs.existsSync(this.historyFile)) return [];

    return fs.readFileSync(this.historyFile, 'utf-8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => this.parseJson<{ content: string; mode: string; timestamp: string }>(line))
      .filter((h): h is { content: string; mode: string; timestamp: string } => h !== null);
  }

  deleteSession(sessionId: string): boolean {
    const sessionDir = path.join(this.sessionsDir, sessionId);
    if (!fs.existsSync(sessionDir)) return false;

    try {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      return true;
    } catch {
      return false;
    }
  }

  getSessionsDir(): string {
    return this.sessionsDir;
  }

  private parseJson<T>(line: string): T | null {
    try {
      return JSON.parse(line) as T;
    } catch {
      return null;
    }
  }
}
