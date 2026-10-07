import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  MAX_NOMBRE_COMERCIAL,
  MENSAJE_TELEFONO_INVALIDO,
  TELEFONO_REGEX,
} from '../../../common/reglas-usuario';

/**
 * Datos que una cuenta Empresa puede cambiar de si misma. Lo que no se envia
 * queda como estaba. El correo no se cambia aqui: viaja en el token de sesion.
 */
export class ActualizarPerfilEmpresaDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'El nombre comercial es muy corto' })
  @MaxLength(MAX_NOMBRE_COMERCIAL, {
    message: `El nombre comercial admite maximo ${MAX_NOMBRE_COMERCIAL} caracteres`,
  })
  @Matches(/\S/, { message: 'El nombre comercial es obligatorio' })
  nombreComercial?: string;

  /** Texto vacio borra el telefono. */
  @ValidateIf(
    (o: ActualizarPerfilEmpresaDto) =>
      o.telefono !== undefined && o.telefono !== '',
  )
  @Matches(TELEFONO_REGEX, { message: MENSAJE_TELEFONO_INVALIDO })
  telefono?: string;
}
