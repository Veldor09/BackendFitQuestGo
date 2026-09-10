import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SeguridadModule } from '../Auth/seguridad.module';
import { Alerta } from './alerta.entity';
import { AlertaController } from './alerta.controller';
import { AlertaService } from './alerta.service';

@Module({
  imports: [TypeOrmModule.forFeature([Alerta]), SeguridadModule],
  controllers: [AlertaController],
  providers: [AlertaService],
})
export class AlertaModule {}
