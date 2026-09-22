import { PartialType } from '@nestjs/mapped-types';
import {IsDate,IsEmail,IsEnum,IsNotEmpty,IsOptional,IsString,Matches,MaxLength,MinLength,} from 'class-validator';
import {
  MAX_NOMBRE_USUARIO,
  MENSAJE_NOMBRE_INVALIDO,
  NOMBRE_PERSONA_REGEX,
} from '../../../common/reglas-usuario';
import { EstadoUsuario } from '../estado.enum';
import { RoleId } from '../roles.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @MaxLength(MAX_NOMBRE_USUARIO, {
    message: `El nombre admite maximo ${MAX_NOMBRE_USUARIO} caracteres`,
  })
  @Matches(NOMBRE_PERSONA_REGEX, { message: MENSAJE_NOMBRE_INVALIDO })
  nombreUser: string;

  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  @MaxLength(100, { message: 'El correo admite maximo 100 caracteres' })
  emailUser: string;

  @IsString()
  @IsNotEmpty({ message: 'La contrasena es obligatoria' })
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  passwordUserHash: string;

  // La columna idrol es NOT NULL, asi que el rol es obligatorio al crear.
  @IsEnum(RoleId, {
    message: 'El rol debe ser Usuario (1), Empresa (2) o Admin (3)',
  })
  idrol: RoleId;

  // Solo lo setea AuthService.registrar() con la fecha del momento; un admin
  // creando una cuenta desde el panel no lo envia (queda NULL).
  @IsOptional()
  @IsDate()
  terminosAceptadosEn?: Date;
}

// Todos los campos de CreateUserDto pero opcionales, conservando sus validaciones.
export class UpdateUserDto extends PartialType(CreateUserDto) {}

export class CambiarEstadoDto {
  @IsEnum(EstadoUsuario, {
    message: 'El estado debe ser Activado o Desactivado',
  })
  estado: EstadoUsuario;
}
