import { Module, forwardRef } from '@nestjs/common';
import { BonificacionesService } from './bonificaciones.service';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [forwardRef(() => CajasModule), forwardRef(() => MovimientosModule)],
  providers: [BonificacionesService],
  exports: [BonificacionesService],
})
export class BonificacionesModule {}
