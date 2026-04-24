import { spawn, ChildProcess } from 'child_process';
import { AcpClient } from './acp-client';
import { buildSpawnEnv } from './env';

interface StartOptions {
  yolo?: boolean;
  allowedTools?: string[];
  disabledTools?: string[];
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export class AcpServerManager {
  private process: ChildProcess | null = null;
  private client: AcpClient | null = null;

  async start(options?: StartOptions): Promise<{ client: AcpClient }> {
    if (this.isRunning()) {
      return { client: this.client! };
    }

    const args = this.buildArgs(options);
    const env = buildSpawnEnv();
    let client: AcpClient | null = null;

    const child = spawn('trae-cli', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env,
    });

    client = new AcpClient(child.stdin!, child.stdout!);

    // Buffer stderr for diagnostics without interfering with JSON-RPC on stdout
    let stderrBuffer = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    // Wait for the ACP server's stdio handler to be ready by sending
    // initialize() and retrying on failure (the server may take a moment
    // to fully wire up its message handler after process creation).
    const MAX_INIT_RETRIES = 5;
    let initError: string | undefined;
    for (let attempt = 0; attempt <= MAX_INIT_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          await sleep(500 * attempt);
        }
        await client.initialize({ name: 'trae-plugin-cc', version: '1.0.0' });
        // Successfully initialized — the server is ready.
        this.process = child;
        this.client = client;
        return { client };
      } catch (err: unknown) {
        initError = err instanceof Error ? err.message : String(err);
        if (child.exitCode !== null) {
          // Process exited — won't recover.
          break;
        }
      }
    }

    // All init attempts failed.
    child.stdin?.end();
    child.kill('SIGTERM');
    const diagnostics: string[] = [];
    if (stderrBuffer.trim()) {
      diagnostics.push(`stderr: ${stderrBuffer.trim().split('\n').slice(0, 3).join(' | ')}`);
    }
    throw new Error(
      `ACP server failed to initialize after retries.${initError ? ` Last error: ${initError}` : ''}${diagnostics.length ? '\n' + diagnostics.join('\n') : ''}`,
    );
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
