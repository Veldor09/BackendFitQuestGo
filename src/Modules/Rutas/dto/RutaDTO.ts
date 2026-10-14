
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { EstadoRuta } from '../estado-ruta.enum';

export class PuntoRutaDto {
  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat: number;

  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng: number;
}

export class CrearRutaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre admite maximo 100 caracteres' })
  nombre: string;

  @IsArray({ message: 'Las actividades deben ser una lista' })
  @ArrayMinSize(1, { message: 'Elegi al menos una actividad' })
  @ArrayUnique({ message: 'No repitas actividades' })
  @IsString({
    each: true,
    message: 'Las actividades deben ser texto',
  })
  @Matches(/^[a-z][a-z0-9_]*$/, {
    each: true,
    message: 'Alguna actividad no tiene una clave valida',
  })
  @MaxLength(50, {
    each: true,
    message: 'Las actividades admiten maximo 50 caracteres',
  })
  actividades: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'La dificultad admite maximo 20 caracteres' })
  dificultad?: string;

  @IsNumber({}, { message: 'La distancia debe ser numerica' })
  @Min(0, { message: 'La distancia no puede ser negativa' })
  distanciaKm: number;

  @IsArray()
  @ArrayMinSize(2, { message: 'La ruta necesita al menos 2 puntos' })
  @ValidateNested({ each: true })
  @Type(() => PuntoRutaDto)
  puntos: PuntoRutaDto[];

  @IsOptional()
  @IsString()
  visibilidad?: string;
}

export class CambiarEstadoRutaDto {
  @IsEnum(EstadoRuta, {
    message: 'El estado debe ser Privada, Pendiente, Publicada o Rechazada',
  })
  estado: EstadoRuta;
}