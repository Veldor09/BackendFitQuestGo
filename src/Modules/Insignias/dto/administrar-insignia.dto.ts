
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TipoInsignia } from '../insignia.enum';
import { MetricaInsignia } from '../insignia.entity';

const limpiarTexto = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

const normalizarCodigo = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CrearInsigniaDto {
  @Transform(normalizarCodigo)
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message:
      'El código solo admite letras mayúsculas, números y guiones bajos',
  })
  codigo: string;

  @Transform(limpiarTexto)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @Transform(limpiarTexto)
  @IsString()
  @IsNotEmpty()
  descripcion: string;

  @Transform(limpiarTexto)
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  emoji: string;

  @IsEnum(TipoInsignia)
  tipo: TipoInsignia;

  @IsEnum(MetricaInsignia)
  metrica: MetricaInsignia;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  meta: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class EditarInsigniaDto {
  @Transform(limpiarTexto)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre?: string;

  @Transform(limpiarTexto)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  descripcion?: string;

  @Transform(limpiarTexto)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  emoji?: string;

  @IsOptional()
  @IsEnum(TipoInsignia)
  tipo?: TipoInsignia;

  @IsOptional()
  @IsEnum(MetricaInsignia)
  metrica?: MetricaInsignia;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  meta?: number;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}
