import { gzipSync } from 'zlib';

import { Injectable } from '@nestjs/common';

import { SqlDataExportService } from './sql-data-export.service';

@Injectable()
export class BackupsService {
  constructor(private readonly sqlDataExportService: SqlDataExportService) {}

  generateFilename(now: Date = new Date()): string {
    const pad = (n: number): string => n.toString().padStart(2, '0');
    const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
    const timePart = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `scout-backup-${datePart}-${timePart}.sql.gz`;
  }

  async generateBackup(): Promise<Buffer> {
    const sql = await this.sqlDataExportService.generateDump();
    return gzipSync(Buffer.from(sql, 'utf8'));
  }
}
