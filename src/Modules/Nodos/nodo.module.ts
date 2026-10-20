import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { CatalogosModule } from '../Catalogos/catalogos.module';
import { InsigniasModule } from '../Insignias/insignias.module';
import { NotificacionesModule } from '../Notificaciones/notificaciones.module';
import { PatrocinioModule } from '../Patrocinio/patrocinio.module';
import { Nodo } from './nodo.entity';
import { NodoFoto } from './nodo-foto.entity';
import { NodoVoto } from './nodo-voto.entity';
import { NodoController } from './nodo.controller';
import { NodoService } from './nodo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Nodo, NodoFoto, NodoVoto]),
    SeguridadModule,
    CatalogosModule,
    InsigniasModule,
    NotificacionesModule,
    PatrocinioModule,
  ],
  controllers: [NodoController],
  providers: [NodoService],
  exports: [NodoService],
})
export class NodoModule {}
