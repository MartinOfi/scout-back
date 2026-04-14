import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ExportsController } from './exports.controller';
import { ExportsService } from './services/exports.service';
import { WorkbookBuilderService } from './services/workbook-builder.service';

import { Persona } from '../personas/entities/persona.entity';
import { Caja } from '../cajas/entities/caja.entity';
import { Movimiento } from '../movimientos/entities/movimiento.entity';
import { Inscripcion } from '../inscripciones/entities/inscripcion.entity';
import { Cuota } from '../cuotas/entities/cuota.entity';
import { Campamento } from '../campamentos/entities/campamento.entity';
import { Evento } from '../eventos/entities/evento.entity';
import { Producto } from '../eventos/entities/producto.entity';
import { VentaProducto } from '../eventos/entities/venta-producto.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Persona,
      Caja,
      Movimiento,
      Inscripcion,
      Cuota,
      Campamento,
      Evento,
      Producto,
      VentaProducto,
    ]),
  ],
  controllers: [ExportsController],
  providers: [ExportsService, WorkbookBuilderService],
  exports: [ExportsService],
})
export class ExportsModule {}
