/**
 * La pasarela que cobra las suscripciones en linea. Hoy es ONVO (Costa Rica,
 * colones: tarjeta y SINPE Movil). Va detras de una interfaz para que las
 * pruebas no toquen la red.
 */
export const PASARELA_PAGOS = Symbol('PASARELA_PAGOS');

export interface DatosSesionPago {
  /** Monto en la unidad de la moneda (2500 = ₡2.500). */
  monto: number;
  moneda: 'CRC';
  descripcion: string;
  clienteNombre: string;
  clienteEmail: string;
  /** A donde va la persona al pagar. */
  redirectUrl: string;
  /** A donde va si cancela. */
  cancelUrl: string;
  metadata: Record<string, string>;
}

export interface SesionPago {
  id: string;
  url: string;
}

export interface EstadoSesionPago {
  id: string;
  pagada: boolean;
  expirada: boolean;
  metadata: Record<string, string>;
}

export interface PasarelaPagos {
  /** Hay llaves configuradas: sin ellas no se puede cobrar. */
  readonly disponible: boolean;
  crearSesion(datos: DatosSesionPago): Promise<SesionPago>;
  obtenerSesion(id: string): Promise<EstadoSesionPago>;
}

const API_ONVO = 'https://api.onvopay.com';

/** ONVO recibe los montos en la unidad minima (centimos). */
const UNIDADES_MINIMAS = 100;

interface SesionOnvo {
  id?: string;
  url?: string;
  status?: string;
  paymentStatus?: string;
  metadata?: Record<string, string> | null;
}

export class PasarelaOnvo implements PasarelaPagos {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  get disponible(): boolean {
    return Boolean(this.env.ONVO_SECRET_KEY);
  }

  async crearSesion(datos: DatosSesionPago): Promise<SesionPago> {
    const sesion = await this.llamar(
      'POST',
      '/v1/checkout/sessions/one-time-link',
      {
        lineItems: [
          {
            quantity: 1,
            unitAmount: Math.round(datos.monto * UNIDADES_MINIMAS),
            currency: datos.moneda,
            description: datos.descripcion,
          },
        ],
        customerName: datos.clienteNombre,
        customerEmail: datos.clienteEmail,
        redirectUrl: datos.redirectUrl,
        cancelUrl: datos.cancelUrl,
        paymentMethodTypes: ['card', 'mobile_number'],
        metadata: datos.metadata,
      },
    );
    if (!sesion.id || !sesion.url) {
      throw new Error('ONVO no devolvio la sesion de pago');
    }
    return { id: sesion.id, url: sesion.url };
  }

  async obtenerSesion(id: string): Promise<EstadoSesionPago> {
    const sesion = await this.llamar(
      'GET',
      `/v1/checkout/sessions/${encodeURIComponent(id)}`,
    );
    return {
      id: sesion.id ?? id,
      pagada: sesion.paymentStatus === 'paid',
      expirada: sesion.status === 'expired',
      metadata: sesion.metadata ?? {},
    };
  }

  private async llamar(
    metodo: 'GET' | 'POST',
    ruta: string,
    cuerpo?: unknown,
  ): Promise<SesionOnvo> {
    const llave = this.env.ONVO_SECRET_KEY;
    if (!llave) throw new Error('ONVO no esta configurado');

    const respuesta = await this.fetchFn(`${API_ONVO}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${llave}`,
        'Content-Type': 'application/json',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    if (!respuesta.ok) {
      // Sin el cuerpo completo ni la llave: solo el estado y la ruta.
      throw new Error(
        `ONVO respondio ${respuesta.status} en ${metodo} ${ruta}`,
      );
    }
    return (await respuesta.json()) as SesionOnvo;
  }
}
