import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cuota } from './entities/cuota.entity';
import { CuotasService } from './cuotas.service';
import { CuotasController } from './cuotas.controller';
import { PersonasModule } from '../personas/personas.module';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cuota]),
    forwardRef(() => PersonasModule),
    forwardRef(() => CajasModule),
    forwardRef(() => MovimientosModule),
  ],
  controllers: [CuotasController],
  providers: [CuotasService],
  exports: [CuotasService],
})
export class CuotasModule {}
