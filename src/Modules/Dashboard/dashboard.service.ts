import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';

import { Alerta } from '../Alertas/alerta.entity';
import { EstadoAlerta } from '../Alertas/estado-alerta.enum';
import { Nodo } from '../Nodos/nodo.entity';
import { EstadoNodo } from '../Nodos/estado-nodo.enum';
import { ReporteContenido } from '../ReportesContenido/reporte-contenido.entity';
import { EstadoReporteContenido } from '../ReportesContenido/estado-reporte-contenido.enum';
import { Ruta } from '../Rutas/ruta.entity';
import { EstadoRuta } from '../Rutas/estado-ruta.enum';
import { User } from '../Usuarios/user.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User)
    private readonly usuarios: Repository<User>,

    @InjectRepository(Ruta)
    private readonly rutas: Repository<Ruta>,

    @InjectRepository(Nodo)
    private readonly nodos: Repository<Nodo>,

    @InjectRepository(Alerta)
    private readonly alertas: Repository<Alerta>,

    @InjectRepository(ReporteContenido)
    private readonly reportes: Repository<ReporteContenido>,
  ) {}

  async obtenerResumen() {
    const [
      usuarios,
      rutas,
      alertasActivas,
      rutasPorRevisar,
      nodosPendientes,
      reportesNuevos,
    ] = await Promise.all([
      this.usuarios.count(),

      this.rutas.count(),

      this.alertas.count({
        where: {
          estado: EstadoAlerta.Activa,
          expiraEn: MoreThan(new Date()),
        },
      }),

      this.rutas.count({
        where: {
          estado: EstadoRuta.Pendiente,
        },
      }),

      this.nodos.count({
        where: {
          estado: EstadoNodo.Pendiente,
        },
      }),

      this.reportes.count({
        where: {
          estado: EstadoReporteContenido.Pendiente,
        },
      }),
    ]);

    return {
      usuarios,
      rutas,
      alertasActivas,
      pendientes:
        rutasPorRevisar + nodosPendientes + reportesNuevos,

      colas: {
        rutasPorRevisar,
        nodosPendientes,
        reportesNuevos,
      },
    };
  }
}