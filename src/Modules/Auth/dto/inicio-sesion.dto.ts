import {IsEmail,IsNotEmpty,IsString,} from 'class-validator';

export class InicioSesionDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  contrasena: string;
}
