import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class RegistrarDispositivoDto {
  @IsString({ message: 'El token del dispositivo debe ser un texto' })
  @Length(20, 512, {
    message: 'El token del dispositivo debe tener entre 20 y 512 caracteres',
  })
  token: string;

  @IsIn(['android', 'ios'], {
    message: 'La plataforma debe ser android o ios',
  })
  plataforma: 'android' | 'ios';

  /** Idioma de la app en el telefono; si falta o es desconocido, español. */
  @IsOptional()
  @IsString({ message: 'El idioma debe ser un texto' })
  @Length(2, 5, { message: 'El idioma debe tener entre 2 y 5 caracteres' })
  idioma?: string;
}

export class QuitarDispositivoDto {
  @IsString({ message: 'El token del dispositivo debe ser un texto' })
  @Length(20, 512, {
    message: 'El token del dispositivo debe tener entre 20 y 512 caracteres',
  })
  token: string;
}
