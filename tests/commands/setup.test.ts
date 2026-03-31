import { setup } from '../../src/commands/setup';
import * as utils from '../../src/utils';

jest.mock('../../src/utils');

describe('setup command', () => {
    let consoleLogMock: jest.SpyInstance;

    beforeEach(() => {
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation();
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
    });

    it('should log success if trae-cli is installed', async () => {
        (utils.isTraeCliInstalled as jest.Mock).mockResolvedValue(true);
        await setup([]);
        expect(consoleLogMock).toHaveBeenCalledWith('✅ trae-cli 已安装并可用！');
    });

    it('should log installation instructions if trae-cli is not installed', async () => {
        (utils.isTraeCliInstalled as jest.Mock).mockResolvedValue(false);
        await setup([]);
        expect(consoleLogMock).toHaveBeenCalledWith('❌ trae-cli 未安装或未在 PATH 中找到。');
        expect(consoleLogMock).toHaveBeenCalledWith('\n请按照以下步骤安装：');
    });
});
