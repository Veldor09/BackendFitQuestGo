import { IsOptional, IsString } from 'class-validator';

export class RenovarDto {
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
