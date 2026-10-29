import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from '../Alertas/alerta.entity';
import { AuthModule } from '../Auth/auth.module';
import { SeguridadModule } from '../Auth/seguridad.module';
import { EventoFoto } from '../Eventos/evento-foto.entity';
import { Evento } from '../Eventos/evento.entity';
import { NodoFoto } from '../Nodos/nodo-foto.entity';
import { Nodo } from '../Nodos/nodo.entity';
import { Ruta } from '../Rutas/ruta.entity';
import { ReporteContenidoController } from './reporte-contenido.controller';
import { ReporteContenido } from './reporte-contenido.entity';
import { ReporteContenidoService } from './reporte-contenido.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReporteContenido,
      Ruta,
      Nodo,
      Alerta,
      Evento,
      NodoFoto,
      EventoFoto,
    ]),
    SeguridadModule,
    AuthModule,
  ],
  controllers: [ReporteContenidoController],
  providers: [ReporteContenidoService],
})
export class ReporteContenidoModule {}
