import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campamento } from './entities/campamento.entity';
import { CampamentosService } from './campamentos.service';
import { CampamentosController } from './campamentos.controller';
import { PersonasModule } from '../personas/personas.module';
import { CajasModule } from '../cajas/cajas.module';
import { MovimientosModule } from '../movimientos/movimientos.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Campamento]),
    forwardRef(() => PersonasModule),
    forwardRef(() => CajasModule),
    forwardRef(() => MovimientosModule),
  ],
  controllers: [CampamentosController],
  providers: [CampamentosService],
  exports: [CampamentosService],
})
export class CampamentosModule {}
