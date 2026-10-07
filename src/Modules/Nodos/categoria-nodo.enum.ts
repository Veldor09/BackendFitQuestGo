/**
 * Categorias de un punto de interes, de lista cerrada: se elige, no se
 * escribe, para que "Agua" / "agua potable" / "Fuente" no sean tres cosas
 * distintas (y para poder filtrar el mapa por categoria). Las claves son
 * estables; la app las traduce (es / en / pt-BR). Si ninguna encaja, `otro` +
 * `categoriaOtro` con el texto que escribio la persona.
 */
export enum CategoriaNodo {
  Agua = 'agua',
  Mirador = 'mirador',
  Taller = 'taller',
  Restaurante = 'restaurante',
  Comercio = 'comercio',
  Banos = 'banos',
  Parqueo = 'parqueo',
  PrimerosAuxilios = 'primeros_auxilios',
  Otro = 'otro',
}

/** Largo maximo del texto que se escribe cuando la categoria es `otro`. */
export const MAX_CATEGORIA_OTRO = 50;
