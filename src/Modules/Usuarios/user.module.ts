import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleModule } from './roles.module';
import { SeguridadModule } from '../Auth/seguridad.module';
import { UserController } from './user.controller';
import { User } from './user.entity';
import { UsuarioFoto } from './usuario-foto.entity';
import { UserService } from './user.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, UsuarioFoto]), RoleModule, SeguridadModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
