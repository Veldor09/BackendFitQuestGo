/**
 * Estados posibles de un punto de interes propuesto por un usuario. `Obsoleto`
 * lo pone la gente al votar "ya no existe" (o un admin): sale del mapa, igual
 * que uno `Rechazado`, pero porque dejo de existir y no porque no cumpliera.
 */
export enum EstadoNodo {
  Pendiente = 'Pendiente',
  Aprobado = 'Aprobado',
  Rechazado = 'Rechazado',
  Obsoleto = 'Obsoleto',
}

/** Sentido del voto de una persona sobre un punto de interes del mapa. */
export enum TipoVotoNodo {
  Confirmar = 'confirmar',
  Obsoleto = 'obsoleto',
}

/**
 * Cuantos "ya no existe" hacen falta para retirar un punto del mapa; ademas
 * tienen que superar a los "sigue ahi".
 */
export const UMBRAL_OBSOLETO = 3;
