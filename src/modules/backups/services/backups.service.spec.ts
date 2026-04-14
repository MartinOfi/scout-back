import { Test, TestingModule } from '@nestjs/testing';
import { gunzipSync } from 'zlib';

import { BackupsService } from './backups.service';
import { SqlDataExportService } from './sql-data-export.service';

describe('BackupsService', () => {
  let service: BackupsService;
  let sqlDataExportService: { generateDump: jest.Mock };

  beforeEach(async () => {
    sqlDataExportService = { generateDump: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackupsService,
        { provide: SqlDataExportService, useValue: sqlDataExportService },
      ],
    }).compile();

    service = module.get(BackupsService);
  });

  describe('generateFilename', () => {
    it('builds a timestamped filename with .sql.gz extension', () => {
      const fixed = new Date(Date.UTC(2026, 3, 14, 9, 5, 3));
      expect(service.generateFilename(fixed)).toMatch(
        /^scout-backup-\d{8}-\d{6}\.sql\.gz$/,
      );
    });

    it('pads month, day, hours, minutes and seconds to two digits', () => {
      const fixed = new Date(2026, 0, 2, 3, 4, 5);
      expect(service.generateFilename(fixed)).toBe(
        'scout-backup-20260102-030405.sql.gz',
      );
    });
  });

  describe('generateBackup', () => {
    it('returns a gzipped buffer of the SQL dump', async () => {
      const dump =
        '-- Scout database data export\nBEGIN;\nINSERT INTO "personas" VALUES (1);\nCOMMIT;\n';
      sqlDataExportService.generateDump.mockResolvedValue(dump);

      const buffer = await service.generateBackup();

      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(0);

      const decompressed = gunzipSync(buffer).toString('utf8');
      expect(decompressed).toBe(dump);
    });

    it('delegates dump generation to SqlDataExportService exactly once', async () => {
      sqlDataExportService.generateDump.mockResolvedValue('-- empty');
      await service.generateBackup();
      expect(sqlDataExportService.generateDump).toHaveBeenCalledTimes(1);
    });
  });
});
