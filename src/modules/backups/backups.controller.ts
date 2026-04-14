import { Controller, Get, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiTags, ApiProduces } from '@nestjs/swagger';
import type { Response } from 'express';

import { BackupsService } from './services/backups.service';

@ApiTags('backups')
@Controller('backups')
export class BackupsController {
  private readonly logger = new Logger(BackupsController.name);

  constructor(private readonly backupsService: BackupsService) { }

  @Get('download')
  @ApiOperation({
    summary: 'Descarga un backup de datos de la base (SQL + gzip)',
    description:
      'Genera un dump SQL con INSERTs de todas las tablas (sin schema) y lo ' +
      'comprime con gzip. El archivo resultante puede restaurarse con ' +
      '`gunzip` + `psql` en una base destino que ya tenga el schema creado.',
  })
  @ApiProduces('application/gzip')
  async download(@Res() res: Response): Promise<void> {
    try {
      const buffer = await this.backupsService.generateBackup();
      const filename = this.backupsService.generateFilename();

      res.setHeader('Content-Type', 'application/gzip');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', buffer.length.toString());
      res.end(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Backup generation failed: ${message}`);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to generate backup' });
      }
    }
  }
}
