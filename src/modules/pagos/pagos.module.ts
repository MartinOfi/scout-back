import { Module, forwardRef } from '@nestjs/common';
import { PagosService } from './pagos.service';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [forwardRef(() => CajasModule), forwardRef(() => MovimientosModule)],
  providers: [PagosService],
  exports: [PagosService],
})
export class PagosModule {}
