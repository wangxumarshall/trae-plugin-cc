import { review } from '../../src/commands/review';
import * as utils from '../../src/utils';

jest.mock('../../src/utils');

describe('review command', () => {
    let consoleLogMock: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation();
        (utils.getGitDiff as jest.Mock).mockResolvedValue('test diff');
        (utils.runTraeCli as jest.Mock).mockResolvedValue('review result');
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
    });

    it('should run standard review synchronously by default', async () => {
        await review([]);
        expect(utils.getGitDiff).toHaveBeenCalledWith('main');
        expect(utils.runTraeCli).toHaveBeenCalledWith(expect.stringContaining('请对以下代码变更进行标准的专业代码审查'), false);
        expect(utils.runTraeCli).toHaveBeenCalledWith(expect.stringContaining('test diff'), false);
        expect(consoleLogMock).toHaveBeenCalledWith('review result');
    });

    it('should run adversarial review synchronously if flag is set', async () => {
        await review([], true);
        expect(utils.runTraeCli).toHaveBeenCalledWith(expect.stringContaining('对抗性代码审查员'), false);
    });

    it('should parse --base branch', async () => {
        await review(['--base', 'develop']);
        expect(utils.getGitDiff).toHaveBeenCalledWith('develop');
    });

    it('should parse --background flag', async () => {
        await review(['--background']);
        expect(utils.runTraeCli).toHaveBeenCalledWith(expect.any(String), true);
    });

    it('should return if no diff is found', async () => {
        (utils.getGitDiff as jest.Mock).mockResolvedValue('   ');
        await review([]);
        expect(consoleLogMock).toHaveBeenCalledWith('没有检测到任何代码变更。');
        expect(utils.runTraeCli).not.toHaveBeenCalled();
    });
});
