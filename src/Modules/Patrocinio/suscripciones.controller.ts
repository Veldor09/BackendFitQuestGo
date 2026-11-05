import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import type { RequestAutenticado } from '../Auth/types/request-autenticado';
import { audienciaParaRol } from './pago';
import { urlBasePublica } from './pagos-urls';
import { SolicitarSuscripcionDto } from './solicitar-suscripcion.dto';
import { SuscripcionesService } from './suscripciones.service';

@Controller('patrocinio')
@UseGuards(GuardiaJwt)
export class SuscripcionesController {
  constructor(private readonly suscripcionesService: SuscripcionesService) {}

  /** Los planes que le tocan a quien pregunta (empresa o usuario) en [pais]. */
  @Get('planes')
  consultarPlanes(
    @Query('pais') pais?: string,
    @Req() request?: RequestAutenticado,
  ) {
    return this.suscripcionesService.consultarPlanes(
      pais,
      request ? audienciaParaRol(request.usuario.rol) : undefined,
    );
  }

  /** Mi suscripcion mas reciente, o `null` si nunca pedi una. */
  @Get('suscripciones/mia')
  miSuscripcion(@Req() request: RequestAutenticado) {
    return this.suscripcionesService.miSuscripcion(request.usuario.id);
  }

  /**
   * Empieza el pago de un plan: devuelve la URL de la pantalla de pago (ONVO).
   * El plan se activa solo cuando el pago se confirma.
   */
  @Post('suscripciones/pagar')
  pagar(
    @Req() request: RequestAutenticado,
    @Body() dto: SolicitarSuscripcionDto,
  ) {
    const base = urlBasePublica(request);
    return this.suscripcionesService.iniciarPago(
      request.usuario.id,
      dto,
      request.usuario.rol,
      {
        retorno: (suscripcionId) =>
          `${base}/patrocinio/pagos/retorno?s=${suscripcionId}`,
        cancelado: `${base}/patrocinio/pagos/cancelado`,
      },
    );
  }
}
