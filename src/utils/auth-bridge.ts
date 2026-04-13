import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

interface TraeCliConfig {
  model?: { name: string };
  allowed_tools?: string[];
  plugins?: Array<{ name: string; type: string; source: string; enabled: boolean }>;
  trae_login_base_url?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  model: string;
  loginUrl: string;
  configPath: string;
  configExists: boolean;
}

export class AuthBridge {
  private configPath: string;
  private config: TraeCliConfig | null = null;

  constructor() {
    this.configPath = path.join(
      os.homedir(),
      '.trae',
      'trae_cli.yaml'
    );
  }

  loadConfig(): TraeCliConfig | null {
    if (this.config) return this.config;

    if (fs.existsSync(this.configPath)) {
      try {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        this.config = yaml.load(content) as TraeCliConfig;
        return this.config;
      } catch {
        return null;
      }
    }
    return null;
  }

  async checkAuthStatus(): Promise<AuthStatus> {
    const config = this.loadConfig();
    let authenticated = false;

    try {
      execSync('trae-cli config edit --help', { stdio: 'ignore' });
      authenticated = true;
    } catch {
      authenticated = config !== null;
    }

    return {
      authenticated,
      model: config?.model?.name || 'unknown',
      loginUrl: config?.trae_login_base_url || 'https://console.enterprise.trae.cn',
      configPath: this.configPath,
      configExists: fs.existsSync(this.configPath),
    };
  }

  getLoginBaseUrl(): string {
    if (!this.config) this.loadConfig();
    return this.config?.trae_login_base_url || 'https://console.enterprise.trae.cn';
  }

  getModelName(): string {
    if (!this.config) this.loadConfig();
    return this.config?.model?.name || 'unknown';
  }

  getAllowedTools(): string[] {
    if (!this.config) this.loadConfig();
    return this.config?.allowed_tools || [];
  }

  getPlugins(): Array<{ name: string; type: string; source: string; enabled: boolean }> {
    if (!this.config) this.loadConfig();
    return this.config?.plugins || [];
  }

  buildSpawnEnv(): NodeJS.ProcessEnv {
    return { ...process.env };
  }
}
