import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { PersonasModule } from './modules/personas/personas.module';
import { CajasModule } from './modules/cajas/cajas.module';
import { MovimientosModule } from './modules/movimientos/movimientos.module';
import { PagosModule } from './modules/pagos/pagos.module';
import { InscripcionesModule } from './modules/inscripciones/inscripciones.module';
import { CuotasModule } from './modules/cuotas/cuotas.module';
import { CampamentosModule } from './modules/campamentos/campamentos.module';
import { EventosModule } from './modules/eventos/eventos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.local',
    }),
    DatabaseModule,
    CommonModule,
    PersonasModule,
    CajasModule,
    MovimientosModule,
    PagosModule,
    InscripcionesModule,
    CuotasModule,
    CampamentosModule,
    EventosModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
