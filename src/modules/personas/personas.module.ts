import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Persona,
  Protagonista,
  Educador,
  PersonaExterna,
} from './entities/persona.entity';
import { PersonasService } from './personas.service';
import { PersonasController } from './personas.controller';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Persona, Protagonista, Educador, PersonaExterna]),
    forwardRef(() => CajasModule),
    forwardRef(() => MovimientosModule),
  ],
  controllers: [PersonasController],
  providers: [PersonasService],
  exports: [PersonasService],
})
export class PersonasModule {}
