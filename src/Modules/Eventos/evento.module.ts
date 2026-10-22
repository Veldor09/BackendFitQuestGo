import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { PatrocinioModule } from '../Patrocinio/patrocinio.module';
import { Evento } from './evento.entity';
import { EventoFoto } from './evento-foto.entity';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evento, EventoFoto]),
    SeguridadModule,
    PatrocinioModule,
  ],
  controllers: [EventoController],
  providers: [EventoService],
})
export class EventoModule {}
