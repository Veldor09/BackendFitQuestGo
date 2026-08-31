import { PartialType } from '@nestjs/mapped-types';
import {IsEmail,IsEnum,IsNotEmpty,IsString,MaxLength,MinLength,} from 'class-validator';
import { RoleId } from '../roles.enum';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombreUser: string;

  @IsEmail()
  @MaxLength(100)
  emailUser: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  passwordUserHash: string;

  // La columna idrol es NOT NULL, asi que el rol es obligatorio al crear.
  @IsEnum(RoleId, {
    message: 'idrol debe ser 1 (UserNormal), 2 (Empresa) o 3 (Admin)',
  })
  idrol: RoleId;
}

// Todos los campos de CreateUserDto pero opcionales, conservando sus validaciones.
export class UpdateUserDto extends PartialType(CreateUserDto) {}
