import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { InsigniasModule } from '../Insignias/insignias.module';
import { Nodo } from './nodo.entity';
import { NodoFoto } from './nodo-foto.entity';
import { NodoVoto } from './nodo-voto.entity';
import { NodoController } from './nodo.controller';
import { NodoService } from './nodo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Nodo, NodoFoto, NodoVoto]),
    SeguridadModule,
    InsigniasModule,
  ],
  controllers: [NodoController],
  providers: [NodoService],
  exports: [NodoService],
})
export class NodoModule {}

