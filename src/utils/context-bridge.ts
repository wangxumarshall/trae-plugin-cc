import { SessionReader, SessionMeta } from './session-reader';

export interface ResumedPrompt {
  args: string[];
  contextPreview: string;
}

export class ContextBridge {
  private sessionReader: SessionReader;

  constructor() {
    this.sessionReader = new SessionReader();
  }

  buildResumedPrompt(
    sessionId: string,
    newTask: string
  ): ResumedPrompt {
    const context = this.sessionReader.getContextSummary(sessionId);
    const lastMessages = this.sessionReader.getConversation(sessionId, { limit: 5 });

    let contextPreview = `## 恢复会话 ${sessionId}\n\n`;
    contextPreview += `### 最近对话:\n`;
    for (const msg of lastMessages) {
      const preview = msg.content.length > 100
        ? msg.content.substring(0, 100) + '...'
        : msg.content;
      contextPreview += `- **${msg.role}**: ${preview}\n`;
    }

    return {
      args: ['--resume', sessionId, '--print', newTask],
      contextPreview,
    };
  }

  findSessionByCwd(cwd: string): string | null {
    const recent = this.sessionReader.getRecentSession(cwd);
    return recent?.id || null;
  }

  findSessionByTopic(topic: string): string | null {
    const match = this.sessionReader.findSessionByTopic(topic);
    return match?.id || null;
  }

  buildContextFromSession(sessionId: string): string {
    const meta = this.sessionReader.getSession(sessionId);
    if (!meta) return '';

    const conversation = this.sessionReader.getConversation(sessionId, { limit: 10 });
    const toolCalls = this.sessionReader.getToolCalls(sessionId);
    const fileStatus = this.sessionReader.getFileTrackStatus(sessionId);

    let context = `## Trae CLI 会话上下文\n\n`;
    context += `**会话标题**: ${meta.metadata.title}\n`;
    context += `**工作目录**: ${meta.metadata.cwd}\n`;
    context += `**模型**: ${meta.metadata.model_name}\n\n`;

    if (conversation.length > 0) {
      context += `### 对话摘要\n`;
      for (const msg of conversation) {
        const preview = msg.content.length > 150
          ? msg.content.substring(0, 150) + '...'
          : msg.content;
        context += `- **${msg.role}**: ${preview}\n`;
      }
      context += '\n';
    }

    if (toolCalls.length > 0) {
      context += `### 工具调用记录 (${toolCalls.length} 次)\n`;
      const toolNames = [...new Set(toolCalls.map(tc => tc.name))];
      for (const name of toolNames) {
        const count = toolCalls.filter(tc => tc.name === name).length;
        context += `- ${name}: ${count} 次\n`;
      }
      context += '\n';
    }

    const trackedFiles = Object.keys(fileStatus);
    if (trackedFiles.length > 0) {
      context += `### 已访问文件 (${trackedFiles.length} 个)\n`;
      for (const f of trackedFiles.slice(0, 20)) {
        context += `- ${f}\n`;
      }
      context += '\n';
    }

    return context;
  }

  injectContextToPrompt(sessionId: string, newPrompt: string): string {
    const context = this.buildContextFromSession(sessionId);
    if (!context) return newPrompt;

    return `${context}\n---\n\n基于以上上下文，请继续执行以下任务:\n\n${newPrompt}`;
  }
}
