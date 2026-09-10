import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Ruta } from './ruta.entity';
import { RutaController } from './ruta.controller';
import { RutaService } from './ruta.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ruta]), SeguridadModule],
  controllers: [RutaController],
  providers: [RutaService],
})
export class RutaModule {}
