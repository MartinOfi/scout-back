import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Caja } from './entities/caja.entity';
import { CajasService } from './cajas.service';
import { CajasController } from './cajas.controller';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { InscripcionesModule } from '../inscripciones/inscripciones.module';
import { CuotasModule } from '../cuotas/cuotas.module';
import { CampamentosModule } from '../campamentos/campamentos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Caja]),
    forwardRef(() => MovimientosModule),
    forwardRef(() => InscripcionesModule),
    forwardRef(() => CuotasModule),
    forwardRef(() => CampamentosModule),
  ],
  controllers: [CajasController],
  providers: [CajasService],
  exports: [CajasService],
})
export class CajasModule {}
