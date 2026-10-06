export type TipoImagen = 'image/jpeg' | 'image/png' | 'image/webp';

/** Tope de una foto de nodo. La app la reduce antes de subirla (~0.3-0.8 MB). */
export const MAX_FOTO_BYTES = 3 * 1024 * 1024;

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Tipo real de una imagen segun sus primeros bytes, o null si no es JPEG, PNG
 * ni WebP. El nombre o el `Content-Type` que declare quien sube el archivo no
 * cuentan: se pueden falsear, la firma del archivo no.
 */
export function detectarTipoImagen(datos: Buffer): TipoImagen | null {
  if (
    datos.length >= 3 &&
    datos[0] === 0xff &&
    datos[1] === 0xd8 &&
    datos[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (datos.length >= 8 && datos.subarray(0, 8).equals(FIRMA_PNG)) {
    return 'image/png';
  }
  if (
    datos.length >= 12 &&
    datos.toString('ascii', 0, 4) === 'RIFF' &&
    datos.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}
