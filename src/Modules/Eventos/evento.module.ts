import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { PatrocinioModule } from '../Patrocinio/patrocinio.module';
import { Evento } from './evento.entity';
import { EventoController } from './evento.controller';
import { EventoService } from './evento.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Evento]),
    SeguridadModule,
    PatrocinioModule,
  ],
  controllers: [EventoController],
  providers: [EventoService],
})
export class EventoModule {}
