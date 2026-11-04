import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Evento } from './evento.entity';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';
import { EventoMailService } from './evento-mail.service';

@Module({
  imports: [TypeOrmModule.forFeature([Evento]), SeguridadModule],
  controllers: [EventoController],
  providers: [EventoService, EventoMailService],
})
export class EventoModule {}
