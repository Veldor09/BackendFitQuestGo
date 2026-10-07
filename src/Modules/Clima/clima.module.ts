import { Module } from '@nestjs/common';
import { SeguridadModule } from '../Auth/seguridad.module';
import { ClimaController } from './clima.controller';
import { ClimaService } from './clima.service';
import { OpenMeteoCliente } from './open-meteo.cliente';

@Module({
  imports: [SeguridadModule],
  controllers: [ClimaController],
  providers: [ClimaService, OpenMeteoCliente],
})
export class ClimaModule {}
