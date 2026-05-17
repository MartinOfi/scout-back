import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Movimiento } from '../modules/movimientos/entities/movimiento.entity';
import { VentaProducto } from '../modules/eventos/entities/venta-producto.entity';
import { DeletionValidatorService } from './services/deletion-validator.service';

/**
 * CommonModule provides shared services across the application.
 *
 * @Global makes this module available everywhere without explicit imports.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Movimiento, VentaProducto])],
  providers: [DeletionValidatorService],
  exports: [DeletionValidatorService],
})
export class CommonModule {}
