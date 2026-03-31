import * as jobs from '../../src/commands/jobs';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');
jest.mock('path');

describe('jobs module', () => {
    let consoleLogMock: jest.SpyInstance;
    let consoleErrorMock: jest.SpyInstance;

    beforeEach(() => {
        consoleLogMock = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorMock = jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.clearAllMocks();

        (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
        (process.cwd as jest.Mock) = jest.fn().mockReturnValue('/app');
    });

    afterEach(() => {
        consoleLogMock.mockRestore();
        consoleErrorMock.mockRestore();
    });

    it('should list jobs', () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readdirSync as jest.Mock).mockReturnValue(['123.json']);
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
            id: '123', status: 'completed', type: 'run', createdAt: 123
        }));

        const result = jobs.listJobs();
        expect(result.length).toBe(1);
        expect(result[0].id).toBe('123');
    });
});
