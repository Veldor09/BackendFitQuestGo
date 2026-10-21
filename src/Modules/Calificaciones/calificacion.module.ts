import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Evento } from '../Eventos/evento.entity';
import { Nodo } from '../Nodos/nodo.entity';
import { RecorridoRuta } from '../Rutas/recorrido-ruta.entity';
import { Ruta } from '../Rutas/ruta.entity';
import { Calificacion } from './calificacion.entity';
import { CalificacionController } from './calificacion.controller';
import { CalificacionService } from './calificacion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Calificacion, RecorridoRuta, Ruta, Nodo, Evento]),
    SeguridadModule,
  ],
  controllers: [CalificacionController],
  providers: [CalificacionService],
})
export class CalificacionModule {}
