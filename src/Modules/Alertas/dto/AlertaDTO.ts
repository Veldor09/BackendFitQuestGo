import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EstadoAlerta, GravedadAlerta } from '../estado-alerta.enum';
import { MAX_TIPO_OTRO, TipoAlerta } from '../tipo-alerta.enum';

export class CrearAlertaDto {
  @IsEnum(TipoAlerta, { message: 'El tipo de alerta no es valido' })
  tipo: TipoAlerta;

  /** Solo cuando `tipo` es `otro`: de que alerta se trata. */
  @ValidateIf((o: CrearAlertaDto) => o.tipo === TipoAlerta.Otro)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Matches(/\S/, { message: 'Escribi de que tipo de alerta se trata' })
  @MaxLength(MAX_TIPO_OTRO, {
    message: `El tipo admite maximo ${MAX_TIPO_OTRO} caracteres`,
  })
  tipoOtro?: string;

  @IsEnum(GravedadAlerta, {
    message: 'La gravedad debe ser baja, media o alta',
  })
  gravedad: GravedadAlerta;

  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat: number;

  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripcion admite maximo 500 caracteres' })
  descripcion?: string;
}

/** Posicion de quien vota: el servidor valida que este cerca de la alerta. */
export class VotarAlertaDto {
  @IsLatitude({ message: 'lat debe ser una latitud valida' })
  lat: number;

  @IsLongitude({ message: 'lng debe ser una longitud valida' })
  lng: number;
}

export class CambiarEstadoAlertaDto {
  // `Expirada` no se puede pedir: la pone sola la tarea programada.
  @IsIn([EstadoAlerta.Activa, EstadoAlerta.Resuelta], {
    message: 'El estado debe ser Activa o Resuelta',
  })
  estado: EstadoAlerta;
}
