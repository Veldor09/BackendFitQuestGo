import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { InsigniasModule } from '../Insignias/insignias.module';
import { NotificacionesModule } from '../Notificaciones/notificaciones.module';
import { Alerta } from './alerta.entity';
import { AlertaVoto } from './alerta-voto.entity';
import { AlertaController } from './alerta.controller';
import { AlertaExpiracionTask } from './alerta-expiracion.task';
import { AlertaService } from './alerta.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alerta, AlertaVoto]),
    SeguridadModule,
    NotificacionesModule,
    InsigniasModule,
  ],
  controllers: [AlertaController],
  providers: [AlertaService, AlertaExpiracionTask],
  exports: [AlertaService],
})
export class AlertaModule {}

