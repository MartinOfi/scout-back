import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movimiento } from './entities/movimiento.entity';
import { MovimientosService } from './movimientos.service';
import { MovimientosController } from './movimientos.controller';
import { CajasModule } from '../cajas/cajas.module';
import { PersonasModule } from '../personas/personas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Movimiento]),
    forwardRef(() => CajasModule),
    forwardRef(() => PersonasModule),
  ],
  controllers: [MovimientosController],
  providers: [MovimientosService],
  exports: [MovimientosService],
})
export class MovimientosModule {}
