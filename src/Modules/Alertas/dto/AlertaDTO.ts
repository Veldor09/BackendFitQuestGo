import {
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { EstadoAlerta, GravedadAlerta } from '../estado-alerta.enum';

export class CrearAlertaDto {
  @IsString()
  @IsNotEmpty({ message: 'El tipo es obligatorio' })
  @MaxLength(50, { message: 'El tipo admite maximo 50 caracteres' })
  tipo: string;

  @IsEnum(GravedadAlerta, { message: 'La gravedad debe ser baja, media o alta' })
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

export class CambiarEstadoAlertaDto {
  @IsEnum(EstadoAlerta, { message: 'El estado debe ser Activa o Resuelta' })
  estado: EstadoAlerta;
}
