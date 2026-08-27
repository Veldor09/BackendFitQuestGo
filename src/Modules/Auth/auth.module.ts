import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from '../Usuarios/user.module';
import { Auth } from './auth.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Auth]), UserModule],
  controllers: [],
  providers: [],
  exports: [TypeOrmModule],
})
export class AuthModule {}
