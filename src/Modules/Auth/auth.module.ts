import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../Usuarios/user.module';
import { SeguridadModule } from './seguridad.module';
import { Auth } from './auth.entity';
import { RestablecimientoContrasena } from './entities/restablecimiento-contrasena.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensServicio } from './services/tokens.service';
import { MailService } from './services/mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Auth, RestablecimientoContrasena]),
    SeguridadModule,
    UserModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, TokensServicio, MailService],
})
export class AuthModule {}
