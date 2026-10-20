import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Evento } from '../Eventos/evento.entity';
import { Nodo } from '../Nodos/nodo.entity';
import { NotificacionesModule } from '../Notificaciones/notificaciones.module';
import { DestacadosService } from './destacados.service';
import { PatrocinioAvisosService } from './patrocinio-avisos.service';
import { PatrocinioController } from './patrocinio.controller';
import { SuscripcionAvisosTask } from './suscripcion-avisos.task';
import {
  SUSCRIPCIONES_VIGENTES,
  SuscripcionesVigentesSql,
} from './suscripciones-vigentes';

@Module({
  imports: [
    TypeOrmModule.forFeature([Nodo, Evento]),
    SeguridadModule,
    NotificacionesModule,
  ],
  controllers: [PatrocinioController],
  providers: [
    DestacadosService,
    PatrocinioAvisosService,
    SuscripcionAvisosTask,
    { provide: SUSCRIPCIONES_VIGENTES, useClass: SuscripcionesVigentesSql },
  ],
  exports: [DestacadosService, PatrocinioAvisosService, SUSCRIPCIONES_VIGENTES],
})
export class PatrocinioModule {}
