import * as jobs from '../../src/commands/jobs';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('jobs commands', () => {
    let consoleLogMock: jest.SpyInstance;
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation();
        consoleErrorMock = jest.spyOn(console, 'error').mockImplementation();
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
        consoleErrorMock.mockRestore();
    });

    describe('getJobs', () => {
        it('should return empty array if plugin dir does not exist', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            const result = jobs.getJobs();
            expect(result).toEqual([]);
        });

        it('should return job list and verify status correctly', () => {
            (fs.existsSync as jest.Mock).mockImplementation((file) => {
                if (typeof file === 'string' && file.includes('.claude-trae-plugin')) return true;
                return false;
            });
            (fs.readdirSync as jest.Mock).mockReturnValue(['1234.pid', '1234.log', '5678.pid', '9012.log']);

            // mock process.kill for running check
            const killSpy = jest.spyOn(process, 'kill').mockImplementation((pid, signal) => {
                if (pid === 1234) return true; // Running
                if (pid === 5678) {
                    const e = new Error('ESRCH') as any; e.code = 'ESRCH'; throw e; // Stopped
                }
                throw new Error('Unknown');
            });

            (fs.readFileSync as jest.Mock).mockImplementation((file) => {
                if (file.includes('1234.pid')) return '1234';
                if (file.includes('5678.pid')) return '5678';
                return '';
            });

            const result = jobs.getJobs();
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual(expect.objectContaining({ id: '1234', status: '运行中' }));
            expect(result[1]).toEqual(expect.objectContaining({ id: '5678', status: '已完成或已中止' }));

            killSpy.mockRestore();
        });
    });

    describe('status', () => {
        it('should log empty message if no jobs', () => {
            // Because getJobs is in the same module and not exported in a way jest.spyOn can cleanly intercept without babel-plugin-rewire or changing export style, we mock the fs calls that getJobs relies on
            (fs.existsSync as jest.Mock).mockReturnValue(false);

            jobs.status([]);
            expect(consoleLogMock).toHaveBeenCalledWith('当前没有运行或记录的后台任务。');
        });

        it('should log jobs status', () => {
            (fs.existsSync as jest.Mock).mockImplementation((file) => {
                if (typeof file === 'string' && file.includes('.claude-trae-plugin')) return true;
                return false;
            });
            (fs.readdirSync as jest.Mock).mockReturnValue(['123.pid']);
            (fs.readFileSync as jest.Mock).mockReturnValue('123');
            const killSpy = jest.spyOn(process, 'kill').mockImplementation((pid, signal) => {
                 return true;
            });

            jobs.status([]);
            expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('[ID: 123]'));
            expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('状态: 运行中'));
            killSpy.mockRestore();
        });
    });

    describe('result', () => {
        it('should prompt for id if none provided', () => {
            jobs.result([]);
            expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('请提供任务 ID'));
        });

        it('should warn if log file not found', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            jobs.result(['123']);
            expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('找不到 ID 为 123 的日志文件'));
        });

        it('should read and log content', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('log content');
            jobs.result(['123']);
            expect(consoleLogMock).toHaveBeenCalledWith('log content');
        });
    });

    describe('cancel', () => {
        it('should prompt for id if none provided', () => {
            jobs.cancel([]);
            expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('请提供要取消的任务 ID'));
        });

        it('should warn if pid file not found', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            jobs.cancel(['123']);
            expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('找不到 ID 为 123 的任务记录'));
        });

        it('should kill process and unlink file', () => {
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            (fs.readFileSync as jest.Mock).mockReturnValue('9999');
            const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);

            jobs.cancel(['123']);
            expect(killSpy).toHaveBeenCalledWith(9999, 'SIGKILL');
            expect(fs.unlinkSync).toHaveBeenCalled();
            expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('已发送强制终止信号'));

            killSpy.mockRestore();
        });
    });
});
