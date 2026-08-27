import { IsNotEmpty, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  nombreUser: string;

  @IsString()
  @IsNotEmpty()
  emailUser: string;

  @IsString()
  @IsNotEmpty()
  passwordUserHash: string;
}
