import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import { AcpClient } from '../utils/acp-client';

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

      const child = spawn('trae-cli', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let started = false;

      const detectPort = (text: string) => {
        const portMatch = text.match(/listening.*?:(\d+)/i) ||
                          text.match(/port.*?(\d+)/i) ||
                          text.match(/http:\/\/localhost:(\d+)/i) ||
                          text.match(/:(\d{4,5})/);
        if (portMatch && !started) {
          started = true;
          this.port = parseInt(portMatch[1], 10);
          this.process = child;
          this.client = new AcpClient(`http://localhost:${this.port}`);
          resolve({
            port: this.port,
            baseUrl: `http://localhost:${this.port}`,
          });
        }
      };

      child.stdout?.on('data', (chunk: Buffer) => detectPort(chunk.toString()));
      child.stderr?.on('data', (chunk: Buffer) => detectPort(chunk.toString()));

      child.on('error', (err) => {
        if (!started) reject(err);
      });

      child.on('close', (code) => {
        this.process = null;
        if (!started) reject(new Error(`ACP server exited with code ${code}`));
      });

      setTimeout(() => {
        if (!started) {
          child.kill('SIGTERM');
          reject(new Error('ACP server startup timeout (15s)'));
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
