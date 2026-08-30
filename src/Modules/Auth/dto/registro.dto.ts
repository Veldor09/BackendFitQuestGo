import {IsEmail,IsNotEmpty,IsString,MaxLength,MinLength,} from 'class-validator';

export class RegistroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsEmail()
  @MaxLength(100)
  email: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  contrasena: string;
}
