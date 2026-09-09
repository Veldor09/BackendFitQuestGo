import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthConfig } from './auth.config';
import { GuardiaJwt } from './guards/jwt.guard';
import { GuardiaRoles } from './guards/roles.guard';
import { ContrasenasServicio } from './services/contrasenas.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthConfig, GuardiaJwt, GuardiaRoles, ContrasenasServicio],
  exports: [
    AuthConfig,
    GuardiaJwt,
    GuardiaRoles,
    ContrasenasServicio,
    JwtModule,
  ],
})
export class SeguridadModule {}
