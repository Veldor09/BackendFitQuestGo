import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthConfig } from './auth.config';
import { GuardiaJwt } from './guards/jwt.guard';
import { GuardiaRoles } from './guards/roles.guard';

@Module({
  imports: [JwtModule.register({})],
  providers: [AuthConfig, GuardiaJwt, GuardiaRoles],
  exports: [AuthConfig, GuardiaJwt, GuardiaRoles, JwtModule],
})
export class SeguridadModule {}
