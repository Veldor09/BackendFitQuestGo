import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import { InsigniaEstadoDto } from './dto/insignia-estado.dto';
import { CodigoInsignia, TipoInsignia } from './insignia.enum';
import { Insignia } from './insignia.entity';
import { UsuarioInsignia } from './usuario-insignia.entity';

@Injectable()
export class InsigniasService {
  private readonly logger = new Logger(InsigniasService.name);

  constructor(
    @InjectRepository(Insignia)
    private readonly insigniaRepo: Repository<Insignia>,
    @InjectRepository(UsuarioInsignia)
    private readonly usuarioInsigniaRepo: Repository<UsuarioInsignia>,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  /**
   * Obtiene el catálogo de insignias activas con el estado de avance del usuario dado.
   */
  async obtenerInsigniasUsuario(usuarioId: number): Promise<InsigniaEstadoDto[]> {
    const insignias = await this.insigniaRepo.find({
      where: { activa: true },
      order: { id: 'ASC' },
    });

    const obtenidas = await this.usuarioInsigniaRepo.find({
      where: { idUsuario: usuarioId },
    });

    const obtenidasMap = new Map<number, UsuarioInsignia>();
    for (const item of obtenidas) {
      obtenidasMap.set(item.idInsignia, item);
    }

    // Calculamos métricas del usuario para evaluar el progreso
    const { totalKm, totalRutas, totalAlertas, totalNodos } =
      await this.calcularMetricasUsuario(usuarioId);

    return insignias.map((insignia) => {
      const registro = obtenidasMap.get(insignia.id);
      const desbloqueada = !!registro;
      const fechaObtenida = registro
        ? registro.obtenidaEn.toISOString()
        : null;

      let progreso: number | null = null;
      if (insignia.tipo === TipoInsignia.Km) {
        progreso = Math.round(totalKm * 10) / 10;
      } else if (insignia.tipo === TipoInsignia.Hito) {
        if (insignia.codigo === CodigoInsignia.PrimeraRuta) {
          progreso = Math.min(totalRutas, 1);
        } else if (insignia.codigo === CodigoInsignia.PrimeraAlerta) {
          progreso = Math.min(totalAlertas, 1);
        } else if (insignia.codigo === CodigoInsignia.PrimerPuntoInteres) {
          progreso = Math.min(totalNodos, 1);
        } else if (insignia.codigo === CodigoInsignia.AlertaLike) {
          progreso = 0;
        } else {
          progreso = desbloqueada ? 1 : 0;
        }
      }

      return {
        codigo: insignia.codigo,
        nombre: insignia.nombre,
        descripcion: insignia.descripcion,
        emoji: insignia.emoji,
        desbloqueada,
        fechaObtenida,
        progreso,
        meta: insignia.meta !== null ? Number(insignia.meta) : null,
      };
    });
  }

  /**
   * Conteo de insignias obtenidas por un usuario.
   */
  async contarInsigniasUsuario(usuarioId: number): Promise<number> {
    return this.usuarioInsigniaRepo.count({
      where: { idUsuario: usuarioId },
    });
  }

  /**
   * Otorga una insignia a un usuario si aún no la tiene (Idempotente).
   * Si se otorga con éxito, dispara una notificación.
   */
  async otorgar(
    usuarioId: number,
    codigo: CodigoInsignia | string,
  ): Promise<boolean> {
    try {
      const insignia = await this.insigniaRepo.findOne({
        where: { codigo, activa: true },
      });

      if (!insignia) {
        this.logger.warn(`Insignia con código ${codigo} no encontrada o inactiva`);
        return false;
      }

      const yaObtenida = await this.usuarioInsigniaRepo.findOne({
        where: { idUsuario: usuarioId, idInsignia: insignia.id },
      });

      if (yaObtenida) {
        return false;
      }

      const nuevoRegistro = this.usuarioInsigniaRepo.create({
        idUsuario: usuarioId,
        idInsignia: insignia.id,
      });

      await this.usuarioInsigniaRepo.save(nuevoRegistro);

      // Notificar al usuario
      await this.notificacionesService.crear({
        idUsuario: usuarioId,
        categoria: CategoriaNotificacion.Insignias,
        titulo: `¡Nueva insignia desbloqueada: ${insignia.nombre}!`,
        mensaje: insignia.descripcion,
        referenciaTipo: ReferenciaTipoNotificacion.Insignia,
        referenciaId: insignia.id,
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Error al otorgar insignia ${codigo} al usuario ${usuarioId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Evalúa y otorga todas las insignias a las que sea acreedor el usuario.
   */
  async evaluar(usuarioId: number): Promise<void> {
    try {
      const { totalKm, totalRutas, totalAlertas, totalNodos } =
        await this.calcularMetricasUsuario(usuarioId);

      if (totalRutas >= 1) {
        await this.otorgar(usuarioId, CodigoInsignia.PrimeraRuta);
      }
      if (totalAlertas >= 1) {
        await this.otorgar(usuarioId, CodigoInsignia.PrimeraAlerta);
      }
      if (totalNodos >= 1) {
        await this.otorgar(usuarioId, CodigoInsignia.PrimerPuntoInteres);
      }

      if (totalKm >= 10) {
        await this.otorgar(usuarioId, CodigoInsignia.Km10);
      }
      if (totalKm >= 50) {
        await this.otorgar(usuarioId, CodigoInsignia.Km50);
      }
      if (totalKm >= 100) {
        await this.otorgar(usuarioId, CodigoInsignia.Km100);
      }
    } catch (error) {
      this.logger.error(
        `Error al evaluar insignias para usuario ${usuarioId}: ${error.message}`,
        error.stack,
      );
    }
  }

  private async calcularMetricasUsuario(usuarioId: number): Promise<{
    totalKm: number;
    totalRutas: number;
    totalAlertas: number;
    totalNodos: number;
  }> {
    const rutasRes = await this.insigniaRepo.manager.query(
      'SELECT COALESCE(SUM(CAST(r."distancia_km" AS float)), 0) AS km, COUNT(r.id)::int AS rutas FROM rutas r WHERE r.creado_por = $1 AND r.estado != $2',
      [usuarioId, 'Rechazada'],
    );
    const totalKm = parseFloat(rutasRes[0]?.km ?? '0');
    const totalRutas = parseInt(rutasRes[0]?.rutas ?? '0', 10);

    const alertasRes = await this.insigniaRepo.manager.query(
      'SELECT COUNT(a.id)::int AS alertas FROM alertas a WHERE a.creado_por = $1',
      [usuarioId],
    );
    const totalAlertas = parseInt(alertasRes[0]?.alertas ?? '0', 10);

    const nodosRes = await this.insigniaRepo.manager.query(
      'SELECT COUNT(n.id)::int AS nodos FROM nodos n WHERE n.creado_por = $1',
      [usuarioId],
    );
    const totalNodos = parseInt(nodosRes[0]?.nodos ?? '0', 10);

    return { totalKm, totalRutas, totalAlertas, totalNodos };
  }
}
