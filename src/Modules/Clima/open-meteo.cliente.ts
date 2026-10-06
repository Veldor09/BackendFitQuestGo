import { Injectable } from '@nestjs/common';
import { HoraPronostico } from './clima.tipos';

/** El proveedor del clima no contesto o contesto algo que no se entiende. */
export class ErrorProveedorClima extends Error {}

// Open-Meteo: API publica y gratuita (sin clave) para uso no comercial.
const URL_POR_DEFECTO = 'https://api.open-meteo.com/v1/forecast';

/** Cuanto se espera al proveedor antes de rendirse. */
const ESPERA_MAXIMA_MS = 5000;

/** La hora actual y las 3 siguientes. */
const HORAS_PRONOSTICO = 4;

const numeroONull = (valor: unknown): number | null =>
  typeof valor === 'number' && Number.isFinite(valor) ? valor : null;

const mensajeDe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function horasDe(cuerpo: unknown): HoraPronostico[] {
  const porHora = (cuerpo as { hourly?: Record<string, unknown> } | null)
    ?.hourly;
  const tiempos = porHora?.time;
  const lluvia = porHora?.precipitation;
  const sensacion = porHora?.apparent_temperature;
  const codigos = porHora?.weather_code;
  if (
    !Array.isArray(tiempos) ||
    !Array.isArray(lluvia) ||
    !Array.isArray(sensacion) ||
    !Array.isArray(codigos) ||
    tiempos.length === 0
  ) {
    throw new ErrorProveedorClima(
      'La respuesta del clima no trae el pronostico por horas',
    );
  }
  return tiempos.map((_, i) => ({
    precipitacionMmH: numeroONull(lluvia[i]),
    sensacionC: numeroONull(sensacion[i]),
    codigoWmo: numeroONull(codigos[i]),
  }));
}

/** Pronostico por horas de una zona, tomado de Open-Meteo. */
@Injectable()
export class OpenMeteoCliente {
  /**
   * La hora actual y las 3 siguientes (la primera es "ahora"). `CLIMA_API_URL`
   * permite apuntar a otro proveedor con el mismo formato, o a un simulador.
   */
  async pronostico(lat: number, lng: number): Promise<HoraPronostico[]> {
    const url = new URL(process.env.CLIMA_API_URL ?? URL_POR_DEFECTO);
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lng));
    url.searchParams.set(
      'hourly',
      'precipitation,apparent_temperature,weather_code',
    );
    url.searchParams.set('forecast_hours', String(HORAS_PRONOSTICO));

    let respuesta: Response;
    try {
      respuesta = await fetch(url, {
        signal: AbortSignal.timeout(ESPERA_MAXIMA_MS),
      });
    } catch (error) {
      throw new ErrorProveedorClima(
        `No se pudo consultar el clima: ${mensajeDe(error)}`,
      );
    }
    if (!respuesta.ok) {
      throw new ErrorProveedorClima(
        `El proveedor del clima respondio ${respuesta.status}`,
      );
    }
    let cuerpo: unknown;
    try {
      cuerpo = await respuesta.json();
    } catch {
      throw new ErrorProveedorClima('La respuesta del clima no es JSON');
    }
    return horasDe(cuerpo);
  }
}
