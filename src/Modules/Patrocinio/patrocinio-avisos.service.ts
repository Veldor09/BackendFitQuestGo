import { Injectable } from '@nestjs/common';
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';

const TITULO_VENCIDO = 'Tu plan de patrocinio venció';
const TITULO_POR_VENCER = 'Tu plan de patrocinio vence pronto';

/**
 * Los avisos al dueno de un plan (spec, seccion 8.2). Aprobado, rechazado y
 * suspendido los llama ADM-09A desde las acciones del admin; por vencer y
 * vencido los manda `SuscripcionAvisosTask` sin repetirlos.
 */
@Injectable()
export class PatrocinioAvisosService {
  constructor(private readonly notificaciones: NotificacionesService) {}

  async planAprobado(usuarioId: number, suscripcionId: number): Promise<void> {
    await this.avisar(
      usuarioId,
      suscripcionId,
      'Tu plan de patrocinio fue aprobado',
      'Ya puedes destacar tus comercios y eventos durante 30 días.',
    );
  }

  async planRechazado(usuarioId: number, suscripcionId: number): Promise<void> {
    await this.avisar(
      usuarioId,
      suscripcionId,
      'Tu solicitud de plan fue rechazada',
      'Puedes enviar una nueva solicitud cuando quieras.',
    );
  }

  async planSuspendido(
    usuarioId: number,
    suscripcionId: number,
  ): Promise<void> {
    await this.avisar(
      usuarioId,
      suscripcionId,
      'Tu plan de patrocinio fue suspendido',
      'Tus publicaciones dejaron de verse como destacadas. Si crees que es un error, escribe al equipo de FitQuest Go.',
    );
  }

  /** `true` si creo el aviso, `false` si ya existia (o no se pudo guardar). */
  planVencido(usuarioId: number, suscripcionId: number): Promise<boolean> {
    return this.avisarUnaVez(
      usuarioId,
      suscripcionId,
      TITULO_VENCIDO,
      'Tus publicaciones siguen visibles, pero ya no aparecen como destacadas. Renueva tu plan para volver a destacarlas.',
    );
  }

  planPorVencer(
    usuarioId: number,
    suscripcionId: number,
    venceEn: Date,
  ): Promise<boolean> {
    const fecha = venceEn.toLocaleDateString('es-CR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'America/Costa_Rica',
    });
    return this.avisarUnaVez(
      usuarioId,
      suscripcionId,
      TITULO_POR_VENCER,
      `Vence el ${fecha}. Renuévalo para que tus publicaciones sigan destacadas.`,
    );
  }

  private async avisarUnaVez(
    usuarioId: number,
    suscripcionId: number,
    titulo: string,
    mensaje: string,
  ): Promise<boolean> {
    const yaEstaba = await this.notificaciones.yaAvisada(
      usuarioId,
      ReferenciaTipoNotificacion.Suscripcion,
      suscripcionId,
      titulo,
    );
    if (yaEstaba) return false;
    return this.avisar(usuarioId, suscripcionId, titulo, mensaje);
  }

  private async avisar(
    usuarioId: number,
    suscripcionId: number,
    titulo: string,
    mensaje: string,
  ): Promise<boolean> {
    const creada = await this.notificaciones.crear({
      idUsuario: usuarioId,
      categoria: CategoriaNotificacion.Patrocinio,
      titulo,
      mensaje,
      referenciaTipo: ReferenciaTipoNotificacion.Suscripcion,
      referenciaId: suscripcionId,
    });
    return creada !== null;
  }
}
