import { RoleId } from '../Usuarios/roles.enum';

/**
 * Como se paga una suscripcion segun el pais.
 * - Costa Rica: SINPE Movil a mano. La persona transfiere, manda el comprobante
 *   y un administrador activa el plan (ver `SuscripcionesService`).
 * - Resto del mundo: PayPal, que todavia no esta configurado: se pueden ver los
 *   planes pero no se puede solicitar.
 */
export type MetodoPago = 'sinpe' | 'paypal';

/** Numero que recibe el SINPE Movil y los comprobantes (WhatsApp). */
export const SINPE_MOVIL_NUMERO =
  process.env.SINPE_MOVIL_NUMERO?.trim() || '83722969';

export function metodoPagoParaPais(pais?: string | null): MetodoPago {
  return (pais ?? '').trim().toUpperCase() === 'CR' ? 'sinpe' : 'paypal';
}

/** El pago por este metodo ya funciona (SINPE si; PayPal aun no). */
export function pagoDisponible(metodo: MetodoPago): boolean {
  return metodo === 'sinpe';
}

/** Audiencia de los planes que le tocan a cada rol. */
export type AudienciaPlan = 'empresa' | 'usuario';

export function audienciaParaRol(rol: number): AudienciaPlan {
  return rol === Number(RoleId.Empresa) ? 'empresa' : 'usuario';
}
