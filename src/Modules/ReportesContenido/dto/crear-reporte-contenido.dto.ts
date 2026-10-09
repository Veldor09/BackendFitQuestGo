import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoContenidoReportado } from '../tipo-contenido-reportado.enum';

export class CrearReporteContenidoDto {
  @IsEnum(TipoContenidoReportado)
  tipoContenido: TipoContenidoReportado;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  contenidoId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;
}
