import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caja } from './entities/caja.entity';
import { CajasService } from './cajas.service';
import { CajasController } from './cajas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Caja])],
  controllers: [CajasController],
  providers: [CajasService],
  exports: [CajasService],
})
export class CajasModule {}
