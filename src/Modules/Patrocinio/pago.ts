import { RoleId } from '../Usuarios/roles.enum';

/**
 * Como se paga una suscripcion segun el pais.
 * - Costa Rica: ONVO (tarjeta y SINPE Movil) en colones. La persona paga en la
 *   pantalla de pago y el plan se activa solo al confirmarse.
 * - Resto del mundo: PayPal, que todavia no esta configurado: se pueden ver los
 *   planes pero no se puede pagar.
 */
export type MetodoPago = 'onvo' | 'paypal';

export function metodoPagoParaPais(pais?: string | null): MetodoPago {
  return (pais ?? '').trim().toUpperCase() === 'CR' ? 'onvo' : 'paypal';
}

/** El pago por este metodo ya funciona (ONVO si; PayPal aun no). */
export function pagoDisponible(metodo: MetodoPago): boolean {
  return metodo === 'onvo';
}

/** Audiencia de los planes que le tocan a cada rol. */
export type AudienciaPlan = 'empresa' | 'usuario';

export function audienciaParaRol(rol: number): AudienciaPlan {
  return rol === Number(RoleId.Empresa) ? 'empresa' : 'usuario';
}
