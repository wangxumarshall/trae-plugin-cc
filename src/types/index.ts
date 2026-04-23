// ============================================================
// Core Task & Result Types
// ============================================================

export interface TraeTaskConfig {
  prompt: string;
  background?: boolean;
  jsonOutput?: boolean;
  yolo?: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
  sessionId?: string;
  resume?: string;
  worktree?: string;
  queryTimeout?: string;
  bashToolTimeout?: string;
  configOverrides?: Record<string, string>;
  injectContext?: string;
}

export interface TraeTaskResult {
  taskId: string;
  output: string;
  exitCode: number | null;
  sessionId?: string;
  duration: number;
  jsonOutput?: Record<string, unknown>;
}

// ============================================================
// Session Types
// ============================================================

export type DataSource = 'file' | 'json' | 'acp';

export interface SessionMeta {
  id: string;
  created_at: string;
  updated_at: string;
  metadata: {
    cwd: string;
    model_name: string;
    permission_mode: string;
    title: string;
  };
}

export interface SessionEvent {
  id: string;
  session_id: string;
  branch: string;
  agent_id: string;
  agent_name: string;
  parent_tool_call_id: string;
  created_at: string;
  message?: {
    message: {
      role: string;
      content: string | Array<{ type: string; text: string }>;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: { name: string; arguments: string };
      }>;
    };
  };
  tool_call?: {
    tool_call_id: string;
    tool_info: {
      name: string;
      description: string;
      inputSchema: unknown;
    };
    input: unknown;
    is_programmatic?: boolean;
  };
  tool_call_output?: {
    tool_call_id: string;
    output: unknown;
    is_error?: boolean;
  };
  state_update?: {
    updates: Record<string, unknown>;
  };
  agent_start?: Record<string, unknown>;
}

export interface ConversationMessage {
  role: string;
  content: string;
  toolCalls?: string[];
  timestamp: string;
}

export interface ToolCallRecord {
  id: string;
  name: string;
  input: unknown;
  output?: unknown;
  isError?: boolean;
  timestamp: string;
}

export interface FileTrackStatus {
  [filePath: string]: {
    read_time: string;
    content: string;
  };
}

export interface JsonOutputSession {
  session_id: string;
  messages?: unknown[];
  [key: string]: unknown;
}

// ============================================================
// ACP Types
// ============================================================

export interface AcpInitializeResult {
  protocolVersion: number;
  agentCapabilities: {
    _meta?: Record<string, unknown>;
    loadSession?: boolean;
    promptCapabilities?: Record<string, unknown>;
    mcpCapabilities?: { http: boolean; sse: boolean };
    sessionCapabilities?: Record<string, unknown>;
  };
  agentInfo?: { name: string; title: string; version: string };
  authMethods: unknown[];
  _meta?: Record<string, unknown>;
}

export interface AcpSessionNewResult {
  sessionId: string;
  _meta?: Record<string, unknown>;
  models?: { availableModels: unknown[]; currentModelId: string };
  modes?: { availableModes: unknown[]; currentModeId: string };
}

export interface AcpSessionUpdate {
  sessionId: string;
  update: {
    sessionUpdate: string;
    content?: { type: string; text: string };
    [key: string]: unknown;
  };
}

export interface AcpSessionPromptResult {
  stopReason: string;
  [key: string]: unknown;
}

// ============================================================
// Git & Branch Types
// ============================================================

export interface DiffEstimate {
  baseBranch: string;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  untrackedFiles: string[];
  estimatedTime: 'quick' | 'moderate' | 'lengthy' | 'very_large';
  recommendation: {
    useBackground: boolean;
    reason: string;
  };
}

// ============================================================
// Auth & Config Types
// ============================================================

export interface TraeCliConfig {
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

// ============================================================
// Context & Resume Types
// ============================================================

export interface ResumedPrompt {
  args: string[];
  contextPreview: string;
}

// ============================================================
// Job & Background Task Types
// ============================================================

export interface BackgroundJob {
  id: string;
  timestamp: number;
  status: string;
  logFile: string;
  pidFile: string;
}

// ============================================================
// Logger Types
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  data?: Record<string, unknown>;
}

// ============================================================
// Hook Types
// ============================================================

export type HookType = 'session-start' | 'session-end' | 'stop-gate' | 'post-review';

export interface HookEntry {
  script: string;
  arg: string;
}
