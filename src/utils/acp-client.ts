import * as http from 'http';

export interface AcpRunRequest {
  agent_name: string;
  input: Array<{
    role: string;
    parts: Array<{
      content: string;
      content_type: string;
    }>;
  }>;
  session_id?: string;
}

export interface AcpRunResponse {
  run_id: string;
  agent_name: string;
  session_id: string;
  status: string;
  output: Array<{
    role: string;
    parts: Array<{
      content: string;
      content_type: string;
    }>;
  }>;
  error: string | null;
}

export interface AcpAgentInfo {
  name: string;
  description: string;
  metadata?: Record<string, any>;
}

export class AcpClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  async discoverAgents(): Promise<AcpAgentInfo[]> {
    try {
      const result = await this.request('GET', '/agents');
      return result.agents || [];
    } catch {
      return [];
    }
  }

  async runAgent(req: AcpRunRequest): Promise<AcpRunResponse> {
    return this.request('POST', '/runs', req);
  }

  async getRun(runId: string): Promise<AcpRunResponse> {
    return this.request('GET', `/runs/${runId}`);
  }

  async runStream(
    req: AcpRunRequest,
    onEvent: (event: any) => void
  ): Promise<void> {
    const url = new URL('/runs/stream', this.baseUrl);
    const payload = JSON.stringify(req);

    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const httpReq = http.request(options, (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                onEvent(JSON.parse(line.substring(6)));
              } catch {}
            }
          }
        });
        res.on('end', resolve);
        res.on('error', reject);
      });

      httpReq.on('error', reject);
      httpReq.write(payload);
      httpReq.end();
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.request('GET', '/agents');
      return true;
    } catch {
      return false;
    }
  }

  private request(method: string, urlPath: string, body?: any): Promise<any> {
    const url = new URL(urlPath, this.baseUrl);

    return new Promise((resolve, reject) => {
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: {},
      };

      if (body) {
        const payload = JSON.stringify(body);
        options.headers = {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        };
      }

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { resolve(data); }
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }
}
