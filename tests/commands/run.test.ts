import { runTask } from '../../src/commands/run';
import * as utils from '../../src/utils';

jest.mock('../../src/utils');

describe('run command', () => {
    let consoleLogMock: jest.SpyInstance;

    beforeEach(() => {
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
        (utils.runTraeCli as jest.Mock).mockResolvedValue('task result');
        (utils.runTraeCli as jest.Mock).mockClear();
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
    });

    it('should run task synchronously by default', async () => {
        await runTask(['do', 'something']);
        expect(utils.runTraeCli).toHaveBeenCalledWith('do something', false, 'run');
        expect(consoleLogMock).toHaveBeenCalledWith('task result');
    });

    it('should run task in background with --background flag', async () => {
        await runTask(['--background', 'do', 'something']);
        expect(utils.runTraeCli).toHaveBeenCalledWith('do something', true, 'run');
    });

    it('should prompt if no task description is provided', async () => {
        await runTask([]);
        expect(consoleLogMock).toHaveBeenCalledWith('Please provide a task description, e.g., /trae:run "Refactor user module"');
        expect(utils.runTraeCli).not.toHaveBeenCalled();
    });
});
