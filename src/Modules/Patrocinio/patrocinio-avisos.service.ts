import { Injectable } from '@nestjs/common';
import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../Notificaciones/notificacion.enum';
import { NotificacionesService } from '../Notificaciones/notificaciones.service';
import {
  type SolicitudPush,
  TipoPush,
} from '../Notificaciones/push/push-plantillas';

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

  /**
   * [dias] es lo que dura el plan aprobado (por defecto 30). Segun la
   * [audiencia] el aviso dice que se gana: destacar (empresa) o descargar mas
   * cosas sin conexion (usuario).
   */
  async planAprobado(
    usuarioId: number,
    suscripcionId: number,
    dias = 30,
    audiencia: 'empresa' | 'usuario' = 'empresa',
  ): Promise<void> {
    await this.avisar(
      usuarioId,
      suscripcionId,
      audiencia === 'usuario'
        ? 'Tu suscripción fue aprobada'
        : 'Tu plan de patrocinio fue aprobado',
      audiencia === 'usuario'
        ? `Ya puedes guardar más rutas sin conexión durante ${dias} días.`
        : `Ya puedes destacar tus comercios y eventos durante ${dias} días.`,
      { tipo: TipoPush.PlanAprobado },
    );
  }

  /** [motivo] es lo que escribio el admin al rechazar: la persona merece saberlo. */
  async planRechazado(
    usuarioId: number,
    suscripcionId: number,
    motivo?: string,
  ): Promise<void> {
    await this.avisar(
      usuarioId,
      suscripcionId,
      'Tu solicitud de plan fue rechazada',
      motivo
        ? `Motivo: ${/[.!?]$/.test(motivo.trim()) ? motivo.trim() : `${motivo.trim()}.`} Puedes enviar una nueva solicitud cuando quieras.`
        : 'Puedes enviar una nueva solicitud cuando quieras.',
      { tipo: TipoPush.PlanRechazado },
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
      { tipo: TipoPush.PlanSuspendido },
    );
  }

  /** `true` si creo el aviso, `false` si ya existia (o no se pudo guardar). */
  planVencido(usuarioId: number, suscripcionId: number): Promise<boolean> {
    return this.avisarUnaVez(
      usuarioId,
      suscripcionId,
      TITULO_VENCIDO,
      'Tus publicaciones siguen visibles, pero ya no aparecen como destacadas. Renueva tu plan para volver a destacarlas.',
      { tipo: TipoPush.PlanVencido },
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
      {
        tipo: TipoPush.PlanPorVencer,
        params: { venceEn: venceEn.toISOString() },
      },
    );
  }

  private async avisarUnaVez(
    usuarioId: number,
    suscripcionId: number,
    titulo: string,
    mensaje: string,
    push: SolicitudPush,
  ): Promise<boolean> {
    const yaEstaba = await this.notificaciones.yaAvisada(
      usuarioId,
      ReferenciaTipoNotificacion.Suscripcion,
      suscripcionId,
      titulo,
    );
    if (yaEstaba) return false;
    return this.avisar(usuarioId, suscripcionId, titulo, mensaje, push);
  }

  private async avisar(
    usuarioId: number,
    suscripcionId: number,
    titulo: string,
    mensaje: string,
    push: SolicitudPush,
  ): Promise<boolean> {
    const creada = await this.notificaciones.crear({
      idUsuario: usuarioId,
      categoria: CategoriaNotificacion.Patrocinio,
      titulo,
      mensaje,
      referenciaTipo: ReferenciaTipoNotificacion.Suscripcion,
      referenciaId: suscripcionId,
      push,
    });
    return creada !== null;
  }
}
