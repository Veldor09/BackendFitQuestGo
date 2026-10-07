import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { InsigniasModule } from '../Insignias/insignias.module';
import { Nodo } from './nodo.entity';
import { NodoController } from './nodo.controller';
import { NodoService } from './nodo.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Nodo]),
    SeguridadModule,
    InsigniasModule,
  ],
  controllers: [NodoController],
  providers: [NodoService],
  exports: [NodoService],
})
export class NodoModule {}

