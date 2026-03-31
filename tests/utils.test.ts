import * as utils from '../src/utils';
import * as child_process from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Mock child_process and fs
jest.mock('child_process');
jest.mock('fs');

describe('Utils', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('isTraeCliInstalled', () => {
        it('should return true if which succeeds', async () => {
            (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
                if (cb) cb(null, { stdout: '/usr/local/bin/trae-cli', stderr: '' });
                return { stdout: '/usr/local/bin/trae-cli', stderr: '' };
            });
            const result = await utils.isTraeCliInstalled();
            expect(result).toBe(true);
        });

        it('should return false if which fails', async () => {
            (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
                if (cb) cb(new Error('not found'), { stdout: '', stderr: 'not found' });
                throw new Error('not found');
            });
            const result = await utils.isTraeCliInstalled();
            expect(result).toBe(false);
        });
    });

    describe('getGitDiff', () => {
        it('should return diff successfully', async () => {
             (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
                 if (cb) cb(null, { stdout: 'test diff', stderr: '' });
                 return { stdout: 'test diff', stderr: '' };
             });
             const result = await utils.getGitDiff('main');
             expect(result).toBe('test diff');
             expect(child_process.exec).toHaveBeenCalledWith('git diff main...HEAD', expect.any(Function));
        });

        it('should fallback to plain git diff if base branch diff fails', async () => {
             let callCount = 0;
             (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
                 if (callCount === 0) {
                     callCount++;
                     if (cb) cb(new Error('no branch main'), { stdout: '', stderr: '' });
                     throw new Error('no branch main');
                 } else {
                     if (cb) cb(null, { stdout: 'fallback diff', stderr: '' });
                     return { stdout: 'fallback diff', stderr: '' };
                 }
             });
             const result = await utils.getGitDiff('main');
             expect(result).toBe('fallback diff');
             expect(child_process.exec).toHaveBeenCalledWith('git diff', expect.any(Function));
        });

        it('should return failure message if not in git repo', async () => {
            (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
                if (cb) cb(new Error('fatal: not a git repository'), { stdout: '', stderr: '' });
                throw new Error('fatal: not a git repository');
            });
            const result = await utils.getGitDiff('main');
            expect(result).toBe("无法获取 git diff，可能不在 git 仓库中。");
        });
    });

    describe('runTraeCli', () => {
        const PLUGIN_DIR = path.join(process.cwd(), '.claude-trae-plugin');

        it('should execute synchronously and return output', async () => {
            (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
                if (cb) cb(null, { stdout: 'success output', stderr: '' });
                return { stdout: 'success output', stderr: '' };
            });
            const result = await utils.runTraeCli('test prompt');
            expect(result).toBe('success output');
            expect(child_process.exec).toHaveBeenCalledWith('trae-cli run "test prompt"', expect.any(Function));
        });

        it('should execute synchronously and return stderr if stdout is empty', async () => {
             (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
                 if (cb) cb(null, { stdout: '', stderr: 'stderr output' });
                 return { stdout: '', stderr: 'stderr output' };
             });
             const result = await utils.runTraeCli('test prompt');
             expect(result).toBe('stderr output');
         });

         it('should throw error on synchronous failure', async () => {
             (child_process.exec as unknown as jest.Mock).mockImplementation((cmd, cb) => {
                 if (cb) cb(new Error('exec fail'), { stdout: '', stderr: 'stderr fail' });
                 throw Object.assign(new Error('exec fail'), { stdout: '', stderr: 'stderr fail' });
             });
             await expect(utils.runTraeCli('test prompt')).rejects.toThrow('执行失败: exec fail');
         });

        it('should start in background when background=true', async () => {
            const mockDate = 1000;
            jest.spyOn(Date, 'now').mockReturnValue(mockDate);

            (fs.existsSync as jest.Mock).mockReturnValue(false);
            (fs.openSync as jest.Mock).mockReturnValue(1);

            const unrefMock = jest.fn();
            (child_process.spawn as jest.Mock).mockReturnValue({
                pid: 1234,
                unref: unrefMock
            });

            const result = await utils.runTraeCli('test prompt', true);

            expect(fs.mkdirSync).toHaveBeenCalledWith(PLUGIN_DIR, { recursive: true });
            expect(fs.openSync).toHaveBeenCalledWith(path.join(PLUGIN_DIR, `${mockDate}.log`), 'a');
            expect(child_process.spawn).toHaveBeenCalledWith('trae-cli', ['run', 'test prompt'], {
                detached: true,
                stdio: ['ignore', 1, 1]
            });
            expect(unrefMock).toHaveBeenCalled();
            expect(fs.writeFileSync).toHaveBeenCalledWith(path.join(PLUGIN_DIR, `${mockDate}.pid`), '1234');
            expect(result).toContain(`任务已在后台启动 (ID: ${mockDate})`);
        });
    });
});
