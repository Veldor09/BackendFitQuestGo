/** Estados posibles de una alerta comunitaria. */
export enum EstadoAlerta {
  Activa = 'Activa',
  Resuelta = 'Resuelta',
}

/** Gravedad reportada por quien crea la alerta; determina el TTL por defecto. */
export enum GravedadAlerta {
  Baja = 'baja',
  Media = 'media',
  Alta = 'alta',
}

/** Horas de vigencia por gravedad (ALR-02 "severidad / TTL"). */
export const TTL_HORAS_POR_GRAVEDAD: Record<GravedadAlerta, number> = {
  [GravedadAlerta.Baja]: 2,
  [GravedadAlerta.Media]: 6,
  [GravedadAlerta.Alta]: 24,
};

/** Cuantos "ya no esta" seguidos resuelven la alerta sola (ALR-05). */
export const UMBRAL_DESMENTIDOS = 3;
