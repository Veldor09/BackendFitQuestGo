/** Que se califica. Las areas de un evento se califican con `Evento` y `area`. */
export enum TipoCalificable {
  Ruta = 'ruta',
  Nodo = 'nodo',
  Evento = 'evento',
}

/** Sentido de la calificacion (pulgar arriba o abajo). */
export enum ValorCalificacion {
  Arriba = 'arriba',
  Abajo = 'abajo',
}

/** Lo que manda la app: un valor, o "ninguno" para retirar la calificacion. */
export const RETIRAR_CALIFICACION = 'ninguno';
