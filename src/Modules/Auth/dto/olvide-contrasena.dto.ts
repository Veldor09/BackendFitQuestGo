import { IsEmail, MaxLength } from 'class-validator';

export class OlvideContrasenaDto {
  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  @MaxLength(100)
  email: string;
}
