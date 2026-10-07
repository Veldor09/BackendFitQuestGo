import { Transform } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

/**
 * En un query string todo llega como texto. Un valor vacio no puede volverse 0
 * (que seria una latitud valida): se deja sin definir para que falle como un
 * campo faltante.
 */
const numeroODefinir = ({ value }: { value: unknown }): unknown =>
  value === '' || value === undefined || value === null
    ? undefined
    : Number(value);

/** Zona de la que se piden las alertas del clima. */
export class ConsultaClimaDto {
  @Transform(numeroODefinir)
  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat: number;

  @Transform(numeroODefinir)
  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng: number;
}
