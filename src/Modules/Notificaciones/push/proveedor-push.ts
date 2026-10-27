/** Lo que se le manda a un telefono. */
export interface MensajePush {
  token: string;
  titulo: string;
  cuerpo: string;
  /** Solo texto: Firebase no acepta otros tipos en `data`. */
  datos: Record<string, string>;
  /** Un aviso nuevo con la misma clave reemplaza al anterior en la bandeja. */
  colapsarClave?: string;
}

/**
 * - `enviado`: el proveedor lo acepto.
 * - `token_invalido`: el telefono ya no existe (desinstalo la app): hay que
 *   olvidar el token.
 * - `omitido`: no hay proveedor configurado, no se mando nada.
 * - `error`: fallo pasajero; no se reintenta (el aviso sigue en el centro de
 *   notificaciones de la app).
 */
export type ResultadoPush = 'enviado' | 'token_invalido' | 'omitido' | 'error';

export interface ProveedorPush {
  enviar(mensaje: MensajePush): Promise<ResultadoPush>;
}

export const PROVEEDOR_PUSH = Symbol('PROVEEDOR_PUSH');

/**
 * Sin credenciales de Firebase todo el sistema de avisos funciona igual (la
 * bandeja de la app no depende de esto): simplemente no sale nada del telefono.
 */
export class ProveedorPushNulo implements ProveedorPush {
  enviar(): Promise<ResultadoPush> {
    return Promise.resolve('omitido');
  }
}
