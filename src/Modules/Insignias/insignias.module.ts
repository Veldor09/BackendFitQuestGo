import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { NotificacionesModule } from '../Notificaciones/notificaciones.module';
import { Insignia } from './insignia.entity';
import {
  InsigniasController,
  UsuarioInsigniasController,
} from './insignias.controller';
import { InsigniasService } from './insignias.service';
import { UsuarioInsignia } from './usuario-insignia.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Insignia, UsuarioInsignia]),
    SeguridadModule,
    NotificacionesModule,
  ],
  controllers: [InsigniasController, UsuarioInsigniasController],
  providers: [InsigniasService],
  exports: [InsigniasService, TypeOrmModule],
})
export class InsigniasModule {}
