import { Readable, Writable } from 'stream';
import {
  AcpInitializeResult,
  AcpSessionNewResult,
  AcpSessionUpdate,
  AcpSessionPromptResult,
} from '../types';

interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

export class AcpClient {
  private stdin: Writable;
  private stdout: Readable;
  private messageId = 0;
  private pendingRequests = new Map<number, PendingRequest<unknown>>();
  private requestTimeouts = new Map<number, NodeJS.Timeout>();
  private initialized = false;
  private sessionId: string | null = null;
  private onUpdates: Array<(update: AcpSessionUpdate) => void> = [];
  private buffer = '';
  private readonly REQUEST_TIMEOUT_MS = 300000;

  constructor(stdin: Writable, stdout: Readable) {
    this.stdin = stdin;
    this.stdout = stdout;

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

  private initResultCache: AcpInitializeResult | null = null;

  async initialize(
    clientInfo = { name: 'trae-plugin-cc', version: '1.0.0' },
  ): Promise<AcpInitializeResult> {
    if (this.initialized && this.initResultCache) {
      return this.initResultCache;
    }

    const result = await this.request<AcpInitializeResult>('initialize', {
      protocolVersion: 1,
      clientCapabilities: {},
      clientInfo,
    });

    this.initialized = true;
    this.initResultCache = result;
    return result;
  }

  async createSession(cwd: string, mcpServers: unknown[] = []): Promise<AcpSessionNewResult> {
    if (!this.initialized) {
      throw new Error('Not initialized. Call initialize() first');
    }

    const result = await this.request<AcpSessionNewResult>('session/new', {
      cwd,
      mcpServers,
    });

    this.sessionId = result.sessionId;
    return result;
  }

  async loadSession(sessionId: string, cwd: string, mcpServers: unknown[] = []): Promise<void> {
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
    onUpdate?: (update: AcpSessionUpdate) => void,
  ): Promise<AcpSessionPromptResult> {
    if (!this.sessionId) {
      throw new Error('No active session. Call createSession() or loadSession() first');
    }

    if (onUpdate) {
      this.onUpdates.push(onUpdate);
    }

    try {
      return await this.request<AcpSessionPromptResult>('session/prompt', {
        sessionId: this.sessionId,
        prompt: [{ type: 'text', text: prompt }],
      });
    } finally {
      if (onUpdate) {
        this.onUpdates = this.onUpdates.filter(fn => fn !== onUpdate);
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

  private handleMessages(line: string): void {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    const id = message.id as number | undefined;
    if (id !== undefined && this.pendingRequests.has(id)) {
      const pending = this.pendingRequests.get(id)!;
      const timeout = this.requestTimeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        this.requestTimeouts.delete(id);
      }
      this.pendingRequests.delete(id);

      if (message.error) {
        const errMsg = (message.error as Record<string, unknown>).message as string;
        pending.reject(new Error(errMsg || JSON.stringify(message.error)));
      } else {
        pending.resolve(message.result);
      }
    } else if (message.method === 'session/update' && message.params) {
      for (const fn of this.onUpdates) {
        fn(message.params as AcpSessionUpdate);
      }
    }
  }

  private request<T>(method: string, params: unknown): Promise<T> {
    const id = ++this.messageId;

    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        this.requestTimeouts.delete(id);
        reject(new Error(`Request timeout: ${method} (${this.REQUEST_TIMEOUT_MS}ms)`));
      }, this.REQUEST_TIMEOUT_MS);

      this.pendingRequests.set(id, { resolve: resolve as (value: unknown) => void, reject });
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
