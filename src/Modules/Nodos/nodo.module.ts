import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Nodo } from './nodo.entity';
import { NodoFoto } from './nodo-foto.entity';
import { NodoVoto } from './nodo-voto.entity';
import { NodoController } from './nodo.controller';
import { NodoService } from './nodo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Nodo, NodoFoto, NodoVoto]),
    SeguridadModule,
  ],
  controllers: [NodoController],
  providers: [NodoService],
})
export class NodoModule {}
