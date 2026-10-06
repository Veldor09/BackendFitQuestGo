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
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ActividadRuta } from '../actividad-ruta.enum';
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
  @IsEnum(ActividadRuta, {
    each: true,
    message: 'Alguna actividad no es valida',
  })
  actividades: ActividadRuta[];

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
}

export class CambiarEstadoRutaDto {
  @IsEnum(EstadoRuta, {
    message: 'El estado debe ser Privada, Pendiente, Publicada o Rechazada',
  })
  estado: EstadoRuta;
}
