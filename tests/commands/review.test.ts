import { review } from '../../src/commands/review';
import * as utils from '../../src/utils';
import * as traeExecutor from '../../src/utils/trae-executor';
import * as branchDetection from '../../src/utils/branch-detection';

jest.mock('../../src/utils');
jest.mock('../../src/utils/trae-executor');
jest.mock('../../src/utils/branch-detection');

describe('review command', () => {
    let consoleLogMock: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation();
        (utils.getGitDiff as jest.Mock).mockResolvedValue('test diff');
        (traeExecutor.TraeExecutor as jest.Mock).mockImplementation(() => ({
            execute: jest.fn().mockResolvedValue({
                taskId: '123456',
                output: 'review result',
                exitCode: 0,
                sessionId: 'test-session-id',
                duration: 1000,
            }),
        }));
        (branchDetection.detectBaseBranch as jest.Mock).mockResolvedValue('main');
        (branchDetection.estimateReviewSize as jest.Mock).mockResolvedValue({
            lineCount: 100,
            fileCount: 5,
            recommendation: { useBackground: false },
        });
        (branchDetection.formatEstimate as jest.Mock).mockReturnValue('100 lines, 5 files');
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
    });

    it('should run standard review', async () => {
        await review([]);
        expect(utils.getGitDiff).toHaveBeenCalledWith('main');
    });

    it('should parse --base branch', async () => {
        await review(['--base', 'develop']);
        expect(utils.getGitDiff).toHaveBeenCalledWith('develop');
    });

    it('should return if no diff is found', async () => {
        (utils.getGitDiff as jest.Mock).mockResolvedValue('   ');
        await review([]);
        expect(consoleLogMock).toHaveBeenCalledWith('没有检测到任何代码变更。');
    });
});
