import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../Usuarios/user.module';
import { SeguridadModule } from './seguridad.module';
import { Auth } from './auth.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ContrasenasServicio } from './services/contrasenas.service';
import { TokensServicio } from './services/tokens.service';

@Module({
  imports: [TypeOrmModule.forFeature([Auth]), SeguridadModule, UserModule],
  controllers: [AuthController],
  providers: [AuthService, ContrasenasServicio, TokensServicio],
})
export class AuthModule {}
