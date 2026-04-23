import { SessionReader } from './session-reader';
import { ResumedPrompt } from '../types';

export class ContextBridge {
  private sessionReader: SessionReader;

  constructor() {
    this.sessionReader = new SessionReader();
  }

  buildResumedPrompt(sessionId: string, newTask: string): ResumedPrompt {
    const lastMessages = this.sessionReader.getConversation(sessionId, { limit: 5 });

    const contextPreview = [
      `## 恢复会话 ${sessionId}`,
      '',
      '### 最近对话:',
      ...lastMessages.map(msg => {
        const preview = msg.content.length > 100
          ? msg.content.substring(0, 100) + '...'
          : msg.content;
        return `- **${msg.role}**: ${preview}`;
      }),
    ].join('\n');

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

    const sections: string[] = [
      '## Trae CLI 会话上下文',
      '',
      `**会话标题**: ${meta.metadata.title}`,
      `**工作目录**: ${meta.metadata.cwd}`,
      `**模型**: ${meta.metadata.model_name}`,
      '',
    ];

    if (conversation.length > 0) {
      sections.push('### 对话摘要');
      for (const msg of conversation) {
        const preview = msg.content.length > 150
          ? msg.content.substring(0, 150) + '...'
          : msg.content;
        sections.push(`- **${msg.role}**: ${preview}`);
      }
      sections.push('');
    }

    if (toolCalls.length > 0) {
      sections.push(`### 工具调用记录 (${toolCalls.length} 次)`);
      const toolNames = [...new Set(toolCalls.map(tc => tc.name))];
      for (const name of toolNames) {
        const count = toolCalls.filter(tc => tc.name === name).length;
        sections.push(`- ${name}: ${count} 次`);
      }
      sections.push('');
    }

    const trackedFiles = Object.keys(fileStatus);
    if (trackedFiles.length > 0) {
      sections.push(`### 已访问文件 (${trackedFiles.length} 个)`);
      for (const f of trackedFiles.slice(0, 20)) {
        sections.push(`- ${f}`);
      }
      sections.push('');
    }

    return sections.join('\n');
  }

  injectContextToPrompt(sessionId: string, newPrompt: string): string {
    const context = this.buildContextFromSession(sessionId);
    if (!context) return newPrompt;

    return `${context}---\n\n基于以上上下文，请继续执行以下任务:\n\n${newPrompt}`;
  }
}
