import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alerta } from '../Alertas/alerta.entity';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Nodo } from '../Nodos/nodo.entity';
import { Ruta } from '../Rutas/ruta.entity';
import { ReporteContenidoController } from './reporte-contenido.controller';
import { ReporteContenido } from './reporte-contenido.entity';
import { ReporteContenidoService } from './reporte-contenido.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReporteContenido, Ruta, Nodo, Alerta]),
    SeguridadModule,
  ],
  controllers: [ReporteContenidoController],
  providers: [ReporteContenidoService],
})
export class ReporteContenidoModule {}
