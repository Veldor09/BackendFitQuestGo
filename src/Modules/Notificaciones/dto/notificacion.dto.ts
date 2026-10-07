import {
  CategoriaNotificacion,
  ReferenciaTipoNotificacion,
} from '../notificacion.enum';

export interface CrearNotificacionParametros {
  idUsuario: number;
  categoria: CategoriaNotificacion;
  titulo: string;
  mensaje: string;
  referenciaTipo?: ReferenciaTipoNotificacion | null;
  referenciaId?: number | null;
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
