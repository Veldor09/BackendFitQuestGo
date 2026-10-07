import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  MAX_NOMBRE_COMERCIAL,
  MENSAJE_TELEFONO_INVALIDO,
  TELEFONO_REGEX,
} from '../../../common/reglas-usuario';

/** Alta de una cuenta Empresa (modulo 5): comercios que publican eventos y nodos. */
export class RegistroEmpresaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre comercial es obligatorio' })
  @MinLength(2, { message: 'El nombre comercial es muy corto' })
  @MaxLength(MAX_NOMBRE_COMERCIAL, {
    message: `El nombre comercial admite maximo ${MAX_NOMBRE_COMERCIAL} caracteres`,
  })
  @Matches(/\S/, { message: 'El nombre comercial es obligatorio' })
  nombreComercial: string;

  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  @MaxLength(100)
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72)
  contrasena: string;

  @IsOptional()
  @Matches(TELEFONO_REGEX, { message: MENSAJE_TELEFONO_INVALIDO })
  telefono?: string;

  @IsBoolean({ message: 'aceptaTerminos debe ser booleano' })
  @Equals(true, { message: 'Debes aceptar los terminos y condiciones' })
  aceptaTerminos: boolean;
}
