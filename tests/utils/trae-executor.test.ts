import { TraeExecutor } from '../../src/utils/trae-executor';
import { spawn } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  openSync: jest.fn().mockReturnValue(3),
  writeFileSync: jest.fn(),
  appendFileSync: jest.fn(),
  unlinkSync: jest.fn(),
}));

describe('TraeExecutor', () => {
  let executor: TraeExecutor;

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new TraeExecutor();
  });

  describe('execute foreground', () => {
    it('should spawn process with --print and prompt', async () => {
      const mockChild = {
        on: jest.fn((event: string, cb: Function) => { if (event === 'close') setTimeout(() => cb(0), 0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'test task' });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--print', 'test task']),
        expect.any(Object)
      );
    });

    it('should build args with --yolo', async () => {
      const mockChild = {
        on: jest.fn((event: string, cb: Function) => { if (event === 'close') setTimeout(() => cb(0), 0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'test', yolo: true });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--yolo', '--print', 'test']),
        expect.any(Object)
      );
    });

    it('should build args with --json', async () => {
      const mockChild = {
        on: jest.fn((event: string, cb: Function) => { if (event === 'close') setTimeout(() => cb(0), 0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'test', jsonOutput: true });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--print', '--json', 'test']),
        expect.any(Object)
      );
    });

    it('should build args with --resume', async () => {
      const mockChild = {
        on: jest.fn((event: string, cb: Function) => { if (event === 'close') setTimeout(() => cb(0), 0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'continue', resume: 'session-123' });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--resume', 'session-123', '--print', 'continue']),
        expect.any(Object)
      );
    });

    it('should build args with --worktree', async () => {
      const mockChild = {
        on: jest.fn((event: string, cb: Function) => { if (event === 'close') setTimeout(() => cb(0), 0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({ prompt: 'test', worktree: '__auto__' });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining(['--worktree', '--print', 'test']),
        expect.any(Object)
      );
    });

    it('should build args with allowed/disallowed tools', async () => {
      const mockChild = {
        on: jest.fn((event: string, cb: Function) => { if (event === 'close') setTimeout(() => cb(0), 0); }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await executor.execute({
        prompt: 'test',
        allowedTools: ['Read', 'Edit'],
        disallowedTools: ['Bash'],
      });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.arrayContaining([
          '--allowed-tool', 'Read',
          '--allowed-tool', 'Edit',
          '--disallowed-tool', 'Bash',
          '--print', 'test',
        ]),
        expect.any(Object)
      );
    });

    it('should handle child process error', async () => {
      const mockChild = {
        on: jest.fn((event: string, cb: Function) => {
          if (event === 'error') setTimeout(() => cb(new Error('spawn failed')), 0);
        }),
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        pid: 12345,
        kill: jest.fn(),
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      await expect(executor.execute({ prompt: 'test' })).rejects.toThrow('执行失败: spawn failed');
    });
  });

  describe('execute background', () => {
    it('should spawn detached process for background tasks', async () => {
      const mockChild = {
        on: jest.fn(),
        unref: jest.fn(),
        stdout: null,
        stderr: null,
        pid: 12345,
      };
      (spawn as jest.Mock).mockReturnValue(mockChild);

      const result = await executor.execute({ prompt: 'bg task', background: true });

      expect(spawn).toHaveBeenCalledWith(
        'trae-cli',
        expect.any(Array),
        expect.objectContaining({ detached: true })
      );
      expect(mockChild.unref).toHaveBeenCalled();
      expect(result.taskId).toBeDefined();
      expect(result.output).toContain('后台');
    });
  });
});
