import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { CatalogosModule } from '../Catalogos/catalogos.module';
import { InsigniasModule } from '../Insignias/insignias.module';
import { NotificacionesModule } from '../Notificaciones/notificaciones.module';
import { RecorridoRuta } from './recorrido-ruta.entity';
import { RutaFavorita } from './ruta-favorita.entity';
import { Ruta } from './ruta.entity';
import { RutaController } from './ruta.controller';
import { RutaService } from './ruta.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta, RutaFavorita, RecorridoRuta]),
    SeguridadModule,
    CatalogosModule,
    NotificacionesModule,
    InsigniasModule,
  ],
  controllers: [RutaController],
  providers: [RutaService],
  exports: [RutaService],
})
export class RutaModule {}
