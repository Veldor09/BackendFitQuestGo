/** Lo que la app avisa del clima de la zona. */
export enum TipoAlertaClima {
  /** Lluvia fuerte (mm/h altos o codigos de lluvia intensa). */
  Lluvia = 'lluvia',
  /** Tormenta electrica: el riesgo principal al aire libre son los rayos. */
  Tormenta = 'tormenta',
  /** Calor extremo, medido por la sensacion termica. */
  Calor = 'calor',
}

export enum NivelAlertaClima {
  Precaucion = 'precaucion',
  Peligro = 'peligro',
}

/** Una hora del pronostico, ya reducida a lo que se usa para avisar. */
export interface HoraPronostico {
  /** Lluvia (mm) de esa hora; null si el proveedor no la informa. */
  precipitacionMmH: number | null;
  /** Sensacion termica (°C): temperatura, humedad y viento juntos. */
  sensacionC: number | null;
  /** Codigo de tiempo presente de la OMM (WMO), p. ej. 95 = tormenta. */
  codigoWmo: number | null;
}

export interface AlertaClima {
  tipo: TipoAlertaClima;
  nivel: NivelAlertaClima;
  /** 0 = ahora; 1..3 = dentro de tantas horas. */
  enHoras: number;
  /** mm/h para la lluvia, °C para el calor; null en la tormenta. */
  valor: number | null;
}
