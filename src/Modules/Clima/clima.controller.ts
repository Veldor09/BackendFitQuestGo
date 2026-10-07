import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { ClimaService, RespuestaClima } from './clima.service';
import { ConsultaClimaDto } from './dto/ConsultaClimaDTO';

@Controller('clima')
@UseGuards(GuardiaJwt)
export class ClimaController {
  constructor(private readonly climaService: ClimaService) {}

  /**
   * Avisos de lluvia fuerte, tormenta o calor extremo en la zona de `lat`,
   * `lng` para la hora actual y las 3 siguientes. Cualquier usuario autenticado.
   * Responde 503 si el proveedor del clima no esta disponible.
   */
  @Get('alertas')
  alertas(@Query() consulta: ConsultaClimaDto): Promise<RespuestaClima> {
    return this.climaService.alertas(consulta.lat, consulta.lng);
  }
}
