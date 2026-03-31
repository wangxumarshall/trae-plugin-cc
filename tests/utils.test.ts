import * as utils from '../src/utils';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';
import * as jobs from '../src/commands/jobs';
import * as util from 'util';

jest.mock('fs');
jest.mock('path');
jest.mock('child_process', () => ({
    exec: jest.fn(),
    spawn: jest.fn()
}));
jest.mock('util', () => {
    const originalUtil = jest.requireActual('util');
    return {
        ...originalUtil,
        promisify: jest.fn((fn) => fn)
    };
});
jest.mock('../src/commands/jobs', () => ({
    ensureStateDir: jest.fn(),
    saveJob: jest.fn(),
    JobState: {}
}));

describe('Utils', () => {
    let mockDate: number;

    beforeEach(() => {
        jest.clearAllMocks();
        mockDate = 1633022000000;
        jest.spyOn(Date, 'now').mockReturnValue(mockDate);
        (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
        (process.cwd as jest.Mock) = jest.fn().mockReturnValue('/app');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getGitDiff', () => {
        it('should execute git diff baseBranch...HEAD', async () => {
            (child_process.exec as unknown as jest.Mock).mockResolvedValue({ stdout: 'mock stdout', stderr: '' });
            const result = await utils.getGitDiff('develop');
            expect(child_process.exec).toHaveBeenCalledWith('git diff develop...HEAD');
            expect(result).toBe('mock stdout');
        });

        it('should fallback to git diff on error', async () => {
            (child_process.exec as unknown as jest.Mock).mockRejectedValueOnce(new Error('fail'));
            (child_process.exec as unknown as jest.Mock).mockResolvedValueOnce({ stdout: 'mock stdout', stderr: '' });

            const result = await utils.getGitDiff('main');
            expect(child_process.exec).toHaveBeenCalledWith('git diff');
            expect(result).toBe('mock stdout');
        });

        it('should return failure message if not in git repo', async () => {
             (child_process.exec as unknown as jest.Mock).mockRejectedValue(new Error('fail'));
            const result = await utils.getGitDiff('main');
            expect(result).toBe("Cannot get git diff. You may not be in a git repository.");
        });
    });

    describe('runTraeCli', () => {
        it('should execute synchronously and return output', async () => {
            (child_process.exec as unknown as jest.Mock).mockResolvedValue({ stdout: 'mock stdout', stderr: '' });
            const result = await utils.runTraeCli('test prompt');
            expect(child_process.exec).toHaveBeenCalledWith(
                'trae-cli run "test prompt"',
                expect.objectContaining({ maxBuffer: 1024 * 1024 * 50 })
            );
            expect(result).toBe('mock stdout');
        });

        it('should start in background when background=true', async () => {
            const mockChild = {
                unref: jest.fn(),
                pid: 1234
            };
            (child_process.spawn as jest.Mock).mockReturnValue(mockChild);
            (fs.openSync as jest.Mock).mockReturnValue(99);

            const result = await utils.runTraeCli('test prompt', true);

            expect(jobs.ensureStateDir).toHaveBeenCalled();
            expect(child_process.spawn).toHaveBeenCalledWith('bash', ['-c', 'trae-cli run "test prompt"'], {
                detached: true,
                stdio: ['ignore', 99, 99]
            });
            expect(mockChild.unref).toHaveBeenCalled();
            expect(jobs.saveJob).toHaveBeenCalledWith(expect.objectContaining({ id: '1633022000000', status: 'running' }));
            expect(result).toContain('Job started in background');
        });
    });
});
