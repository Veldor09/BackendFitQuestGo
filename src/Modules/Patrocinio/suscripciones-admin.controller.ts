
import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';
import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';
import { RoleId } from '../Usuarios/roles.enum';

import { RechazarSuscripcionDto } from './rechazar-suscripcion.dto';
import { SuscripcionesService } from './suscripciones.service';

@Controller('admin/patrocinio/suscripciones')
@UseGuards(GuardiaJwt, GuardiaRoles)
@Roles(RoleId.Admin)
export class SuscripcionesAdminController {
  constructor(
    private readonly suscripcionesService: SuscripcionesService,
  ) {}

  @Patch(':id/aprobar')
  aprobarSuscripcion(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() administrador: UsuarioAutenticado,
  ) {
    return this.suscripcionesService.aprobarSuscripcion(
      id,
      administrador.id,
    );
  }

  @Patch(':id/rechazar')
  rechazarSuscripcion(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() administrador: UsuarioAutenticado,
    @Body() dto: RechazarSuscripcionDto,
  ) {
    return this.suscripcionesService.rechazarSuscripcion(
      id,
      administrador.id,
      dto,
    );
  }
}
