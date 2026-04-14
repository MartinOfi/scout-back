import { Controller, Get, Logger, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { ExportsService } from './services/exports.service';

const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

@ApiTags('exports')
@Controller('exports')
export class ExportsController {
  private readonly logger = new Logger(ExportsController.name);

  constructor(private readonly exportsService: ExportsService) {}

  @Get('xlsx')
  @ApiOperation({
    summary: 'Exporta toda la base de datos a un archivo Excel (.xlsx)',
    description:
      'Devuelve un libro Excel con una hoja por tabla, con datos enriquecidos ' +
      '(nombres resueltos en lugar de UUIDs cuando es posible).',
  })
  @ApiProduces(XLSX_MIME)
  async download(@Res() res: Response): Promise<void> {
    try {
      const buffer = await this.exportsService.generateXlsx();
      const filename = this.exportsService.generateFilename();

      res.setHeader('Content-Type', XLSX_MIME);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${filename}"`,
      );
      res.setHeader('Content-Length', buffer.length.toString());
      res.end(buffer);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Failed to generate xlsx export: ${message}`);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to generate export' });
      }
    }
  }
}
