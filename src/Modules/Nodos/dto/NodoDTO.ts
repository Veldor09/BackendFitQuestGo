import { PartialType } from '@nestjs/mapped-types';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CategoriaNodo, MAX_CATEGORIA_OTRO } from '../categoria-nodo.enum';
import { EstadoNodo } from '../estado-nodo.enum';

export class CrearNodoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(100, { message: 'El nombre admite maximo 100 caracteres' })
  nombre: string;

  @IsEnum(CategoriaNodo, { message: 'La categoria no es valida' })
  categoria: CategoriaNodo;

  /** Solo cuando `categoria` es `otro`: de que categoria se trata. */
  @ValidateIf((o: CrearNodoDto) => o.categoria === CategoriaNodo.Otro)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/\S/, { message: 'Escribi de que categoria se trata' })
  @MaxLength(MAX_CATEGORIA_OTRO, {
    message: `La categoria admite maximo ${MAX_CATEGORIA_OTRO} caracteres`,
  })
  categoriaOtro?: string;

  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat: number;

  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripcion admite maximo 500 caracteres' })
  descripcion?: string;

  /** Cupon o beneficio: solo lo guardan las cuentas Empresa (modulo 5). */
  @IsOptional()
  @IsString()
  @MaxLength(300, { message: 'El beneficio admite maximo 300 caracteres' })
  beneficio?: string;
}

export class ActualizarNodoDto extends PartialType(CrearNodoDto) {}

/** Posicion de quien vota: el servidor valida que este cerca del punto. */
export class VotarNodoDto {
  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat: number;

  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng: number;
}

export class CambiarEstadoNodoDto {
  @IsEnum(EstadoNodo, {
    message: 'El estado debe ser Pendiente, Aprobado, Rechazado u Obsoleto',
  })
  estado: EstadoNodo;
}
