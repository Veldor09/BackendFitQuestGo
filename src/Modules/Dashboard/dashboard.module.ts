import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Alerta } from '../Alertas/alerta.entity';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Nodo } from '../Nodos/nodo.entity';
import { ReporteContenido } from '../ReportesContenido/reporte-contenido.entity';
import { Ruta } from '../Rutas/ruta.entity';
import { User } from '../Usuarios/user.entity';

import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Ruta,
      Nodo,
      Alerta,
      ReporteContenido,
    ]),
    SeguridadModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}