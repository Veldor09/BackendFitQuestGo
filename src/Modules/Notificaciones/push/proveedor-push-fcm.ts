import { Logger } from '@nestjs/common';
import { createSign } from 'crypto';
import {
  MensajePush,
  ProveedorPush,
  ProveedorPushNulo,
  ResultadoPush,
} from './proveedor-push';

const ALCANCE_FCM = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URI_POR_DEFECTO = 'https://oauth2.googleapis.com/token';
/** Se renueva el token de acceso un minuto antes de que venza. */
const MARGEN_MS = 60_000;

/** Los campos que usamos del JSON de la cuenta de servicio de Firebase. */
export interface CuentaServicioFirebase {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

type Fetch = typeof fetch;

/**
 * Lee la cuenta de servicio de Firebase del entorno: el JSON tal cual
 * (`FIREBASE_SERVICE_ACCOUNT_JSON`) o en base64 (`FIREBASE_SERVICE_ACCOUNT_BASE64`,
 * mas comodo en Render). `null` si no hay o esta incompleta.
 */
export function leerCuentaServicio(
  env: NodeJS.ProcessEnv = process.env,
): CuentaServicioFirebase | null {
  const crudo =
    env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
    (env.FIREBASE_SERVICE_ACCOUNT_BASE64
      ? Buffer.from(env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString(
          'utf8',
        )
      : '');
  if (!crudo) return null;
  try {
    const cuenta = JSON.parse(crudo) as Partial<CuentaServicioFirebase>;
    if (!cuenta.project_id || !cuenta.client_email || !cuenta.private_key) {
      return null;
    }
    return {
      project_id: cuenta.project_id,
      client_email: cuenta.client_email,
      // En una variable de entorno los saltos de linea suelen llegar escapados.
      private_key: cuenta.private_key.replace(/\\n/g, '\n'),
      token_uri: cuenta.token_uri,
    };
  } catch {
    return null;
  }
}

/** El proveedor que corresponde segun lo que haya en el entorno. */
export function crearProveedorPush(
  env: NodeJS.ProcessEnv = process.env,
): ProveedorPush {
  const logger = new Logger('ProveedorPush');
  const cuenta = leerCuentaServicio(env);
  if (cuenta) {
    logger.log(`Avisos fuera de la app: Firebase (${cuenta.project_id})`);
    return new ProveedorPushFcm(cuenta);
  }
  if (
    env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    env.FIREBASE_SERVICE_ACCOUNT_BASE64
  ) {
    logger.warn(
      'La cuenta de servicio de Firebase esta incompleta o no es JSON valido: no se mandaran avisos fuera de la app.',
    );
  } else {
    logger.log(
      'Avisos fuera de la app desactivados (falta FIREBASE_SERVICE_ACCOUNT_*).',
    );
  }
  return new ProveedorPushNulo();
}

const base64Url = (datos: Buffer | string): string =>
  Buffer.from(datos)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

/**
 * Firebase Cloud Messaging por su API HTTP v1, sin librerias: se firma el JWT
 * de la cuenta de servicio con `crypto` y se pide el token de acceso a Google.
 */
export class ProveedorPushFcm implements ProveedorPush {
  private readonly logger = new Logger(ProveedorPushFcm.name);
  private acceso: { token: string; venceEn: number } | null = null;

  constructor(
    private readonly cuenta: CuentaServicioFirebase,
    private readonly peticion: Fetch = (
      url: string | URL | Request,
      init?: RequestInit,
    ) => fetch(url, init),
    private readonly ahora: () => number = () => Date.now(),
  ) {}

  async enviar(mensaje: MensajePush): Promise<ResultadoPush> {
    try {
      const respuesta = await this.peticion(
        `https://fcm.googleapis.com/v1/projects/${this.cuenta.project_id}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${await this.tokenAcceso()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: this.cuerpo(mensaje) }),
        },
      );
      if (respuesta.ok) return 'enviado';

      const detalle = await respuesta.text();
      if (this.tokenYaNoSirve(respuesta.status, detalle)) {
        return 'token_invalido';
      }
      // 401: el token de acceso caduco antes de lo previsto; se pide otro la
      // proxima vez.
      if (respuesta.status === 401) this.acceso = null;
      this.logger.warn(
        `FCM respondio ${respuesta.status}: ${detalle.slice(0, 300)}`,
      );
      return 'error';
    } catch (error) {
      this.logger.warn(
        `No se pudo hablar con FCM: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 'error';
    }
  }

  private cuerpo(m: MensajePush): Record<string, unknown> {
    return {
      token: m.token,
      notification: { title: m.titulo, body: m.cuerpo },
      data: m.datos,
      android: {
        // NORMAL: no despierta el telefono a la fuerza; son avisos de estado,
        // no llamadas.
        priority: 'NORMAL',
        ...(m.colapsarClave
          ? {
              collapse_key: m.colapsarClave,
              notification: { tag: m.colapsarClave },
            }
          : {}),
      },
      ...(m.colapsarClave
        ? {
            apns: {
              headers: { 'apns-collapse-id': m.colapsarClave.slice(0, 64) },
            },
          }
        : {}),
    };
  }

  /**
   * Firebase avisa que el telefono ya no esta con 404 / UNREGISTERED; un token
   * mal formado llega como 400 INVALID_ARGUMENT que menciona el token.
   */
  private tokenYaNoSirve(estado: number, detalle: string): boolean {
    if (estado === 404 || detalle.includes('UNREGISTERED')) return true;
    return (
      estado === 400 &&
      detalle.includes('INVALID_ARGUMENT') &&
      /token/i.test(detalle)
    );
  }

  private async tokenAcceso(): Promise<string> {
    if (this.acceso && this.acceso.venceEn - MARGEN_MS > this.ahora()) {
      return this.acceso.token;
    }
    const uri = this.cuenta.token_uri ?? TOKEN_URI_POR_DEFECTO;
    const ahoraS = Math.floor(this.ahora() / 1000);
    const cabecera = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const carga = base64Url(
      JSON.stringify({
        iss: this.cuenta.client_email,
        scope: ALCANCE_FCM,
        aud: uri,
        iat: ahoraS,
        exp: ahoraS + 3600,
      }),
    );
    const firma = createSign('RSA-SHA256')
      .update(`${cabecera}.${carga}`)
      .sign(this.cuenta.private_key);
    const respuesta = await this.peticion(uri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${cabecera}.${carga}.${base64Url(firma)}`,
      }).toString(),
    });
    if (!respuesta.ok) {
      throw new Error(
        `Google rechazo la cuenta de servicio (${respuesta.status})`,
      );
    }
    const cuerpo = (await respuesta.json()) as {
      access_token: string;
      expires_in?: number;
    };
    this.acceso = {
      token: cuerpo.access_token,
      venceEn: this.ahora() + (cuerpo.expires_in ?? 3600) * 1000,
    };
    return this.acceso.token;
  }
}
