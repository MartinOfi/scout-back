import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Persona,
  Protagonista,
  Educador,
  PersonaExterna,
} from './entities/persona.entity';
import { PersonasService } from './personas.service';
import { PersonasDashboardService } from './services/personas-dashboard.service';
import { PersonasController } from './personas.controller';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';
import { InscripcionesModule } from '../inscripciones/inscripciones.module';
import { CuotasModule } from '../cuotas/cuotas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Persona, Protagonista, Educador, PersonaExterna]),
    forwardRef(() => CajasModule),
    forwardRef(() => MovimientosModule),
    forwardRef(() => InscripcionesModule),
    forwardRef(() => CuotasModule),
  ],
  controllers: [PersonasController],
  providers: [PersonasService, PersonasDashboardService],
  exports: [PersonasService, PersonasDashboardService],
})
export class PersonasModule {}
