import { review } from '../../src/commands/review';
import * as utils from '../../src/utils';

jest.mock('../../src/utils');

describe('review command', () => {
    let consoleLogMock: jest.SpyInstance;

    beforeEach(() => {
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
        (utils.getGitDiff as jest.Mock).mockResolvedValue('test diff');
        (utils.runTraeCli as jest.Mock).mockResolvedValue('review result');
        (utils.runTraeCli as jest.Mock).mockClear();
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
    });

    it('should run standard review synchronously by default', async () => {
        await review([]);
        expect(utils.getGitDiff).toHaveBeenCalledWith('main');
        expect(utils.runTraeCli).toHaveBeenCalledWith(expect.stringContaining('standard, professional code review'), false, 'review');
        expect(consoleLogMock).toHaveBeenCalledWith('review result');
    });

    it('should run adversarial review synchronously if flag is set', async () => {
        await review([], true);
        expect(utils.runTraeCli).toHaveBeenCalledWith(expect.stringContaining('adversarial code reviewer'), false, 'adversarial-review');
    });

    it('should parse --base branch', async () => {
        await review(['--base', 'develop']);
        expect(utils.getGitDiff).toHaveBeenCalledWith('develop');
    });

    it('should parse --background flag', async () => {
        await review(['--background']);
        expect(utils.runTraeCli).toHaveBeenCalledWith(expect.any(String), true, 'review');
    });

    it('should return if no diff is found', async () => {
        (utils.getGitDiff as jest.Mock).mockResolvedValue('   ');
        await review([]);
        expect(consoleLogMock).toHaveBeenCalledWith('No code changes detected or not a git repository.');
        expect(utils.runTraeCli).not.toHaveBeenCalled();
    });
});
