import { Module } from '@nestjs/common';

import { BackupsController } from './backups.controller';
import { BackupsService } from './services/backups.service';
import { SqlDataExportService } from './services/sql-data-export.service';

@Module({
  controllers: [BackupsController],
  providers: [BackupsService, SqlDataExportService],
  exports: [BackupsService],
})
export class BackupsModule {}
