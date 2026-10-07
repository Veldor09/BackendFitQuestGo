import {
  IsEmail,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RestablecerContrasenaDto {
  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  @MaxLength(100)
  email: string;

  @IsString()
  @Length(6, 6, { message: 'El codigo debe tener 6 digitos' })
  codigo: string;

  @IsString()
  @MinLength(8, { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72)
  nuevaContrasena: string;
}
