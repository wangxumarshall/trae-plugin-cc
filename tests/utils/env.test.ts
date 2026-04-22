import { buildSpawnEnv, isInPath } from '../../src/utils/env';

describe('env utilities', () => {
  describe('buildSpawnEnv', () => {
    it('should prepend ~/.local/bin to PATH if not present', () => {
      const originalPath = process.env.PATH;
      process.env.PATH = '/usr/bin:/bin';

      const env = buildSpawnEnv();
      expect(env.PATH).toMatch(/\.local\/bin:/);

      process.env.PATH = originalPath;
    });

    it('should not duplicate ~/.local/bin if already in PATH', () => {
      const originalPath = process.env.PATH;
      const homeBin = `${process.env.HOME || '/Users/test'}/.local/bin`;
      process.env.PATH = `${homeBin}:/usr/bin:/bin`;

      const env = buildSpawnEnv();
      expect(env.PATH).toBe(`${homeBin}:/usr/bin:/bin`);

      process.env.PATH = originalPath;
    });

    it('should handle empty PATH', () => {
      const originalPath = process.env.PATH;
      delete process.env.PATH;

      const env = buildSpawnEnv();
      expect(env.PATH).toMatch(/\.local\/bin/);

      process.env.PATH = originalPath;
    });

    it('should forward TRAECLI_PERSONAL_ACCESS_TOKEN if set', () => {
      const originalToken = process.env.TRAECLI_PERSONAL_ACCESS_TOKEN;
      process.env.TRAECLI_PERSONAL_ACCESS_TOKEN = 'test-token';

      const env = buildSpawnEnv();
      expect(env.TRAECLI_PERSONAL_ACCESS_TOKEN).toBe('test-token');

      process.env.TRAECLI_PERSONAL_ACCESS_TOKEN = originalToken;
    });
  });

  describe('isInPath', () => {
    it('should return true if dir is in PATH', () => {
      const originalPath = process.env.PATH;
      process.env.PATH = '/usr/local/bin:/usr/bin';

      expect(isInPath('/usr/local/bin')).toBe(true);
      expect(isInPath('/not/in/path')).toBe(false);

      process.env.PATH = originalPath;
    });
  });
});
