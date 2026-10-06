import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { clasificarPronostico } from './clasificador-clima';
import { AlertaClima } from './clima.tipos';
import { ErrorProveedorClima, OpenMeteoCliente } from './open-meteo.cliente';

export interface RespuestaClima {
  alertas: AlertaClima[];
  /** Quien aporta los datos (Open-Meteo pide dar credito). */
  fuente: string;
  /** Cuando se consulto al proveedor (ISO 8601). */
  actualizadoEn: string;
}

/** El clima de una zona cambia despacio: se reutiliza 10 minutos. */
export const VIGENCIA_CACHE_MS = 10 * 60 * 1000;

/** Tope de zonas en memoria: las coordenadas las manda el cliente. */
export const MAX_ZONAS_EN_CACHE = 200;

const FUENTE = 'Open-Meteo';

/**
 * Redondear a 2 decimales (~1.1 km) agrupa a quienes estan en la misma zona en
 * una sola consulta y evita mandarle al proveedor la posicion exacta de nadie.
 */
const aZona = (grados: number): number => Math.round(grados * 100) / 100;

@Injectable()
export class ClimaService {
  private readonly logger = new Logger(ClimaService.name);
  private readonly zonas = new Map<
    string,
    { vence: number; respuesta: RespuestaClima }
  >();
  private readonly enCurso = new Map<string, Promise<RespuestaClima>>();

  constructor(private readonly proveedor: OpenMeteoCliente) {}

  /** Avisos de lluvia fuerte, tormenta o calor extremo en la zona de `lat`, `lng`. */
  alertas(lat: number, lng: number): Promise<RespuestaClima> {
    const latZona = aZona(lat);
    const lngZona = aZona(lng);
    const clave = `${latZona},${lngZona}`;

    const guardada = this.zonas.get(clave);
    if (guardada && guardada.vence > Date.now()) {
      return Promise.resolve(guardada.respuesta);
    }
    const pendiente = this.enCurso.get(clave);
    if (pendiente) {
      return pendiente;
    }
    const consulta = this.consultar(clave, latZona, lngZona).finally(() =>
      this.enCurso.delete(clave),
    );
    this.enCurso.set(clave, consulta);
    return consulta;
  }

  private async consultar(
    clave: string,
    lat: number,
    lng: number,
  ): Promise<RespuestaClima> {
    try {
      const horas = await this.proveedor.pronostico(lat, lng);
      const respuesta: RespuestaClima = {
        alertas: clasificarPronostico(horas),
        fuente: FUENTE,
        actualizadoEn: new Date(Date.now()).toISOString(),
      };
      this.guardar(clave, respuesta);
      return respuesta;
    } catch (error) {
      if (error instanceof ErrorProveedorClima) {
        // Un proveedor caido no debe romper la app: se registra y se responde 503.
        this.logger.warn(error.message);
        throw new ServiceUnavailableException(
          'El servicio del clima no esta disponible',
        );
      }
      throw error;
    }
  }

  private guardar(clave: string, respuesta: RespuestaClima): void {
    // Borrar antes de insertar la deja como la mas reciente del Map.
    this.zonas.delete(clave);
    this.zonas.set(clave, {
      vence: Date.now() + VIGENCIA_CACHE_MS,
      respuesta,
    });
    while (this.zonas.size > MAX_ZONAS_EN_CACHE) {
      const [masAntigua] = this.zonas.keys();
      this.zonas.delete(masAntigua);
    }
  }
}
