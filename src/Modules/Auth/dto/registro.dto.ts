import {IsEmail,IsNotEmpty,IsString,Matches,MaxLength,MinLength,} from 'class-validator';
import {
  MAX_NOMBRE_USUARIO,
  MENSAJE_NOMBRE_INVALIDO,
  NOMBRE_PERSONA_REGEX,
} from '../../../common/reglas-usuario';

export class RegistroDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(MAX_NOMBRE_USUARIO, {
    message: `El nombre admite maximo ${MAX_NOMBRE_USUARIO} caracteres`,
  })
  @Matches(NOMBRE_PERSONA_REGEX, { message: MENSAJE_NOMBRE_INVALIDO })
  nombre: string;

  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  @MaxLength(100)
  email: string;

  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72)
  contrasena: string;
}
