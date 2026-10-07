import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { InsigniasModule } from '../Insignias/insignias.module';
import { NotificacionesModule } from '../Notificaciones/notificaciones.module';
import { RutaFavorita } from './ruta-favorita.entity';
import { Ruta } from './ruta.entity';
import { RutaController } from './ruta.controller';
import { RutaService } from './ruta.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta, RutaFavorita]),
    SeguridadModule,
    NotificacionesModule,
    InsigniasModule,
  ],
  controllers: [RutaController],
  providers: [RutaService],
  exports: [RutaService],
})
export class RutaModule {}

