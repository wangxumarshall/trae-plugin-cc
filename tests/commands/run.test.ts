import { runTask } from '../../src/commands/run';
import * as traeExecutor from '../../src/utils/trae-executor';

jest.mock('../../src/utils/trae-executor');

describe('run command', () => {
    let consoleLogMock: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation();
        (traeExecutor.TraeExecutor as jest.Mock).mockImplementation(() => ({
            execute: jest.fn().mockResolvedValue({
                taskId: '123456',
                output: 'task result',
                exitCode: 0,
                sessionId: 'test-session-id',
                duration: 1000,
            }),
        }));
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
    });

    it('should run task with prompt', async () => {
        await runTask(['do', 'something']);
        expect(consoleLogMock).toHaveBeenCalledWith('正将任务委托给 Trae Agent...');
    });

    it('should prompt if no task description is provided', async () => {
        await runTask([]);
        expect(consoleLogMock).toHaveBeenCalledWith(expect.stringContaining('请提供要执行的任务描述'));
    });
});
