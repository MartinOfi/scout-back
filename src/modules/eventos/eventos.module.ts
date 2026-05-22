import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Evento } from './entities/evento.entity';
import { Producto } from './entities/producto.entity';
import { VentaProducto } from './entities/venta-producto.entity';
import { Entrega } from './entities/entrega.entity';
import { EntregaLinea } from './entities/entrega-linea.entity';
import { Persona } from '../personas/entities/persona.entity';
import { EventosService } from './eventos.service';
import { VentasEventoService } from './services/ventas-evento.service';
import { EntregasEventoService } from './services/entregas-evento.service';
import { EventosController } from './eventos.controller';
import { EntregasController } from './entregas.controller';
import { PersonasModule } from '../personas/personas.module';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Evento,
      Producto,
      VentaProducto,
      Entrega,
      EntregaLinea,
      // Persona is registered here only so EntregasEventoService can inject its
      // repository directly for the stock-disponible name lookup. PersonasModule
      // still owns the canonical Persona service for everything else.
      Persona,
    ]),
    PersonasModule,
    CajasModule,
    MovimientosModule,
  ],
  controllers: [EventosController, EntregasController],
  providers: [EventosService, VentasEventoService, EntregasEventoService],
  exports: [EventosService, VentasEventoService, EntregasEventoService],
})
export class EventosModule {}
