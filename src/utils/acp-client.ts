import { Readable, Writable } from 'stream';

export interface AcpInitializeResult {
  protocolVersion: number;
  agentCapabilities: {
    _meta?: Record<string, any>;
    loadSession?: boolean;
    promptCapabilities?: Record<string, any>;
    mcpCapabilities?: { http: boolean; sse: boolean };
    sessionCapabilities?: Record<string, any>;
  };
  agentInfo?: { name: string; title: string; version: string };
  authMethods: any[];
  _meta?: Record<string, any>;
}

export interface AcpSessionNewResult {
  sessionId: string;
  _meta?: Record<string, any>;
  models?: { availableModels: any[]; currentModelId: string };
  modes?: { availableModes: any[]; currentModeId: string };
}

export interface AcpSessionUpdate {
  sessionId: string;
  update: {
    sessionUpdate: string;
    content?: { type: string; text: string };
    [key: string]: any;
  };
}

export interface AcpSessionPromptResult {
  stopReason: string;
  [key: string]: any;
}

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

export class AcpClient {
  private stdin: Writable;
  private stdout: Readable;
  private stderr: Readable;
  private messageId = 0;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private requestTimeouts: Map<number, NodeJS.Timeout> = new Map();
  private initialized = false;
  private sessionId: string | null = null;
  private onUpdates: Array<(update: AcpSessionUpdate) => void> = [];
  private buffer = '';
  private readonly REQUEST_TIMEOUT_MS = 60000;

  constructor(stdin: Writable, stdout: Readable, stderr: Readable) {
    this.stdin = stdin;
    this.stdout = stdout;
    this.stderr = stderr;

    const stderrChunks: string[] = [];
    stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk.toString());
    });

    this.stdout.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.trim()) {
          this.handleMessages(line);
        }
      }
    });
  }

  async initialize(clientInfo = { name: 'trae-plugin-cc', version: '1.0.0' }): Promise<AcpInitializeResult> {
    if (this.initialized) {
      throw new Error('Already initialized');
    }

    const result = await this.request('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo,
    });

    this.initialized = true;
    return result;
  }

  async createSession(cwd: string, mcpServers: any[] = []): Promise<AcpSessionNewResult> {
    if (!this.initialized) {
      throw new Error('Not initialized. Call initialize() first');
    }

    const result = await this.request('session/new', {
      cwd,
      mcpServers,
    });

    this.sessionId = result.sessionId;
    return result;
  }

  async loadSession(sessionId: string, cwd: string, mcpServers: any[] = []): Promise<void> {
    if (!this.initialized) {
      throw new Error('Not initialized. Call initialize() first');
    }

    await this.request('session/load', {
      sessionId,
      cwd,
      mcpServers,
    });

    this.sessionId = sessionId;
  }

  async sessionPrompt(
    prompt: string,
    onUpdate?: (update: AcpSessionUpdate) => void
  ): Promise<AcpSessionPromptResult> {
    if (!this.sessionId) {
      throw new Error('No active session. Call createSession() or loadSession() first');
    }

    if (onUpdate) {
      this.onUpdates.push(onUpdate);
    }

    try {
      return await this.request('session/prompt', {
        sessionId: this.sessionId,
        prompt: [{ type: 'text', text: prompt }],
      });
    } finally {
      if (onUpdate) {
        this.onUpdates = this.onUpdates.filter((fn) => fn !== onUpdate);
      }
    }
  }

  async sessionCancel(): Promise<void> {
    if (!this.sessionId) {
      throw new Error('No active session');
    }

    await this.request('session/cancel', { sessionId: this.sessionId });
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  private handleMessages(line: string) {
    let message: any;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    if (message.id !== undefined && this.pendingRequests.has(message.id)) {
      const pending = this.pendingRequests.get(message.id)!;
      const timeout = this.requestTimeouts.get(message.id);
      if (timeout) {
        clearTimeout(timeout);
        this.requestTimeouts.delete(message.id);
      }
      this.pendingRequests.delete(message.id);

      if (message.error) {
        pending.reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
    } else if (message.method === 'session/update' && message.params) {
      for (const fn of this.onUpdates) {
        fn(message.params);
      }
    }
  }

  private request(method: string, params: any): Promise<any> {
    const id = ++this.messageId;

    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.requestTimeouts.delete(id);
        reject(new Error(`Request timeout: ${method} (${this.REQUEST_TIMEOUT_MS}ms)`));
      }, this.REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve, reject });
      this.requestTimeouts.set(id, timeout);

      this.stdin.write(JSON.stringify(message) + '\n', (err) => {
        if (err) {
          clearTimeout(timeout);
          this.pendingRequests.delete(id);
          this.requestTimeouts.delete(id);
          reject(new Error(`Failed to write to stdin: ${err.message}`));
        }
      });
    });
  }
}
