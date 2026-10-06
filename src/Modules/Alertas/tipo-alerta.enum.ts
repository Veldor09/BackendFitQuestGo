/**
 * Tipos de alerta de lista cerrada: el usuario elige, no escribe, para evitar
 * errores de tipeo ("Arbol caido" / "arbol caído" / "arbol"). Las claves son
 * estables (no cambian con el idioma); la app las traduce (es / en / pt-BR).
 * Si ninguna encaja, `otro` + `tipoOtro` con el texto que escribio la persona.
 */
export enum TipoAlerta {
  ArbolCaido = 'arbol_caido',
  Bache = 'bache',
  Derrumbe = 'derrumbe',
  Inundacion = 'inundacion',
  Perro = 'perro',
  ViaCerrada = 'via_cerrada',
  Accidente = 'accidente',
  ZonaInsegura = 'zona_insegura',
  CableCaido = 'cable_caido',
  Otro = 'otro',
}

/** Largo maximo del texto que se escribe cuando el tipo es `otro`. */
export const MAX_TIPO_OTRO = 50;
