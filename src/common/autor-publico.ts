import { Transform } from 'class-transformer';

/** Lo unico de una persona que se publica junto a lo que creo. */
export interface AutorPublico {
  id: number;
  nombreUser?: string;
}

function resumirAutor(valor: unknown): unknown {
  if (valor === null || typeof valor !== 'object') {
    return valor;
  }
  const { id, nombreUser } = valor as { id: number; nombreUser?: string };
  return nombreUser === undefined ? { id } : { id, nombreUser };
}

/**
 * Para la relacion `creadoPor` de lo que ve la comunidad (alertas, puntos de
 * interes, rutas): al armar la respuesta de quien lo creo solo salen su `id` y
 * su nombre. La relacion se carga entera (`eager`), y sin esto cualquiera que
 * mirara el mapa recibiria tambien su correo, su rol y el estado de su cuenta.
 *
 * Vale para toda respuesta que pase por el `ClassSerializerInterceptor` global,
 * sin que cada consulta tenga que recortar la relacion a mano.
 */
export const SoloAutorPublico = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) => resumirAutor(value), {
    toPlainOnly: true,
  });
