import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../notificacion.enum';

import type { SolicitudPush } from '../push/push-plantillas';

export interface CrearNotificacionParametros {
  idUsuario: number;
  categoria: CategoriaNotificacion;
  titulo: string;
  mensaje: string;
  referenciaTipo?: ReferenciaTipoNotificacion | null;
  referenciaId?: number | null;
  /**
   * Si se indica, ademas de guardarse en la campana, sale un aviso fuera de la
   * app. Solo para resultados que decide otra persona o el tiempo (ver
   * `TipoPush`); sin esto nunca sale nada del telefono.
   */
  push?: SolicitudPush;
}

export interface NotificacionRespuestaDto {
  id: number;
  categoria: CategoriaNotificacion;
  titulo: string;
  mensaje: string;
  leida: boolean;
  creadaEn: string;
  referenciaTipo: ReferenciaTipoNotificacion | null;
  referenciaId: number | null;
}
