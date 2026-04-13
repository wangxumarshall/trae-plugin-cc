import { setup } from '../../src/commands/setup';
import * as utils from '../../src/utils';
import * as authBridge from '../../src/utils/auth-bridge';

jest.mock('../../src/utils');
jest.mock('../../src/utils/auth-bridge');

describe('setup command', () => {
    let consoleLogMock: jest.SpyInstance;

    beforeEach(() => {
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation();
        (authBridge.AuthBridge as jest.Mock).mockImplementation(() => ({
            checkAuthStatus: jest.fn().mockResolvedValue({
                authenticated: true,
                model: 'GLM-5',
                loginUrl: 'https://console.enterprise.trae.cn',
                configPath: '/home/.trae/trae_cli.yaml',
                configExists: true,
            }),
            getAllowedTools: jest.fn().mockReturnValue(['Edit', 'Write']),
            getPlugins: jest.fn().mockReturnValue([]),
        }));
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
    });

    it('should log success if trae-cli is installed', async () => {
        (utils.isTraeCliInstalled as jest.Mock).mockResolvedValue(true);
        await setup([]);
        expect(consoleLogMock).toHaveBeenCalledWith('✅ trae-cli 已安装并可用！\n');
    });

    it('should log installation instructions if trae-cli is not installed', async () => {
        (utils.isTraeCliInstalled as jest.Mock).mockResolvedValue(false);
        await setup([]);
        expect(consoleLogMock).toHaveBeenCalledWith('❌ trae-cli 未安装或未在 PATH 中找到。');
    });
});
