import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evento } from './entities/evento.entity';
import { Producto } from './entities/producto.entity';
import { VentaProducto } from './entities/venta-producto.entity';
import { EventosService } from './eventos.service';
import { VentasEventoService } from './services/ventas-evento.service';
import { EventosController } from './eventos.controller';
import { PersonasModule } from '../personas/personas.module';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evento, Producto, VentaProducto]),
    PersonasModule,
    CajasModule,
    MovimientosModule,
  ],
  controllers: [EventosController],
  providers: [EventosService, VentasEventoService],
  exports: [EventosService, VentasEventoService],
})
export class EventosModule {}
