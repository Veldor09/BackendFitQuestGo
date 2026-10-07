import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CrearNotificacionParametros,
  NotificacionRespuestaDto,
} from './dto/notificacion.dto';
import { Notificacion } from './notificacion.entity';

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(Notificacion)
    private readonly notificacionRepo: Repository<Notificacion>,
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
      return await this.notificacionRepo.save(notificacion);
    } catch (error) {
      this.logger.error(
        `Error al crear notificacion para usuario ${params.idUsuario}: ${error.message}`,
        error.stack,
      );
      return null;
    }
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
