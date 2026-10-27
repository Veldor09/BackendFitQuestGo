import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { User } from '../Usuarios/user.entity';
import { Notificacion } from './notificacion.entity';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { DispositivoPush } from './push/dispositivo-push.entity';
import { crearProveedorPush } from './push/proveedor-push-fcm';
import { PROVEEDOR_PUSH } from './push/proveedor-push';
import { PushController } from './push/push.controller';
import { PushService } from './push/push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notificacion, DispositivoPush, User]),
    SeguridadModule,
  ],
  controllers: [NotificacionesController, PushController],
  providers: [
    NotificacionesService,
    PushService,
    // Firebase si hay cuenta de servicio en el entorno; si no, no sale nada
    // del telefono y todo lo demas sigue igual.
    { provide: PROVEEDOR_PUSH, useFactory: () => crearProveedorPush() },
  ],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}
