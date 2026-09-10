import { PartialType } from '@nestjs/mapped-types';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstadoNodo } from '../estado-nodo.enum';

export class CrearNodoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre admite maximo 100 caracteres' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'La categoria es obligatoria' })
  @MaxLength(50, { message: 'La categoria admite maximo 50 caracteres' })
  categoria: string;

  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat: number;

  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripcion admite maximo 500 caracteres' })
  descripcion?: string;
}

export class ActualizarNodoDto extends PartialType(CrearNodoDto) {}

export class CambiarEstadoNodoDto {
  @IsEnum(EstadoNodo, {
    message: 'El estado debe ser Pendiente, Aprobado o Rechazado',
  })
  estado: EstadoNodo;
}
