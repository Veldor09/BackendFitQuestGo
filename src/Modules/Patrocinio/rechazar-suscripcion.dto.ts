
import {
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class RechazarSuscripcionDto {
  @IsString({
    message: 'El motivo del rechazo debe ser un texto',
  })
  @MinLength(10, {
    message: 'El motivo del rechazo debe tener al menos 10 caracteres',
  })
  @MaxLength(500, {
    message: 'El motivo del rechazo no puede superar los 500 caracteres',
  })
  @Matches(/\S/, {
    message: 'El motivo del rechazo no puede contener solamente espacios',
  })
  motivo: string;
}
