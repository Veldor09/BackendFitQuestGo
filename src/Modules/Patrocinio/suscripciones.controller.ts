
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
import { SolicitarSuscripcionDto } from './solicitar-suscripcion.dto';
import { SuscripcionesService } from './suscripciones.service';

@Controller('patrocinio')
@UseGuards(GuardiaJwt)
export class SuscripcionesController {
  constructor(
    private readonly suscripcionesService: SuscripcionesService,
  ) {}

  @Get('planes')
  consultarPlanes(@Query('pais') pais?: string) {
    return this.suscripcionesService.consultarPlanes(pais);
  }

  @Post('suscripciones')
  solicitarSuscripcion(
    @Req() request: RequestAutenticado,
    @Body() dto: SolicitarSuscripcionDto,
  ) {
    return this.suscripcionesService.solicitarSuscripcion(
      request.usuario.id,
      dto,
    );
  }
}
