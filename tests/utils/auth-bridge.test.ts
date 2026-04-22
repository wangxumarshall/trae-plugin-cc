import { AuthBridge } from '../../src/utils/auth-bridge';
import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';

jest.mock('fs');
jest.mock('js-yaml');
jest.mock('child_process');

describe('AuthBridge', () => {
  let bridge: AuthBridge;

  beforeEach(() => {
    jest.clearAllMocks();
    bridge = new AuthBridge();
  });

  describe('loadConfig', () => {
    it('should return null if config file does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(bridge.loadConfig()).toBeNull();
    });

    it('should parse and cache YAML config', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('model:\n  name: claude-sonnet');
      (yaml.load as jest.Mock).mockReturnValue({ model: { name: 'claude-sonnet' } });

      const config = bridge.loadConfig();
      expect(config).toEqual({ model: { name: 'claude-sonnet' } });
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);

      // Should return cached value
      bridge.loadConfig();
      expect(fs.readFileSync).toHaveBeenCalledTimes(1);
    });

    it('should return null on parse error', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('invalid: yaml: :');
      (yaml.load as jest.Mock).mockImplementation(() => { throw new Error('bad yaml'); });

      expect(bridge.loadConfig()).toBeNull();
    });
  });

  describe('getters', () => {
    it('should return default login URL when not configured', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      expect(bridge.getLoginBaseUrl()).toBe('https://console.enterprise.trae.cn');
    });

    it('should return model name from config', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('model:\n  name: claude-3.5');
      (yaml.load as jest.Mock).mockReturnValue({ model: { name: 'claude-3.5' } });

      expect(bridge.getModelName()).toBe('claude-3.5');
    });

    it('should return allowed tools from config', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('allowed_tools:\n  - Read\n  - Edit');
      (yaml.load as jest.Mock).mockReturnValue({ allowed_tools: ['Read', 'Edit'] });

      expect(bridge.getAllowedTools()).toEqual(['Read', 'Edit']);
    });

    it('should return plugins from config', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readFileSync as jest.Mock).mockReturnValue('plugins:\n  - name: test');
      (yaml.load as jest.Mock).mockReturnValue({ plugins: [{ name: 'test', type: 't', source: 's', enabled: true }] });

      expect(bridge.getPlugins()).toEqual([{ name: 'test', type: 't', source: 's', enabled: true }]);
    });
  });
});
