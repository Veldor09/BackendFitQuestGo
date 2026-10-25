
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditoriaModule } from '../Auditoria/auditoria.module';
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

import { PlanPatrocinio } from './plan-patrocinio.entity';
import { PrecioPatrocinio } from './precio-patrocinio.entity';
import { Suscripcion } from './suscripcion.entity';
import { RenovacionSuscripcion } from './renovacion-suscripcion.entity';
import { SuscripcionesService } from './suscripciones.service';
import { SuscripcionesController } from './suscripciones.controller';
import { SuscripcionesAdminController } from './suscripciones-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Nodo,
      Evento,
      PlanPatrocinio,
      PrecioPatrocinio,
      Suscripcion,
      RenovacionSuscripcion,
    ]),
    SeguridadModule,
    NotificacionesModule,
    AuditoriaModule,
  ],
  controllers: [
    PatrocinioController,
    SuscripcionesController,
    SuscripcionesAdminController,
  ],
  providers: [
    DestacadosService,
    PatrocinioAvisosService,
    SuscripcionAvisosTask,
    SuscripcionesService,
    {
      provide: SUSCRIPCIONES_VIGENTES,
      useClass: SuscripcionesVigentesSql,
    },
  ],
  exports: [
    DestacadosService,
    PatrocinioAvisosService,
    SUSCRIPCIONES_VIGENTES,
    SuscripcionesService,
  ],
})
export class PatrocinioModule {}
