import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CrearNotificacionParametros,
  NotificacionRespuestaDto,
} from './dto/notificacion.dto';
import { Notificacion } from './notificacion.entity';
import { ReferenciaTipoNotificacion } from './notificacion.enum';
import { PushService } from './push/push.service';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepo: Repository<Notificacion>,
    // Opcional: sin el, las notificaciones solo viven en la campana de la app.
    @Optional() private readonly pushService?: PushService,
  ) {}

  async crear(
    params: CrearNotificacionParametros,
  ): Promise<Notificacion | null> {
    try {
      const notificacion = this.notificacionRepo.create({
        idUsuario: params.idUsuario,
        categoria: params.categoria,
        titulo: params.titulo,
        mensaje: params.mensaje,
        referenciaTipo: params.referenciaTipo ?? null,
        referenciaId: params.referenciaId ?? null,
        leida: false,
      });
      const guardada = await this.notificacionRepo.save(notificacion);
      if (params.push && this.pushService) {
        // Sin esperar: el aviso fuera de la app no demora ni puede romper la accion.
        this.pushService.notificar(guardada, params.push).catch((error) => {
          this.logger.warn(
            `Aviso fuera de la app de la notificacion ${guardada.id}: ${error?.message ?? error}`,
          );
        });
      }
      return guardada;
    } catch (error) {
      this.logger.error(
        `Error al crear notificacion para usuario ${params.idUsuario}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  /**
   * Ya existe una notificacion de este usuario, sobre esta referencia y con
   * este titulo: sirve para no repetir avisos programados (p. ej. "por vencer").
   */
  async yaAvisada(
    idUsuario: number,
    referenciaTipo: ReferenciaTipoNotificacion,
    referenciaId: number,
    titulo: string,
  ): Promise<boolean> {
    const cantidad = await this.notificacionRepo.count({
      where: { idUsuario, referenciaTipo, referenciaId, titulo },
    });
    return cantidad > 0;
  }

  async findMisNotificaciones(
    usuarioId: number,
  ): Promise<NotificacionRespuestaDto[]> {
    const notificaciones = await this.notificacionRepo.find({
      where: { idUsuario: usuarioId },
      order: { creadaEn: 'DESC' },
      take: 100,
    });

    return notificaciones.map((n) => this.mapearRespuesta(n));
  }

  async contarNoLeidas(usuarioId: number): Promise<{ conteo: number }> {
    const conteo = await this.notificacionRepo.count({
      where: { idUsuario: usuarioId, leida: false },
    });
    return { conteo };
  }

  async marcarLeida(
    id: number,
    usuarioId: number,
  ): Promise<NotificacionRespuestaDto> {
    const notificacion = await this.notificacionRepo.findOne({
      where: { id, idUsuario: usuarioId },
    });

    if (!notificacion) {
      throw new NotFoundException(
        `Notificación ${id} no encontrada para el usuario autenticado`,
      );
    }

    if (!notificacion.leida) {
      notificacion.leida = true;
      await this.notificacionRepo.save(notificacion);
    }

    return this.mapearRespuesta(notificacion);
  }

  async marcarTodasLeidas(usuarioId: number): Promise<{ actualizadas: number }> {
    const res = await this.notificacionRepo.update(
      { idUsuario: usuarioId, leida: false },
      { leida: true },
    );
    return { actualizadas: res.affected ?? 0 };
  }

  async eliminar(id: number, usuarioId: number): Promise<void> {
    const notificacion = await this.notificacionRepo.findOne({
      where: { id, idUsuario: usuarioId },
    });

    if (!notificacion) {
      throw new NotFoundException(
        `Notificación ${id} no encontrada para el usuario autenticado`,
      );
    }

    await this.notificacionRepo.remove(notificacion);
  }

  private mapearRespuesta(n: Notificacion): NotificacionRespuestaDto {
    return {
      id: n.id,
      categoria: n.categoria,
      titulo: n.titulo,
      mensaje: n.mensaje,
      leida: n.leida,
      creadaEn: n.creadaEn.toISOString(),
      referenciaTipo: n.referenciaTipo,
      referenciaId: n.referenciaId,
    };
  }
}
