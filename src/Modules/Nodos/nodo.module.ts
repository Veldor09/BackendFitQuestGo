import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Nodo } from './nodo.entity';
import { NodoController } from './nodo.controller';
import { NodoService } from './nodo.service';

@Module({
  imports: [TypeOrmModule.forFeature([Nodo]), SeguridadModule],
  controllers: [NodoController],
  providers: [NodoService],
})
export class NodoModule {}
