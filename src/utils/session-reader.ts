import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type DataSource = 'file' | 'json' | 'acp';

export interface SessionMeta {
  id: string;
  created_at: string;
  updated_at: string;
  metadata: {
    cwd: string;
    model_name: string;
    permission_mode: string;
    title: string;
  };
}

export interface SessionEvent {
  id: string;
  session_id: string;
  branch: string;
  agent_id: string;
  agent_name: string;
  parent_tool_call_id: string;
  created_at: string;
  message?: {
    message: {
      role: string;
      content: string | Array<{ type: string; text: string }>;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
  };
  tool_call?: {
    tool_call_id: string;
    tool_info: {
      name: string;
      description: string;
      inputSchema: any;
    };
    input: any;
    is_programmatic?: boolean;
  };
  tool_call_output?: {
    tool_call_id: string;
    output: any;
    is_error?: boolean;
  };
  state_update?: {
    updates: Record<string, any>;
  };
  agent_start?: Record<string, any>;
}

export interface ConversationMessage {
  role: string;
  content: string;
  toolCalls?: string[];
  timestamp: string;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  input: any;
  output?: any;
  isError?: boolean;
  timestamp: string;
}

export interface FileTrackStatus {
  [filePath: string]: {
    read_time: string;
    content: string;
  };
}

export interface JsonOutputSession {
  session_id: string;
  messages?: any[];
  [key: string]: any;
}

export class SessionReader {
  private sessionsDir: string;
  private historyFile: string;
  private jsonOutputCache: Map<string, JsonOutputSession> = new Map();

  constructor() {
    const cacheDir = path.join(
      os.homedir(),
      'Library',
      'Caches',
      'trae_cli'
    );
    this.sessionsDir = path.join(cacheDir, 'sessions');
    this.historyFile = path.join(cacheDir, 'history.jsonl');
  }

  listSessions(options?: { cwd?: string; limit?: number }): SessionMeta[] {
    if (!fs.existsSync(this.sessionsDir)) return [];

    const sessions = fs.readdirSync(this.sessionsDir)
      .filter(dir => {
        const sessionFile = path.join(this.sessionsDir, dir, 'session.json');
        return fs.existsSync(sessionFile);
      })
      .map(dir => {
        try {
          const content = fs.readFileSync(
            path.join(this.sessionsDir, dir, 'session.json'),
            'utf-8'
          );
          return JSON.parse(content) as SessionMeta;
        } catch {
          return null;
        }
      })
      .filter((s): s is SessionMeta => s !== null)
      .sort((a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

    let filtered = sessions;
    if (options?.cwd) {
      filtered = filtered.filter(s => s.metadata.cwd === options.cwd);
    }

    if (options?.limit) {
      filtered = filtered.slice(0, options.limit);
    }

    return filtered;
  }

  getSession(sessionId: string): SessionMeta | null {
    const filePath = path.join(this.sessionsDir, sessionId, 'session.json');
    if (!fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return null;
    }
  }

  getEvents(sessionId: string): SessionEvent[] {
    const filePath = path.join(this.sessionsDir, sessionId, 'events.jsonl');
    if (!fs.existsSync(filePath)) return [];

    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    return lines
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line) as SessionEvent; }
        catch { return null; }
      })
      .filter((e): e is SessionEvent => e !== null);
  }

  getConversation(sessionId: string, options?: { limit?: number }): ConversationMessage[] {
    const events = this.getEvents(sessionId);
    let messages = events
      .filter(e => e.message)
      .map(e => {
        const msg = e.message!.message;
        let content = '';
        if (typeof msg.content === 'string') {
          content = msg.content;
        } else if (Array.isArray(msg.content)) {
          content = msg.content.map(c => c.text || '').join('\n');
        }

        return {
          role: msg.role,
          content,
          toolCalls: msg.tool_calls?.map(tc => tc.function.name),
          timestamp: e.created_at,
        };
      });

    if (options?.limit) {
      messages = messages.slice(-options.limit);
    }

    return messages;
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
        return e.state_update.updates.file_track_status;
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
    const match = sessions.find(s =>
      s.metadata.title.toLowerCase().includes(topic.toLowerCase())
    );
    return match || null;
  }

  getContextSummary(sessionId: string): string {
    const meta = this.getSession(sessionId);
    if (!meta) return '会话不存在';

    const conversation = this.getConversation(sessionId, { limit: 20 });
    const toolCalls = this.getToolCalls(sessionId);

    let summary = `## 会话: ${meta.metadata.title}\n`;
    summary += `- ID: ${meta.id}\n`;
    summary += `- 工作目录: ${meta.metadata.cwd}\n`;
    summary += `- 模型: ${meta.metadata.model_name}\n`;
    summary += `- 权限模式: ${meta.metadata.permission_mode}\n`;
    summary += `- 创建时间: ${meta.created_at}\n`;
    summary += `- 更新时间: ${meta.updated_at}\n\n`;

    summary += `### 最近对话 (${conversation.length} 条消息)\n`;
    for (const msg of conversation) {
      const content = msg.content.length > 200
        ? msg.content.substring(0, 200) + '...'
        : msg.content;
      summary += `**${msg.role}**: ${content}`;
      if (msg.toolCalls?.length) {
        summary += ` [调用工具: ${msg.toolCalls.join(', ')}]`;
      }
      summary += '\n\n';
    }

    summary += `### 工具调用统计 (${toolCalls.length} 次)\n`;
    const toolStats: Record<string, number> = {};
    for (const tc of toolCalls) {
      toolStats[tc.name] = (toolStats[tc.name] || 0) + 1;
    }
    for (const [name, count] of Object.entries(toolStats)) {
      summary += `- ${name}: ${count} 次\n`;
    }

    return summary;
  }

  getHistory(): Array<{ content: string; mode: string; timestamp: string }> {
    if (!fs.existsSync(this.historyFile)) return [];

    const lines = fs.readFileSync(this.historyFile, 'utf-8').split('\n');
    return lines
      .filter(line => line.trim())
      .map(line => {
        try { return JSON.parse(line); }
        catch { return null; }
      })
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

  cacheJsonOutput(sessionId: string, output: JsonOutputSession): void {
    this.jsonOutputCache.set(sessionId, output);
  }

  getJsonOutputSession(sessionId: string): JsonOutputSession | null {
    return this.jsonOutputCache.get(sessionId) || null;
  }

  getSessionsDir(): string {
    return this.sessionsDir;
  }
}
