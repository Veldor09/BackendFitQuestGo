import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { MotivoReporte } from '../motivo-reporte.enum';
import { TipoContenidoReportado } from '../tipo-contenido-reportado.enum';

export class CrearReporteContenidoDto {
  @IsEnum(TipoContenidoReportado)
  tipoContenido: TipoContenidoReportado;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  contenidoId: number;

  @IsEnum(MotivoReporte, { message: 'El motivo no es valido' })
  motivo: MotivoReporte;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  descripcion?: string;

  @IsOptional()
  @IsBoolean()
  esFoto?: boolean;
}
