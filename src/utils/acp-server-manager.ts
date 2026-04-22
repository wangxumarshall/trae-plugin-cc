import { spawn, ChildProcess } from 'child_process';
import { AcpClient } from '../utils/acp-client';

type StartupEvent = {
  at: string;
  event: string;
  detail?: string;
};

export class AcpServerManager {
  private process: ChildProcess | null = null;
  private port: number = 0;
  private client: AcpClient | null = null;

  async start(options?: { yolo?: boolean; allowedTools?: string[]; disabledTools?: string[] }): Promise<{
    port: number;
    baseUrl: string;
  }> {
    if (this.isRunning()) {
      return {
        port: this.port,
        baseUrl: `http://localhost:${this.port}`,
      };
    }

    return new Promise((resolve, reject) => {
      const args: string[] = ['acp', 'serve'];

      if (options?.yolo) args.push('--yolo');
      if (options?.allowedTools) {
        for (const tool of options.allowedTools) {
          args.push('--allowed-tool', tool);
        }
      }
      if (options?.disabledTools) {
        for (const tool of options.disabledTools) {
          args.push('--disabled-tool', tool);
        }
      }

      const startupEvents: StartupEvent[] = [];
      const outputSnippets: string[] = [];
      let started = false;
      let settled = false;
      let firstStdoutSeen = false;
      let firstStderrSeen = false;

      const recordEvent = (event: string, detail?: string) => {
        startupEvents.push({
          at: new Date().toISOString(),
          event,
          detail,
        });
      };

      const rememberOutput = (source: 'stdout' | 'stderr', text: string) => {
        const normalized = text.replace(/\s+/g, ' ').trim();
        if (!normalized) return;
        outputSnippets.push(`[${source}] ${normalized}`);
        if (outputSnippets.length > 8) outputSnippets.shift();
      };

      const buildDiagnostic = () => {
        const trace = startupEvents
          .map((item, idx) => `${idx + 1}. ${item.at} ${item.event}${item.detail ? ` | ${item.detail}` : ''}`)
          .join('\n');
        const recentOutput = outputSnippets.length > 0
          ? outputSnippets.map((line, idx) => `${idx + 1}. ${line}`).join('\n')
          : 'none';
        return `\n[ACP] startup diagnostics\ntrace:\n${trace || 'none'}\nrecent_output:\n${recentOutput}`;
      };

      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        reject(new Error(`${message}${buildDiagnostic()}`));
      };

      const succeed = (port: number) => {
        if (settled) return;
        settled = true;
        resolve({
          port,
          baseUrl: `http://localhost:${port}`,
        });
      };

      // 设置环境变量，支持 PAT 认证
      const env = { ...process.env };
      if (process.env.TRAECLI_PERSONAL_ACCESS_TOKEN) {
        env.TRAECLI_PERSONAL_ACCESS_TOKEN = process.env.TRAECLI_PERSONAL_ACCESS_TOKEN;
      }

      recordEvent('spawn:start', `cmd=trae-cli ${args.join(' ')}`);

      const child = spawn('trae-cli', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      });

      recordEvent('spawn:created', `pid=${child.pid || 'unknown'}`);

      const detectPort = (text: string, source: 'stdout' | 'stderr') => {
        rememberOutput(source, text);

        const portMatch = text.match(/listening.*?:(\d+)/i) ||
                          text.match(/port.*?(\d+)/i) ||
                          text.match(/http:\/\/localhost:(\d+)/i) ||
                          text.match(/:(\d{4,5})/);
        if (portMatch && !started) {
          started = true;
          this.port = parseInt(portMatch[1], 10);
          this.process = child;
          this.client = new AcpClient(`http://localhost:${this.port}`);
          recordEvent('port:detected', `source=${source}, port=${this.port}`);
          succeed(this.port);
        }
      };

      child.stdout?.on('data', (chunk: Buffer) => {
        if (!firstStdoutSeen) {
          firstStdoutSeen = true;
          recordEvent('stdout:first-chunk');
        }
        detectPort(chunk.toString(), 'stdout');
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        if (!firstStderrSeen) {
          firstStderrSeen = true;
          recordEvent('stderr:first-chunk');
        }
        detectPort(chunk.toString(), 'stderr');
      });

      child.on('error', (err) => {
        recordEvent('process:error', err.message);
        fail(`ACP server spawn failed: ${err.message}`);
      });

      child.on('close', (code, signal) => {
        recordEvent('process:close', `code=${code ?? 'null'}, signal=${signal ?? 'null'}`);
        this.process = null;
        if (!started) {
          fail(`ACP server exited before port detected (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
        }
      });

      setTimeout(() => {
        if (!started && !settled) {
          const alive = child.exitCode === null;
          recordEvent('startup:timeout', `alive=${alive}, exitCode=${child.exitCode ?? 'null'}, signalCode=${child.signalCode ?? 'null'}`);

          if (alive) {
            child.kill('SIGTERM');
            fail('ACP server process is alive but no port was detected within 15s');
            return;
          }

          fail('ACP server startup timeout (15s)');
        }
      }, 15000);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
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
      this.port = 0;
      this.client = null;
    }
  }

  isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  getPort(): number {
    return this.port;
  }

  getClient(): AcpClient | null {
    return this.client;
  }

  getStatus(): {
    running: boolean;
    port: number;
    baseUrl: string;
  } {
    return {
      running: this.isRunning(),
      port: this.port,
      baseUrl: this.port ? `http://localhost:${this.port}` : '',
    };
  }
}
