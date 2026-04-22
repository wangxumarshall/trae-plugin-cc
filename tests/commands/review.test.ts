import { review } from '../../src/commands/review';
import * as utils from '../../src/utils';
import { detectBaseBranch, estimateReviewSize } from '../../src/utils/branch-detection';
import * as traeExecutorModule from '../../src/utils/trae-executor';

jest.mock('../../src/utils');
jest.mock('../../src/utils/branch-detection');
jest.mock('../../src/utils/trae-executor');

describe('review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  afterAll(() => {
    (process.exit as unknown as jest.Mock).mockRestore?.();
  });

  it('should return early when no diff', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('main');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'main',
      linesAdded: 0, linesDeleted: 0, filesChanged: 0, untrackedFiles: [], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('');

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review([]);

    expect(utils.getGitDiff).toHaveBeenCalledWith('main');
    expect(consoleSpy).toHaveBeenCalledWith('没有检测到任何代码变更。');
    consoleSpy.mockRestore();
  });

  it('should parse --base flag and skip auto-detect', async () => {
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'develop',
      linesAdded: 10, linesDeleted: 5, filesChanged: 2, untrackedFiles: [], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('');

    await review(['--base', 'develop']);

    expect(detectBaseBranch).not.toHaveBeenCalled();
    expect(utils.getGitDiff).toHaveBeenCalledWith('develop');
  });

  it('should auto-detect base branch when --base not provided', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('develop');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'develop',
      linesAdded: 10, linesDeleted: 5, filesChanged: 2, untrackedFiles: [], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('');

    await review([]);

    expect(detectBaseBranch).toHaveBeenCalled();
  });

  it('should auto-enable background for large changes', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('main');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: true }, baseBranch: 'main',
      linesAdded: 600, linesDeleted: 400, filesChanged: 20, untrackedFiles: [], estimatedTime: 'lengthy',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('@@ diff @@');

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review([]);

    expect(consoleSpy).toHaveBeenCalledWith('💡 自动启用后台模式 (使用 --background 覆盖)');
    consoleSpy.mockRestore();
  });

  it('should estimate review size and display formatted output', async () => {
    (detectBaseBranch as jest.Mock).mockResolvedValue('main');
    (estimateReviewSize as jest.Mock).mockResolvedValue({
      recommendation: { useBackground: false }, baseBranch: 'main',
      linesAdded: 50, linesDeleted: 30, filesChanged: 5, untrackedFiles: ['new.ts'], estimatedTime: 'quick',
    });
    (utils.getGitDiff as jest.Mock).mockResolvedValue('@@ diff @@');
    jest.spyOn(traeExecutorModule, 'TraeExecutor').mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ taskId: '1', output: 'review', exitCode: 0, duration: 100 }),
    }) as any);

    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    await review([]);

    expect(estimateReviewSize).toHaveBeenCalledWith('main');
    consoleSpy.mockRestore();
  });
});
