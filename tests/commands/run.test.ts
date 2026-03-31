import { runTask } from '../../src/commands/run';
import * as utils from '../../src/utils';

jest.mock('../../src/utils');

describe('run command', () => {
    let consoleLogMock: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation();
        (utils.runTraeCli as jest.Mock).mockResolvedValue('task result');
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
    });

    it('should run task synchronously by default', async () => {
        await runTask(['do', 'something']);
        expect(utils.runTraeCli).toHaveBeenCalledWith('do something', false);
        expect(consoleLogMock).toHaveBeenCalledWith('task result');
    });

    it('should run task in background with --background flag', async () => {
        await runTask(['--background', 'do', 'something']);
        expect(utils.runTraeCli).toHaveBeenCalledWith('do something', true);
    });

    it('should prompt if no task description is provided', async () => {
        await runTask([]);
        expect(consoleLogMock).toHaveBeenCalledWith('请提供要执行的任务描述，例如: /trae:run "重构用户模块"');
        expect(utils.runTraeCli).not.toHaveBeenCalled();
    });
});
