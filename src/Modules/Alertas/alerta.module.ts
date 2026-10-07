import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { InsigniasModule } from '../Insignias/insignias.module';
import { NotificacionesModule } from '../Notificaciones/notificaciones.module';
import { Alerta } from './alerta.entity';
import { AlertaController } from './alerta.controller';
import { AlertaService } from './alerta.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alerta]),
    SeguridadModule,
    NotificacionesModule,
    InsigniasModule,
  ],
  controllers: [AlertaController],
  providers: [AlertaService],
  exports: [AlertaService],
})
export class AlertaModule {}

