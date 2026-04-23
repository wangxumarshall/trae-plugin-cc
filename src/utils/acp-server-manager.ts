import { spawn, ChildProcess } from 'child_process';
import { AcpClient } from './acp-client';
import { buildSpawnEnv } from './env';

interface StartupEvent {
  at: string;
  event: string;
  detail?: string;
}

interface StartOptions {
  yolo?: boolean;
  allowedTools?: string[];
  disabledTools?: string[];
}

export class AcpServerManager {
  private process: ChildProcess | null = null;
  private client: AcpClient | null = null;

  async start(options?: StartOptions): Promise<{ client: AcpClient }> {
    if (this.isRunning()) {
      return { client: this.client! };
    }

    return new Promise((resolve, reject) => {
      const args = this.buildArgs(options);
      const startupEvents: StartupEvent[] = [];
      const outputSnippets: string[] = [];
      let started = false;
      let settled = false;

      const recordEvent = (event: string, detail?: string): void => {
        startupEvents.push({
          at: new Date().toISOString(),
          event,
          detail,
        });
      };

      const rememberOutput = (source: 'stdout' | 'stderr', text: string): void => {
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (!normalized) return;
        outputSnippets.push(`[${source}] ${normalized}`);
        if (outputSnippets.length > 8) outputSnippets.shift();
      };

      const buildDiagnostic = (): string => {
        const trace = startupEvents
          .map((item, idx) => `${idx + 1}. ${item.at} ${item.event}${item.detail ? ` | ${item.detail}` : ''}`)
          .join('\n');
        const recentOutput = outputSnippets.length > 0
          ? outputSnippets.map((line, idx) => `${idx + 1}. ${line}`).join('\n')
          : 'none';
        return `\n[ACP] startup diagnostics\ntrace:\n${trace || 'none'}\nrecent_output:\n${recentOutput}`;
      };

      const fail = (message: string): void => {
        if (settled) return;
        settled = true;
        reject(new Error(`${message}${buildDiagnostic()}`));
      };

      const succeed = (): void => {
        if (settled) return;
        settled = true;
        const client = new AcpClient(child.stdin!, child.stdout!);
        this.process = child;
        this.client = client;
        recordEvent('stdio:ready');
        resolve({ client });
      };

      const env = buildSpawnEnv();

      recordEvent('spawn:start', `cmd=trae-cli ${args.join(' ')}`);

      const child = spawn('trae-cli', args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });

      recordEvent('spawn:created', `pid=${child.pid || 'unknown'}`);

      child.stdout?.on('data', (chunk: Buffer) => {
        rememberOutput('stdout', chunk.toString());
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        rememberOutput('stderr', chunk.toString());
      });

      child.on('error', (err) => {
        recordEvent('process:error', err.message);
        fail(`ACP server spawn failed: ${err.message}`);
      });

      child.on('close', (code, signal) => {
        recordEvent('process:close', `code=${code ?? 'null'}, signal=${signal ?? 'null'}`);
        this.process = null;
        if (!started) {
          fail(`ACP server exited before ready (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
        }
      });

      setTimeout(() => {
        if (!started && !settled) {
          const alive = child.exitCode === null;
          recordEvent('startup:timeout', `alive=${alive}, exitCode=${child.exitCode ?? 'null'}`);

          if (alive) {
            started = true;
            succeed();
            return;
          }

          fail('ACP server startup timeout (15s)');
        }
      }, 10000);
    });
  }

  private buildArgs(options?: StartOptions): string[] {
    const args: string[] = ['acp', 'serve'];

    if (options?.yolo) args.push('--yolo');
    if (options?.allowedTools?.length) {
      for (const tool of options.allowedTools) {
        args.push('--allowed-tool', tool);
      }
    }
    if (options?.disabledTools?.length) {
      for (const tool of options.disabledTools) {
        args.push('--disabled-tool', tool);
      }
    }

    return args;
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.stdin?.end();
      this.process.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          if (this.process) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 3000);
      });
      this.process = null;
      this.client = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  getClient(): AcpClient | null {
    return this.client;
  }

  getStatus(): { running: boolean; baseUrl: string } {
    return {
      running: this.isRunning(),
      baseUrl: this.isRunning() ? 'stdio://trae-cli' : '',
    };
  }
}
