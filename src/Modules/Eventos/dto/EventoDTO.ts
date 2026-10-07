import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CategoriaEvento } from '../categoria-evento.enum';

/** Tope de puntos por trazo: el front simplifica el dibujo a mano antes de enviarlo. */
export const MAX_PUNTOS_TRAZO = 1000;
/** Tope de areas (y de recorridos) por evento. */
export const MAX_TRAZOS_EVENTO = 20;

export class PuntoGeoDto {
  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat: number;

  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng: number;
}

class TrazoBaseDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del trazo es obligatorio' })
  @Matches(/\S/, { message: 'El nombre del trazo es obligatorio' })
  @MaxLength(100, {
    message: 'El nombre del trazo admite maximo 100 caracteres',
  })
  nombre: string;
}

/** Zona cerrada que la empresa encierra con el dedo: minimo un triangulo. */
export class AreaEventoDto extends TrazoBaseDto {
  @IsArray()
  @ArrayMinSize(3, { message: 'Un area necesita al menos 3 puntos' })
  @ArrayMaxSize(MAX_PUNTOS_TRAZO)
  @ValidateNested({ each: true })
  @Type(() => PuntoGeoDto)
  puntos: PuntoGeoDto[];
}

/** Linea que la empresa traza con el dedo: minimo dos puntos. */
export class RecorridoEventoDto extends TrazoBaseDto {
  @IsArray()
  @ArrayMinSize(2, { message: 'Un recorrido necesita al menos 2 puntos' })
  @ArrayMaxSize(MAX_PUNTOS_TRAZO)
  @ValidateNested({ each: true })
  @Type(() => PuntoGeoDto)
  puntos: PuntoGeoDto[];
}

export class CrearEventoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Matches(/\S/, { message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre admite maximo 100 caracteres' })
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripcion admite maximo 500 caracteres' })
  descripcion?: string;

  @IsEnum(CategoriaEvento, { message: 'La categoria no es valida' })
  categoria: CategoriaEvento;

  @Type(() => Date)
  @IsDate({ message: 'fechaInicio debe ser una fecha valida' })
  fechaInicio: Date;

  @Type(() => Date)
  @IsDate({ message: 'fechaFin debe ser una fecha valida' })
  fechaFin: Date;

  // Al menos un area o un recorrido: lo comprueba el servicio, porque depende
  // de dos campos a la vez (y, al editar, de lo que ya tenia el evento).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRAZOS_EVENTO)
  @ValidateNested({ each: true })
  @Type(() => AreaEventoDto)
  areas?: AreaEventoDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRAZOS_EVENTO)
  @ValidateNested({ each: true })
  @Type(() => RecorridoEventoDto)
  recorridos?: RecorridoEventoDto[];
}

export class ActualizarEventoDto extends PartialType(CrearEventoDto) {}
