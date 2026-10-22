
import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import { GuardiaJwt } from '../Auth/guards/jwt.guard';
import { GuardiaRoles } from '../Auth/guards/roles.guard';
import { Roles } from '../Auth/decorators/roles.decorator';
import { UsuarioActual } from '../Auth/decorators/usuario-actual.decorator';

import type { UsuarioAutenticado } from '../Auth/types/carga-jwt';

import { RoleId } from '../Usuarios/roles.enum';

import { AuditoriaService } from './auditoria.service';
import { ConsultarAuditoriaDto } from './dto/consultar-auditoria.dto';

@Controller('admin/auditoria')
@UseGuards(GuardiaJwt, GuardiaRoles)
@Roles(RoleId.Admin)
export class AuditoriaController {
  constructor(
    private readonly auditoriaService: AuditoriaService,
  ) {}

  /**
   * Consulta los registros de auditoría no archivados.
   * Mantiene los filtros y la paginación existentes.
   */
  @Get()
  consultar(@Query() filtros: ConsultarAuditoriaDto) {
    return this.auditoriaService.consultar(filtros);
  }

  /**
   * Archiva un registro de auditoría.
   *
   * Solo los administradores pueden ejecutar esta acción.
   * El registro permanece almacenado en PostgreSQL.
   */
  @Delete(':id')
  archivar(
    @Param('id', ParseIntPipe) id: number,
    @UsuarioActual() actual: UsuarioAutenticado,
  ) {
    return this.auditoriaService.archivar(
      id,
      actual.id,
    );
  }
}
